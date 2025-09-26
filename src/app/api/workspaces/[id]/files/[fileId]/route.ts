import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, checkRateLimit } from '@/lib/server-utils'
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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
    console.error('File API token verification error:', err)
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
          organization_id
        ),
        file_summaries (
          id,
          summary,
          key_points,
          tags,
          llm_model,
          created_at,
          summary_encrypted,
          key_points_encrypted,
          tags_encrypted,
          encryption_version
        )
      `)
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      console.error('File not found:', fileError)
      return { hasAccess: false, file: null, role: null, isWorkspaceOwner: false }
    }

    

    // Decrypt file summaries if they exist
    if (file.file_summaries && file.file_summaries.length > 0) {
      file.file_summaries = file.file_summaries.map((summary: { summary_encrypted?: string; summary?: string; key_points_encrypted?: string; key_points?: string[]; tags_encrypted?: string; tags?: string[]; encryption_version?: string }) => {
        try {
          // Use encrypted data if available, otherwise fall back to unencrypted
          if (summary.encryption_version === 'v1') {
            const decryptedSummary = {
              ...summary,
              summary: summary.summary_encrypted ? decryptText(summary.summary_encrypted) : summary.summary || '',
              key_points: summary.key_points_encrypted ? JSON.parse(decryptText(summary.key_points_encrypted)) : summary.key_points || [],
              tags: summary.tags_encrypted ? JSON.parse(decryptText(summary.tags_encrypted)) : summary.tags || []
            }
            return decryptedSummary
          } else {
            // Fallback to unencrypted data
            return {
              ...summary,
              summary: summary.summary || '',
              key_points: summary.key_points || [],
              tags: summary.tags || []
            }
          }
        } catch (error) {
          console.error('Error decrypting file summary:', error)
          // Return fallback data
          return {
            ...summary,
            summary: summary.summary || '[Decryption failed]',
            key_points: summary.key_points || [],
            tags: summary.tags || []
          }
        }
      })
    }

    // Check if user uploaded the file (always allow access to own files)
    if (file.uploaded_by === userId) {
      return { hasAccess: true, file, role: 'owner', isWorkspaceOwner: true }
    }

    // If no workspace, deny access
    if (!file.workspaces) {
      console.error('No workspace found for file')
      return { hasAccess: false, file, role: null, isWorkspaceOwner: false }
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('organization_id', file.workspaces.organization_id)
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      console.error('User not a member of organization:', membershipError)
      return { hasAccess: false, file, role: null, isWorkspaceOwner: false }
    }


    // Check if user is the workspace owner (organization owner)
    const isWorkspaceOwner = membership.role === 'owner'

    return { hasAccess: true, file, role: membership.role, isWorkspaceOwner }
  } catch (err) {
    console.error('Error checking file access:', err)
    return { hasAccess: false, file: null, role: null, isWorkspaceOwner: false }
  }
}


// GET - Get file details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const { fileId } = await params

    // Check file access
    const { hasAccess, file } = await checkFileAccess(user.id, fileId)
    if (!hasAccess || !file) {
      console.error(`❌ File access denied for file ${fileId} by user ${user.email}`)
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }


    // Generate signed URL for file access
    let downloadUrl = null
    if (isS3Configured && s3Client) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.s3_key || file.file_path
        })
        
        downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }) // 1 hour
      } catch (urlError) {
        console.error('Error generating signed URL:', urlError)
      }
    } else {
      }

    // Normalize file_summaries to always be an array
    const normalizedFile = {
      ...file,
      file_summaries: Array.isArray(file.file_summaries) 
        ? file.file_summaries 
        : file.file_summaries 
          ? [file.file_summaries] 
          : []
    }

    const fileDetails = {
      ...normalizedFile,
      download_url: downloadUrl
    }


    return NextResponse.json({ file: fileDetails }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error in file GET API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT - Update file details (name, description)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { fileId } = await params

    // Check file access
    const { hasAccess, file, isWorkspaceOwner } = await checkFileAccess(user.id, fileId)
    if (!hasAccess || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Only file uploader or workspace owners can update
    if (file.uploaded_by !== user.id && !isWorkspaceOwner) {
      return NextResponse.json(
        { error: 'Only file uploader or workspace owners can update file details' },
        { status: 403 }
      )
    }

    // Rate limiting for file updates
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-file-update`, 50, 15 * 60 * 1000) // 50 updates per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '50',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    const body = await request.json()
    const { filename, original_name } = body
    

    // Validate input
    if (original_name && (typeof original_name !== 'string' || original_name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'original_name must be a non-empty string' },
        { status: 400 }
      )
    }

    if (filename && (typeof filename !== 'string' || filename.trim().length === 0)) {
      return NextResponse.json(
        { error: 'filename must be a non-empty string' },
        { status: 400 }
      )
    }

    // Prepare update object
    const updateData: {
      updated_at: string;
      original_name?: string;
      filename?: string;
    } = {
      updated_at: new Date().toISOString()
    }

    if (original_name) {
      updateData.original_name = original_name.trim()
    }

    if (filename) {
      updateData.filename = filename.trim()
    }

    // Update file record
    const { data: updatedFile, error: updateError } = await supabaseServer
      .from('file_uploads')
      .update(updateData)
      .eq('id', fileId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating file:', updateError)
      return NextResponse.json(
        { error: 'Failed to update file' },
        { status: 500 }
      )
    }

    // Update workspace data source name if filename changed
    if (filename && filename !== file.filename) {
      const { error: dataSourceError } = await supabaseServer
        .from('workspace_data_sources')
        .update({ source_name: filename.trim() })
        .eq('workspace_id', file.workspace_id)
        .eq('source_type', 'file')
        .eq('source_id', fileId)

      if (dataSourceError) {
        console.error('Error updating workspace data source:', dataSourceError)
      }
    }

    return NextResponse.json(updatedFile, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': '50',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in file PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { fileId } = await params

    // Check file access
    const { hasAccess, file, isWorkspaceOwner } = await checkFileAccess(user.id, fileId)
    if (!hasAccess || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Only file uploader or workspace owners can delete
    if (file.uploaded_by !== user.id && !isWorkspaceOwner) {
      return NextResponse.json(
        { error: 'Only file uploader or workspace owners can delete files' },
        { status: 403 }
      )
    }

    // Rate limiting for file deletions (very restrictive)
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-file-delete`, 10, 15 * 60 * 1000) // 10 deletions per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }


    // Delete from S3 (if configured)
    if (isS3Configured && s3Client) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.s3_key || file.file_path
        })
        
        await s3Client.send(deleteCommand)
        } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error)
        // Continue with database cleanup even if S3 deletion fails
      }
    } else {
      }

    // Delete from database (this will cascade delete related records)
    const { error: deleteError } = await supabaseServer
      .from('file_uploads')
      .delete()
      .eq('id', fileId)

    if (deleteError) {
      console.error('Error deleting file from database:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      )
    }

    // Remove from workspace data sources
    const { error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .delete()
      .eq('workspace_id', file.workspace_id)
      .eq('source_type', 'file')
      .eq('source_id', fileId)

    if (dataSourceError) {
      console.error('Error removing from workspace data sources:', dataSourceError)
    }

    // Note: Agent visibility is handled by frontend based on data source count

    return NextResponse.json(
      { message: 'File deleted successfully' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    )
  } catch (error) {
    console.error('Error in file DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
