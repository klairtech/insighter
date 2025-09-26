import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'
import { encryptText, decryptText, hashForIndex, encryptObject, decryptObject } from '@/lib/encryption'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { conversationId } = await params

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select(`
        id,
        user_id,
        agent_id,
        conversation_type,
        title,
        status,
        external_conversation_id,
        api_metadata,
        created_at,
        updated_at,
        last_message_at,
        ai_agents!inner(
          id,
          name,
          description,
          workspaces!inner(
            id,
            name,
            organizations!inner(
              id,
              name
            )
          )
        )
      `)
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    // Get encrypted messages
    const { data: encryptedMessages, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Decrypt messages
    const decryptedMessages = encryptedMessages?.map(msg => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted ? decryptObject(msg.metadata_encrypted) : {}
        
        // Decrypt XAI data if present
        const xaiData: Record<string, unknown> = {}
        if (msg.sender_type === 'agent') {
          try {
            if (msg.xai_metrics_encrypted) {
              xaiData.xai_metrics = decryptObject(msg.xai_metrics_encrypted)
            }
            if (msg.reasoning_explanation_encrypted) {
              xaiData.reasoning_explanation = decryptText(msg.reasoning_explanation_encrypted)
            }
            if (msg.agent_thinking_notes_encrypted) {
              xaiData.agent_thinking_notes = decryptObject(msg.agent_thinking_notes_encrypted)
            }
            if (msg.sql_queries_encrypted) {
              xaiData.sql_queries = decryptObject(msg.sql_queries_encrypted)
            }
            if (msg.graph_data_encrypted) {
              xaiData.graph_data = decryptObject(msg.graph_data_encrypted)
            }
          } catch (xaiDecryptError) {
            console.error('Error decrypting XAI data:', xaiDecryptError)
            // Continue without XAI data
          }
        }
        
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: decryptedContent,
          message_type: msg.message_type,
          metadata: decryptedMetadata,
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          encryption_version: msg.encryption_version,
          api_request_id: msg.api_request_id,
          api_response_metadata: msg.api_response_metadata,
          created_at: msg.created_at,
          // XAI Data
          ...xaiData,
          confidence_score: msg.confidence_score,
          analysis_depth: msg.analysis_depth,
          data_quality_score: msg.data_quality_score,
          response_completeness_score: msg.response_completeness_score,
          user_satisfaction_prediction: msg.user_satisfaction_prediction
        }
      } catch (decryptError) {
        console.error('Error decrypting message:', decryptError)
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: '[Encrypted message - decryption failed]',
          message_type: msg.message_type,
          metadata: {},
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          encryption_version: msg.encryption_version,
          api_request_id: msg.api_request_id,
          api_response_metadata: msg.api_response_metadata,
          created_at: msg.created_at
        }
      }
    }) || []

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        user_id: conversation.user_id,
        agent_id: conversation.agent_id,
        conversation_type: conversation.conversation_type,
        title: conversation.title,
        status: conversation.status,
        external_conversation_id: conversation.external_conversation_id,
        api_metadata: conversation.api_metadata,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        last_message_at: conversation.last_message_at,
        agent: {
          agent_id: conversation.ai_agents[0].id,
          agent_name: conversation.ai_agents[0].name,
          agent_description: conversation.ai_agents[0].description,
          workspace_name: conversation.ai_agents[0].workspaces[0].name,
          organization_name: conversation.ai_agents[0].workspaces[0].organizations.name
        }
      },
      messages: decryptedMessages
    })
  } catch (error) {
    console.error('Error in unified messages GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    console.log('🔍 Unified Messages API: Starting message processing')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      console.log('❌ Unified Messages API: Unauthorized - no session:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('✅ Unified Messages API: User authenticated:', session.user.id)

    const { conversationId } = await params
    const body = await request.json()
    const { content, message_type = 'text', api_request_id, api_response_metadata } = body

    console.log('📝 Unified Messages API: Processing message:', {
      conversationId,
      content: content?.substring(0, 100) + '...',
      message_type,
      api_request_id,
      api_response_metadata
    })

    if (!content || !content.trim()) {
      console.log('❌ Unified Messages API: No content provided')
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select(`
        id,
        user_id,
        agent_id,
        conversation_type,
        title,
        status,
        external_conversation_id,
        api_metadata,
        created_at,
        updated_at,
        last_message_at,
        ai_agents!inner(
          id,
          name,
          description,
          workspaces!inner(
            id,
            name,
            organizations!inner(
              id,
              name
            )
          )
        )
      `)
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    // Encrypt user message
    const encryptedContent = encryptText(content.trim())
    const contentHash = hashForIndex(content.trim())
    const encryptedMetadata = encryptObject({})

    // Prepare message data
    const messageData: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_type: 'user',
      content_encrypted: encryptedContent,
      content_hash: contentHash,
      message_type: message_type,
      metadata_encrypted: encryptedMetadata,
      encryption_version: 'v1'
    }

    // Add API-specific fields if this is an API conversation
    if (conversation.conversation_type === 'api') {
      if (api_request_id) {
        messageData.api_request_id = api_request_id
      }
      if (api_response_metadata) {
        messageData.api_response_metadata = api_response_metadata
      }
    }

    // Save encrypted user message
    const { error: userMsgError } = await supabaseServer
      .from('messages')
      .insert([messageData])
      .select()
      .single()

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }

    // Update conversation last_message_at
    await supabaseServer
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // For chat conversations, process with AI agent
    if (conversation.conversation_type === 'chat') {
      console.log('🤖 Unified Messages API: Processing with AI agent for chat conversation')
      
      // Get conversation context for AI processing
      const conversationContext = await getConversationContext()
      
      if (!conversationContext) {
        console.log('❌ Unified Messages API: Failed to get conversation context')
        return NextResponse.json(
          { error: 'Failed to get conversation context' },
          { status: 500 }
        )
      }
      
      console.log('✅ Unified Messages API: Got conversation context, processing with AI agent')
      // Process with AI agent
      const agentResponse = await processWithAgent()
      console.log('✅ Unified Messages API: AI agent response received')

      // Encrypt agent response
      const encryptedAgentContent = encryptText(agentResponse.content)
      const agentContentHash = hashForIndex(agentResponse.content)
      const encryptedAgentMetadata = encryptObject(agentResponse.metadata)

      // Save encrypted agent response
      const { error: agentMsgError } = await supabaseServer
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_type: 'agent',
          content_encrypted: encryptedAgentContent,
          content_hash: agentContentHash,
          message_type: 'text',
          metadata_encrypted: encryptedAgentMetadata,
          tokens_used: agentResponse.tokens_used,
          processing_time_ms: agentResponse.processing_time_ms,
          encryption_version: 'v1'
        }])
        .select()
        .single()

      if (agentMsgError) {
        console.error('Error saving agent message:', agentMsgError)
        // Don't fail the request, just log the error
      }
    }

    // Get updated conversation with all encrypted messages
    const { data: updatedEncryptedMessages, error: messagesError } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching updated messages:', messagesError)
    }

    // Decrypt messages for response
    const decryptedMessages = updatedEncryptedMessages?.map(msg => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted ? decryptObject(msg.metadata_encrypted) : {}
        
        // Decrypt XAI data if present
        const xaiData: Record<string, unknown> = {}
        if (msg.sender_type === 'agent') {
          try {
            if (msg.xai_metrics_encrypted) {
              xaiData.xai_metrics = decryptObject(msg.xai_metrics_encrypted)
            }
            if (msg.reasoning_explanation_encrypted) {
              xaiData.reasoning_explanation = decryptText(msg.reasoning_explanation_encrypted)
            }
            if (msg.agent_thinking_notes_encrypted) {
              xaiData.agent_thinking_notes = decryptObject(msg.agent_thinking_notes_encrypted)
            }
            if (msg.sql_queries_encrypted) {
              xaiData.sql_queries = decryptObject(msg.sql_queries_encrypted)
            }
            if (msg.graph_data_encrypted) {
              xaiData.graph_data = decryptObject(msg.graph_data_encrypted)
            }
          } catch (xaiDecryptError) {
            console.error('Error decrypting XAI data:', xaiDecryptError)
            // Continue without XAI data
          }
        }
        
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: decryptedContent,
          message_type: msg.message_type,
          metadata: decryptedMetadata,
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          encryption_version: msg.encryption_version,
          api_request_id: msg.api_request_id,
          api_response_metadata: msg.api_response_metadata,
          created_at: msg.created_at,
          // XAI Data
          ...xaiData,
          confidence_score: msg.confidence_score,
          analysis_depth: msg.analysis_depth,
          data_quality_score: msg.data_quality_score,
          response_completeness_score: msg.response_completeness_score,
          user_satisfaction_prediction: msg.user_satisfaction_prediction
        }
      } catch (decryptError) {
        console.error('Error decrypting message:', decryptError)
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: '[Encrypted message - decryption failed]',
          message_type: msg.message_type,
          metadata: {},
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          encryption_version: msg.encryption_version,
          api_request_id: msg.api_request_id,
          api_response_metadata: msg.api_response_metadata,
          created_at: msg.created_at
        }
      }
    }) || []

    console.log('✅ Unified Messages API: Message processed successfully')
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        user_id: conversation.user_id,
        agent_id: conversation.agent_id,
        conversation_type: conversation.conversation_type,
        title: conversation.title,
        status: conversation.status,
        external_conversation_id: conversation.external_conversation_id,
        api_metadata: conversation.api_metadata,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        last_message_at: conversation.last_message_at,
        agent: {
          agent_id: conversation.ai_agents[0].id,
          agent_name: conversation.ai_agents[0].name,
          agent_description: conversation.ai_agents[0].description,
          workspace_name: conversation.ai_agents[0].workspaces[0].name,
          organization_name: conversation.ai_agents[0].workspaces[0].organizations.name
        }
      },
      messages: decryptedMessages
    })

  } catch (error) {
    console.error('Error in unified messages POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (these would need to be imported from your existing files)
async function getConversationContext() {
  // Implementation from your existing chat API
  return null
}

async function processWithAgent() {
  // Implementation from your existing chat API
  return {
    content: 'AI response placeholder',
    metadata: {},
    tokens_used: 0,
    processing_time_ms: 0
  }
}
