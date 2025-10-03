import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { decryptText } from '@/lib/encryption'

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
    if (!supabaseServer) {
      return { hasAccess: false, file: null }
    }

    // First, get the file with workspace info
    const { data: file, error: fileError } = await supabaseServer
      .from('file_uploads')
      .select(`
        *,
        workspaces (
          id,
          organization_id
        )
      `)
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      console.error('File not found:', fileError)
      return { hasAccess: false, file: null }
    }

    // Check if user uploaded the file (always allow access to own files)
    if (file.uploaded_by === userId) {
      return { hasAccess: true, file }
    }

    // If no workspace, deny access
    if (!file.workspaces) {
      console.error('No workspace found for file')
      return { hasAccess: false, file }
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('organization_id', file.workspaces.organization_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership) {
      console.error('User not a member of organization:', membershipError)
      return { hasAccess: false, file }
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

    // Check if file is stored in S3 or locally
    if (file.s3_key.startsWith('local/')) {
      // File is stored locally - this shouldn't happen in production
      // but we'll handle it gracefully
      return NextResponse.json({ 
        error: 'File is stored locally and cannot be downloaded via API',
        details: 'Please contact support for local file access'
      }, { status: 501 })
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

      const encryptedBuffer = Buffer.concat(chunks)
      
      // Decrypt the file content
      let decryptedBuffer: Buffer
      try {
        const encryptedContent = encryptedBuffer.toString('utf8')
        const decryptedBase64 = decryptText(encryptedContent)
        decryptedBuffer = Buffer.from(decryptedBase64, 'base64')
      } catch (decryptError) {
        console.error('Error decrypting file:', decryptError)
        return NextResponse.json({ error: 'Failed to decrypt file' }, { status: 500 })
      }
      
      // Return the decrypted file with appropriate headers
      return new NextResponse(new Uint8Array(decryptedBuffer), {
        status: 200,
        headers: {
          'Content-Type': file.file_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.original_name || file.filename}"`,
          'Content-Length': decryptedBuffer.length.toString(),
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
