import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'
import { generateAISummary } from '@/lib/ai-summary'
import mammoth from 'mammoth'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { fileId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
    }
    
    console.log(`🔄 Reprocessing file: ${fileId}`)
    
    // Get file information
    const { data: file, error: fileError } = await supabaseServer
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .single()
    
    if (fileError || !file) {
      console.error('❌ File not found:', fileError)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    console.log(`📁 Reprocessing file: ${file.original_name}`)
    
    // Read actual file content
    let fileContent = ''
    
    try {
      if (file.file_path) {
        const { data: fileData, error: downloadError } = await supabaseServer.storage
          .from('files')
          .download(file.file_path)
        
        if (!downloadError && fileData) {
          // Handle different file types
          if (file.file_type?.includes('application/vnd.openxmlformats-officedocument')) {
            // Word document - extract text using mammoth
            try {
              const arrayBuffer = await fileData.arrayBuffer()
              const result = await mammoth.extractRawText({ arrayBuffer })
              fileContent = result.value
              console.log(`✅ Successfully extracted text from Word document: ${file.original_name}`)
            } catch (mammothError) {
              console.error(`❌ Error extracting text from Word document: ${mammothError}`)
              return NextResponse.json({ 
                error: `Error extracting text from Word document: ${mammothError instanceof Error ? mammothError.message : 'Unknown error'}` 
              }, { status: 500 })
            }
          } else {
            // Regular text file
            fileContent = await fileData.text()
            console.log(`✅ Successfully read file content: ${file.original_name}`)
          }
        } else {
          console.error('❌ Failed to download file:', downloadError)
          return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
        }
      } else {
        console.error('❌ No file path available')
        return NextResponse.json({ error: 'No file path available' }, { status: 500 })
      }
    } catch (contentError) {
      console.error('❌ Error reading file content:', contentError)
      return NextResponse.json({ 
        error: `Error reading file content: ${contentError instanceof Error ? contentError.message : 'Unknown error'}` 
      }, { status: 500 })
    }
    
    console.log(`📄 File content length: ${fileContent.length} characters`)
    console.log(`📄 Content preview: ${fileContent.substring(0, 200)}...`)
    
    // Generate new AI summary from actual content
    const aiSummary = await generateAISummary(
      file.original_name,
      file.file_type,
      fileContent
    )
    
    console.log(`🤖 Generated AI summary:`, {
      summary: aiSummary.summary?.substring(0, 100) + '...',
      key_points: aiSummary.key_points?.length || 0,
      tags: aiSummary.tags || []
    })
    
    // Update the file summary in database
    const { error: summaryError } = await supabaseServer
      .from('file_summaries')
      .upsert([{
        file_id: fileId,
        summary: aiSummary.summary,
        key_points: aiSummary.key_points,
        tags: aiSummary.tags,
        content_type: file.file_type,
        word_count: aiSummary.word_count,
        reading_time_minutes: aiSummary.reading_time_minutes,
        llm_model: aiSummary.model_used,
        llm_tokens_used: aiSummary.tokens_used,
        agent_definition: aiSummary.agent_definition
      }], {
        onConflict: 'file_id'
      })
    
    if (summaryError) {
      console.error('❌ Failed to save AI summary:', summaryError)
      return NextResponse.json({ error: 'Failed to save AI summary' }, { status: 500 })
    }
    
    console.log(`✅ Successfully reprocessed file: ${file.original_name}`)
    
    return NextResponse.json({
      success: true,
      message: 'File reprocessed successfully',
      file: {
        id: fileId,
        name: file.original_name,
        contentLength: fileContent.length,
        summary: aiSummary.summary?.substring(0, 200) + '...',
        keyPoints: aiSummary.key_points?.length || 0,
        tags: aiSummary.tags || []
      }
    })
    
  } catch (error) {
    console.error('❌ Reprocess file error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
