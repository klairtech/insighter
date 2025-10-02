import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

// AWS S3 Configuration
const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET

const s3Client = isS3Configured ? new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT, // Added for Supabase Storage
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for Supabase Storage
}) : null

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'insighter-files'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
  if (!supabaseServer) {
    return null
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error('File download API token verification error:', err)
    return null
  }
}

// Helper function to check file access
async function checkFileAccess(userId: string, fileId: string) {
  try {
    // First, get the file with workspace info
    const { data: file, error: fileError } = await supabaseServer
      .from('file_uploads')
      .select(`
        *,
        workspaces (
          id,
          organization_id,
          organization_members!inner (
            user_id,
            status
          )
        )
      `)
      .eq('id', fileId)
      .eq('workspaces.organization_members.user_id', userId)
      .eq('workspaces.organization_members.status', 'active')
      .single()

    if (fileError || !file) {
      return { hasAccess: false, file: null }
    }

    return { hasAccess: true, file }
  } catch (error) {
    console.error('Error checking file access:', error)
    return { hasAccess: false, file: null }
  }
}

// GET - Download file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId, fileId } = await params

    // Check file access
    const { hasAccess, file } = await checkFileAccess(user.id, fileId)
    if (!hasAccess || !file) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    // Verify workspace ID matches
    if (file.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'File not found in this workspace' }, { status: 404 })
    }

    if (!isS3Configured || !s3Client) {
      return NextResponse.json({ error: 'File storage not configured' }, { status: 500 })
    }

    try {
      // Get the file from S3
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: file.s3_key,
      })

      const response = await s3Client.send(command)
      
      if (!response.Body) {
        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
      }

      // Convert the stream to buffer
      const chunks: Uint8Array[] = []
      const reader = response.Body.transformToWebStream().getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const buffer = Buffer.concat(chunks)
      
      // Return the file with appropriate headers
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': file.file_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.original_name || file.filename}"`,
          'Content-Length': buffer.length.toString(),
        },
      })

    } catch (s3Error) {
      console.error('S3 download error:', s3Error)
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
    }

  } catch (error) {
    console.error('File download API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
