import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'
import { processWithAgent, getConversationContext } from '@/lib/ai-agents'
import { encryptText, encryptObject, hashForIndex } from '@/lib/encryption'

/**
 * AGENT MESSAGE STREAM API - HIERARCHICAL ACCESS CONTROL
 * ====================================================
 * 
 * This API handles streaming messages to AI agents with hierarchical access control.
 * 
 * Access Hierarchy:
 * Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer) → Agent (Read/Write)
 * 
 * Key Functions Used:
 * - user_has_agent_access(): Checks if user has access to agent (direct or inherited)
 * - can_user_perform_agent_action(): Checks if user can perform specific action on agent
 * 
 * Access Requirements:
 * - User must have access to the agent (direct or inherited)
 * - User must have write permissions to send messages
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    
    // Verify user session
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    

    const { agentId } = await params
    const body = await request.json()
    const { content, message_type = 'text' } = body


    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    if (!process.env.CHAT_ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Check if user has access to this agent using hierarchical access control
    const { data: hasAccess, error: accessError } = await supabaseServer.rpc(
      'user_has_agent_access',
      {
        p_user_id: session.user.id,
        p_agent_id: agentId
      }
    )

    if (accessError) {
      console.error('❌ Agent Message Stream API: Error checking access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify access permissions' },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.log('❌ Agent Message Stream API: User does not have access to this agent');
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    // Check if user can perform write action (send messages)
    const { data: canWrite, error: permissionError } = await supabaseServer.rpc(
      'can_user_perform_agent_action',
      {
        p_user_id: session.user.id,
        p_agent_id: agentId,
        p_action: 'write'
      }
    )

    if (permissionError) {
      console.error('❌ Agent Message Stream API: Error checking write permissions:', permissionError);
      return NextResponse.json(
        { error: 'Failed to verify write permissions' },
        { status: 500 }
      )
    }

    if (!canWrite) {
      console.log('❌ Agent Message Stream API: User does not have write access to this agent');
      return NextResponse.json(
        { error: 'Access denied: You do not have permission to send messages to this agent' },
        { status: 403 }
      )
    }

    // Check if conversation already exists
    const { data: existingConversation, error: convError } = await supabaseServer
      .from('conversations')
      .select('id, title, created_at, updated_at, last_message_at')
      .eq('user_id', session.user.id)
      .eq('agent_id', agentId)
      .eq('conversation_type', 'chat')
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()

    let conversationId: string

    if (convError || !existingConversation) {
      // Create new conversation
      console.log('📝 Creating new conversation for agent:', agentId)
      
      const conversationTitle = content.length > 50 
        ? content.substring(0, 50) + '...' 
        : content

      const { data: newConversation, error: createError } = await supabaseServer
        .from('conversations')
        .insert({
          user_id: session.user.id,
          agent_id: agentId,
          conversation_type: 'chat',
          title: conversationTitle,
          status: 'active'
        })
        .select('id, title, created_at, updated_at, last_message_at')
        .single()

      if (createError || !newConversation) {
        console.error('❌ Failed to create conversation:', createError)
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversationId = newConversation.id
      console.log('✅ Created new conversation:', conversationId, 'for agent:', agentId)
    } else {
      conversationId = existingConversation.id
      console.log('✅ Using existing conversation:', conversationId)
    }

    // Create a readable stream for real-time updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // Helper function to send updates
        const sendUpdate = (type: string, data: unknown) => {
          const message = `data: ${JSON.stringify({ type, data })}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          // Step 1: Analyzing message
          sendUpdate('thinking', { 
            step: 'analyzing', 
            message: '🤔 Analyzing your question and understanding what you need...' 
          })
          
          // Realistic delay for analysis
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Step 2: Getting conversation context
          sendUpdate('thinking', { 
            step: 'context', 
            message: '📚 Retrieving conversation history and context...' 
          })
          
          // Small delay before context retrieval
          await new Promise(resolve => setTimeout(resolve, 800))
          
          const conversationContext = await getConversationContext(conversationId, agentId)
          
          if (!conversationContext) {
            sendUpdate('error', { message: 'Failed to get conversation context' })
            controller.close()
            return
          }

          // Step 3: Processing with AI
          sendUpdate('thinking', { 
            step: 'processing', 
            message: '🧠 Processing your request with AI analysis...' 
          })

          // Realistic delay for AI processing
          await new Promise(resolve => setTimeout(resolve, 2000))

          const agentResponse = await processWithAgent(
            conversationContext,
            content.trim()
          )

          // Step 4: Saving messages
          sendUpdate('thinking', { 
            step: 'saving', 
            message: '💾 Analysing your conversation and preparing response...' 
          })

          // Brief delay for saving
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Encrypt and save user message
          const userMessageEncrypted = encryptText(content.trim())
          const userMessageHash = hashForIndex(content.trim())

          const { data: userMessage, error: userMsgError } = await supabaseServer
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content_encrypted: userMessageEncrypted,
              content_hash: userMessageHash,
              sender_type: 'user',
              message_type: message_type,
              metadata_encrypted: encryptObject({}),
              tokens_used: 0,
              processing_time_ms: 0,
              encryption_version: 'v1'
            })
            .select('id, created_at')
            .single()

          if (userMsgError) {
            sendUpdate('error', { message: 'Failed to save user message' })
            controller.close()
            return
          }

          // Encrypt and save agent response with comprehensive XAI data
          // Timing: start_time = when agent received message, end_time = when agent responded
          // created_at = when message was saved (effectively end_time)
          // processing_time_ms = duration between start and end
          const agentMessageEncrypted = encryptText(agentResponse.content)
          const agentMessageHash = hashForIndex(agentResponse.content)

          // Encrypt XAI metrics and other data
          const xaiMetricsEncrypted = agentResponse.xai_metrics ? encryptObject(agentResponse.xai_metrics as unknown as Record<string, unknown>) : null
          const agentThinkingNotesEncrypted = agentResponse.agent_thinking_notes ? encryptObject(agentResponse.agent_thinking_notes as unknown as Record<string, unknown>) : null
          const sqlQueriesEncrypted = agentResponse.sql_queries ? encryptObject(agentResponse.sql_queries as unknown as Record<string, unknown>) : null
          const graphDataEncrypted = agentResponse.graph_data ? encryptObject(agentResponse.graph_data as unknown as Record<string, unknown>) : null
          const reasoningExplanationEncrypted = agentResponse.reasoning_explanation ? encryptText(agentResponse.reasoning_explanation) : null
          // Note: token_tracking_encrypted column doesn't exist in schema, storing in metadata instead

          const { data: agentMessage, error: agentMsgError } = await supabaseServer
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content_encrypted: agentMessageEncrypted,
              content_hash: agentMessageHash,
              sender_type: 'agent',
              message_type: 'text',
              metadata_encrypted: encryptObject({
                tokens_used: agentResponse.tokens_used,
                confidence_score: agentResponse.metadata?.confidence_score,
                files_referenced: agentResponse.metadata?.files_referenced,
                sql_query: (agentResponse.metadata as Record<string, unknown>)?.sql_query,
                start_time: (agentResponse.metadata as Record<string, unknown>)?.start_time,
                end_time: (agentResponse.metadata as Record<string, unknown>)?.end_time,
                token_tracking: agentResponse.token_tracking // Store token tracking in metadata since column doesn't exist
              }),
              tokens_used: agentResponse.tokens_used || 0,
              processing_time_ms: agentResponse.processing_time_ms || 0,
              encryption_version: 'v1',
              // XAI Metrics
              xai_metrics_encrypted: xaiMetricsEncrypted,
              agent_thinking_notes_encrypted: agentThinkingNotesEncrypted,
              sql_queries_encrypted: sqlQueriesEncrypted,
              graph_data_encrypted: graphDataEncrypted,
              reasoning_explanation_encrypted: reasoningExplanationEncrypted,
              // Analysis metrics
              analysis_depth: agentResponse.analysis_depth,
              data_quality_score: agentResponse.data_quality_score,
              response_completeness_score: agentResponse.response_completeness_score,
              user_satisfaction_prediction: agentResponse.user_satisfaction_prediction
            })
            .select('id, created_at')
            .single()

          if (agentMsgError) {
            console.error('❌ Failed to save agent message:', agentMsgError)
            sendUpdate('error', { message: 'Failed to save agent message' })
            controller.close()
            return
          }

          // Update conversation's last_message_at
          await supabaseServer
            .from('conversations')
            .update({ 
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId)

          // Step 5: Send final response
          sendUpdate('complete', {
            conversation_id: conversationId,
            user_message: {
              id: userMessage.id,
              content: content.trim(),
              role: 'user',
              message_type: message_type,
              created_at: userMessage.created_at
            },
            agent_message: {
              id: agentMessage.id,
              content: agentResponse.content,
              role: 'assistant',
              message_type: 'text',
              created_at: agentMessage.created_at,
              metadata: {
                tokens_used: agentResponse.tokens_used,
                processing_time_ms: agentResponse.processing_time_ms,
                confidence_score: agentResponse.metadata?.confidence_score,
                files_referenced: agentResponse.metadata?.files_referenced,
                sql_query: (agentResponse.metadata as Record<string, unknown>)?.sql_query,
                start_time: (agentResponse.metadata as Record<string, unknown>)?.start_time,
                end_time: (agentResponse.metadata as Record<string, unknown>)?.end_time,
                analysis_depth: agentResponse.analysis_depth,
                data_quality_score: agentResponse.data_quality_score,
                response_completeness_score: agentResponse.response_completeness_score,
                user_satisfaction_prediction: agentResponse.user_satisfaction_prediction
              }
            }
          })

          controller.close()

        } catch (error) {
          console.error('❌ Error in streaming agent message API:', error)
          sendUpdate('error', { message: 'Internal server error' })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('❌ Error in agent message stream API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
