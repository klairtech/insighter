import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, checkRateLimit, createServerSupabaseClient } from '@/lib/server-utils'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { generateAISummary, AISummary } from '@/lib/ai-summary'
import { encryptText, encryptObject } from '@/lib/encryption'
import { extractTextWithLLM } from '@/lib/llm-text-extraction'

// AWS S3 Configuration
const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET

const s3Client = isS3Configured ? new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
}) : null

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'insighter-files'

// Read file content from S3
// async function readFileFromS3(s3Key: string): Promise<string | null> {
//   if (!isS3Configured || !s3Client || !s3Key || s3Key.startsWith('local/')) {
//     return null
//   }

//   try {
//     const command = new GetObjectCommand({
//       Bucket: S3_BUCKET,
//       Key: s3Key
//     })
//     const response = await s3Client.send(command)
//     const content = await response.Body?.transformToString('utf-8')
//     return content || null
//   } catch {
//     return null
//   }
// }









// Helper function to verify user session using server-side cookies
async function verifyUserSession() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return null
    }
    return user
  } catch {
    return null
  }
}

// Helper function to check workspace access
async function checkWorkspaceAccess(userId: string, workspaceId: string) {
  try {
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return { hasAccess: false, role: null, isWorkspaceOwner: false }
    }

    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', workspace.organization_id)
      .single()

    if (membershipError || !membership) {
      return { hasAccess: false, role: null, isWorkspaceOwner: false }
    }

    const isWorkspaceOwner = membership.role === 'owner'
    return { hasAccess: true, role: membership.role, isWorkspaceOwner }
  } catch {
    return { hasAccess: false, role: null, isWorkspaceOwner: false }
  }
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = await params

    const { hasAccess, isWorkspaceOwner } = await checkWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
    }

    if (!isWorkspaceOwner) {
      return NextResponse.json({ error: 'Only workspace owners can add data sources' }, { status: 403 })
    }

    // Check if user has minimum credits (10 credits minimum) for adding data sources
    const { checkUserCredits } = await import('@/lib/credit-service-server')
    const minimumCreditsCheck = await checkUserCredits(user.id, 10)
    
    if (!minimumCreditsCheck.hasCredits) {
      console.log(`❌ File Upload API: User has insufficient credits for adding data sources. User has ${minimumCreditsCheck.currentCredits}, needs minimum 10 credits`)
      return NextResponse.json(
        { 
          error: 'Insufficient credits to add data sources',
          currentCredits: minimumCreditsCheck.currentCredits,
          requiredCredits: 10,
          message: 'You need at least 10 credits to add new data sources. Please purchase more credits to continue.'
        },
        { status: 402 } // Payment Required
      )
    }

    // Rate limiting
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-file-upload`, 20, 60 * 60 * 1000)
    
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    // Validate file type - only support text, pdf, docx, excel, csv, json, rtf as requested
    const allowedTypes = [
      'text/plain', 'text/csv', 'application/json', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/rtf'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File type not supported', 
        details: 'Only text, PDF, DOCX, Excel, CSV, JSON, and RTF files are supported',
        supportedTypes: ['text/plain', 'text/csv', 'application/json', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/rtf']
      }, { status: 400 })
    }

    // STEP 1: Read file content and validate text extraction using LLM-based approach
    console.log(`📖 Reading and validating file content with AI: ${file.name}`)
    const fileBuffer = await file.arrayBuffer()
    
    // Use LLM-based text extraction
    const extractionResult = await extractTextWithLLM(
      file.name,
      file.type,
      fileBuffer,
      (message) => console.log(`📄 ${message}`)
    )
    
    const fileContent = extractionResult.extractedText
    const fileValidationError = extractionResult.error || ''
    
    console.log(`🔍 Text extraction result:`, {
      method: extractionResult.extractionMethod,
      confidence: extractionResult.confidence,
      isReadable: extractionResult.isReadable,
      textLength: fileContent.length,
      tokensUsed: extractionResult.tokensUsed || 0,
      error: fileValidationError
    })
    
    // STEP 2: Check for file validation errors and return early if validation failed
    if (fileValidationError || !extractionResult.isReadable) {
      const errorMessage = fileValidationError || 'File content could not be extracted or is not readable'
      console.log(`❌ File validation failed for ${file.name}: ${errorMessage}`)
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: errorMessage,
          fileName: file.name,
          fileType: file.type,
          extractionMethod: extractionResult.extractionMethod,
          confidence: extractionResult.confidence
        },
        { status: 400 }
      )
    }

    console.log(`✅ File content validation passed for ${file.name} (${fileContent.length} characters extracted)`)

    // STEP 3: Generate AI summary based on extracted text
    console.log(`🧠 Generating AI summary for: ${file.name}`)
    let aiSummary: AISummary | null = null
    let totalTokensUsed = extractionResult.tokensUsed || 0
    
    try {
      // Create progress callback to send updates to client
      const progressCallback = (message: string) => {
        console.log(`Progress: ${message}`)
      }
      
      aiSummary = await generateAISummary(file.name, file.type, fileContent, progressCallback)
      totalTokensUsed += aiSummary.tokens_used || 0
      
      console.log(`✅ AI summary generated for: ${file.name}`)
      console.log(`🔢 Total tokens used so far: ${totalTokensUsed} (extraction: ${extractionResult.tokensUsed || 0}, summary: ${aiSummary.tokens_used || 0})`)
    } catch (aiError) {
      console.error('❌ AI summary generation failed:', aiError)
      return NextResponse.json(
        { 
          error: 'Failed to generate AI summary',
          details: aiError instanceof Error ? aiError.message : 'Unknown error',
          fileName: file.name,
          tokensUsed: totalTokensUsed
        },
        { status: 500 }
      )
    }

    // STEP 4: Generate unique file ID and prepare for storage
    const fileId = crypto.randomUUID()
    const fileExtension = file.name.split('.').pop() || ''
    
    // Encrypt original file before storing
    const encryptedOriginalFile = encryptText(Buffer.from(fileBuffer).toString('base64'))

    // STEP 5: Save original file (encrypted) to S3
    let filePath = ''
    let s3Key = ''
    
    if (isS3Configured && s3Client) {
      s3Key = `workspaces/${workspaceId}/files/${fileId}.${fileExtension}`
      filePath = s3Key

      try {
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: Buffer.from(encryptedOriginalFile, 'utf8'),
          ContentType: 'application/octet-stream', // Encrypted content
          Metadata: {
            originalName: file.name,
            uploadedBy: user.id,
            workspaceId: workspaceId,
            encrypted: 'true',
            encryptionVersion: 'v1'
          }
        })

        await s3Client.send(command)
        console.log(`🔐 Original file uploaded to S3: ${s3Key}`)
      } catch (storageError) {
        console.error('❌ Failed to upload original file:', storageError)
        return NextResponse.json({ error: 'Failed to upload original file to storage' }, { status: 500 })
      }
    } else {
      filePath = `local/${workspaceId}/files/${fileId}.${fileExtension}`
      s3Key = filePath
      console.log(`🔐 Original file stored locally: ${filePath}`)
    }

    // STEP 6: Save file record to database
    console.log(`💾 Saving file to database: ${file.name} in workspace ${workspaceId}`)
    const { error: fileError } = await supabaseServer
      .from('file_uploads')
      .insert([{
        id: fileId,
        filename: file.name,
        original_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
        s3_key: s3Key,
        s3_bucket: isS3Configured ? S3_BUCKET : null,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        processing_status: 'completed', // Already completed since we validated and generated summary
        processed_at: new Date().toISOString(),
        processing_error: null
      }])

    if (fileError) {
      console.error('❌ Failed to save file record:', fileError)
      return NextResponse.json({ error: 'Failed to save file record' }, { status: 500 })
    }

    // STEP 7: Save AI summary to database
    console.log(`💾 Saving AI summary to database: ${file.name}`)
    const encryptedSummary = encryptText(aiSummary.summary)
    const encryptedKeyPoints = encryptText(JSON.stringify(aiSummary.key_points))
    const encryptedTags = encryptText(JSON.stringify(aiSummary.tags))
    const encryptedAgentDefinition = encryptObject(aiSummary.agent_definition as unknown as Record<string, unknown>)
    
    const { error: summaryError } = await supabaseServer
      .from('file_summaries')
      .upsert([{
        file_id: fileId,
        // Old unencrypted fields (deprecated - kept for constraint compatibility)
        summary: aiSummary.summary, // Fallback for NOT NULL constraint
        key_points: aiSummary.key_points, // Fallback for NOT NULL constraint  
        tags: aiSummary.tags, // Fallback for NOT NULL constraint
        // New encrypted fields (preferred)
        summary_encrypted: encryptedSummary,
        key_points_encrypted: encryptedKeyPoints,
        tags_encrypted: encryptedTags,
        content_type: file.type,
        word_count: aiSummary.word_count,
        reading_time_minutes: aiSummary.reading_time_minutes,
        llm_model: aiSummary.model_used,
        llm_tokens_used: aiSummary.tokens_used,
        agent_definition: aiSummary.agent_definition, // Fallback for NOT NULL constraint
        agent_definition_encrypted: encryptedAgentDefinition,
        encryption_version: 'v1'
      }], {
        onConflict: 'file_id'
      })

    if (summaryError) {
      console.error('❌ Failed to save AI summary:', summaryError)
      return NextResponse.json({ error: 'Failed to save AI summary' }, { status: 500 })
    }

    // STEP 8: Add to workspace data sources
    const { error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .insert([{
        workspace_id: workspaceId,
        source_type: 'file',
        source_id: fileId,
        source_name: file.name
      }])

    if (dataSourceError) {
      console.error('❌ Failed to add to workspace data sources:', dataSourceError)
    }

    // STEP 9: Return success message with comprehensive token tracking
    console.log(`🎉 File upload and processing completed successfully: ${file.name}`)
    console.log(`🔢 Final token usage: ${totalTokensUsed} total tokens`)
    
    return NextResponse.json({
      id: fileId,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
      message: 'File uploaded, validated, and analyzed successfully',
      processing_status: 'completed',
      ai_summary: {
        summary: aiSummary.summary,
        key_points: aiSummary.key_points,
        tags: aiSummary.tags,
        word_count: aiSummary.word_count,
        reading_time_minutes: aiSummary.reading_time_minutes
      },
      original_file: {
        path: filePath,
        s3_key: s3Key
      },
      token_tracking: {
        total_tokens_used: totalTokensUsed,
        extraction_tokens: extractionResult.tokensUsed || 0,
        summary_tokens: aiSummary.tokens_used || 0,
        extraction_method: extractionResult.extractionMethod,
        model_used: aiSummary.model_used
      }
    })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = await params

    const { hasAccess } = await checkWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
    }

    const { data: files, error: filesError } = await supabaseServer
      .from('file_uploads')
      .select(`
        id,
        filename,
        original_name,
        file_type,
        file_size,
        s3_key,
        s3_bucket,
        created_at,
        processing_status,
        processed_at,
        processing_error,
        file_summaries (
          id,
          summary,
          key_points,
          tags,
          llm_model,
          created_at
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (filesError) {
      console.error('Error fetching files:', filesError)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    // Generate download URLs for files
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        if (isS3Configured && s3Client && file.s3_key && !file.s3_key.startsWith('local/')) {
          try {
            const command = new GetObjectCommand({
              Bucket: S3_BUCKET,
              Key: file.s3_key
            })
            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
            return {
              ...file,
              download_url: signedUrl,
              file_summaries: file.file_summaries?.[0] || null
            }
          } catch {
            return {
              ...file,
              download_url: null,
              file_summaries: file.file_summaries?.[0] || null
            }
          }
        } else {
          return {
            ...file,
            download_url: null,
            file_summaries: file.file_summaries?.[0] || null
          }
        }
      })
    )

    return NextResponse.json({
      files: filesWithUrls,
      total: filesWithUrls.length
    })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
