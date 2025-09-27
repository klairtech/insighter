import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'
import { processWithEnhancedAgent, getConversationContext } from '@/lib/ai-agents'
import { encryptText, encryptObject, hashForIndex } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Unified Chat API: Starting message processing')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      console.log('❌ Unified Chat API: Unauthorized - no session:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('✅ Unified Chat API: User authenticated:', session.user.id)

    const body = await request.json()
    const { 
      conversationId, 
      agentId, 
      content, 
      message_type = 'text',
      stream = false 
    } = body

    console.log('📝 Unified Chat API: Processing message:', {
      conversationId,
      agentId,
      content: content?.substring(0, 100) + '...',
      message_type,
      stream
    })

    if (!content || !content.trim()) {
      console.log('❌ Unified Chat API: No content provided')
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Determine conversation ID and agent ID
    let finalConversationId = conversationId
    let finalAgentId = agentId

    // If no conversationId provided, we need agentId to create/find conversation
    if (!finalConversationId && !finalAgentId) {
      return NextResponse.json(
        { error: 'Either conversationId or agentId is required' },
        { status: 400 }
      )
    }

    // If we have agentId but no conversationId, find or create conversation
    if (!finalConversationId && finalAgentId) {
      console.log('🔍 Unified Chat API: Finding or creating conversation for agent:', finalAgentId)
      
      // Check if user has access to this agent
      const { data: access } = await supabaseServer
        .from('agent_access')
        .select('access_level')
        .eq('user_id', session.user.id)
        .eq('agent_id', finalAgentId)
        .single()
      
      let userAccess = access

      // If no direct access found, check organization/workspace membership
      if (!userAccess) {
        console.log('🔍 Unified Chat API: No direct agent access, checking organization/workspace membership')
        
        const { data: orgAccess, error: orgAccessError } = await supabaseServer
          .rpc('user_has_agent_access', {
            p_user_id: session.user.id,
            p_agent_id: finalAgentId,
            p_required_access: 'read'
          })

        if (orgAccessError || !orgAccess) {
          console.log('❌ Unified Chat API: No access to agent:', orgAccessError)
          return NextResponse.json(
            { error: 'Access denied to this agent' },
            { status: 403 }
          )
        }
        
        userAccess = { access_level: 'read' }
      }

      // Find existing conversation or create new one
      const { data: existingConversation, error: convError } = await supabaseServer
        .from('conversations')
        .select('id, agent_id, title, status')
        .eq('user_id', session.user.id)
        .eq('agent_id', finalAgentId)
        .eq('conversation_type', 'chat')
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single()

      if (convError && convError.code !== 'PGRST116') {
        console.error('❌ Unified Chat API: Error finding conversation:', convError)
        return NextResponse.json(
          { error: 'Failed to find conversation' },
          { status: 500 }
        )
      }

      if (existingConversation) {
        finalConversationId = existingConversation.id
        console.log('✅ Unified Chat API: Found existing conversation:', finalConversationId)
      } else {
        // Create new conversation
        console.log('📝 Unified Chat API: Creating new conversation for agent:', finalAgentId)
        
        const conversationTitle = content.length > 50 
          ? content.substring(0, 50) + '...' 
          : content

        const { data: newConversation, error: createError } = await supabaseServer
          .from('conversations')
          .insert({
            user_id: session.user.id,
            agent_id: finalAgentId,
            conversation_type: 'chat',
            title: conversationTitle,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .select('id, agent_id, title, created_at, updated_at, last_message_at')
          .single()

        if (createError || !newConversation) {
          console.error('❌ Unified Chat API: Failed to create conversation:', createError)
          return NextResponse.json(
            { error: 'Failed to create conversation' },
            { status: 500 }
          )
        }

        finalConversationId = newConversation.id
        finalAgentId = newConversation.agent_id
        console.log('✅ Unified Chat API: Created new conversation:', finalConversationId)
      }
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
      .eq('id', finalConversationId)
      .eq('user_id', session.user.id)
      .eq('conversation_type', 'chat')
      .single()

    if (convError || !conversation) {
      console.log('❌ Unified Chat API: Conversation not found or access denied:', convError)
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    console.log('✅ Unified Chat API: Conversation verified:', conversation.id)

    // Calculate user input tokens
    const { estimateTokenCount } = await import('@/lib/token-utils')
    const userInputTokens = estimateTokenCount(content.trim())

    // Encrypt user message
    const userMessageEncrypted = encryptText(content.trim())
    const userMessageHash = hashForIndex(content.trim())

    // Save user message with actual token count using safe function
    const { data: userMessage, error: userMsgError } = await supabaseServer
      .rpc('insert_message_safe', {
        p_conversation_id: finalConversationId,
        p_content_encrypted: userMessageEncrypted,
        p_content_hash: userMessageHash,
        p_sender_type: 'user',
        p_message_type: message_type,
        p_metadata_encrypted: encryptObject({
          input_tokens: userInputTokens,
          message_length: content.trim().length
        }),
        p_tokens_used: userInputTokens,
        p_processing_time_ms: 0,
        p_encryption_version: 'v1'
      })

    if (userMsgError) {
      console.error('❌ Unified Chat API: Failed to save user message:', userMsgError)
      return NextResponse.json(
        { error: 'Failed to save user message' },
        { status: 500 }
      )
    }

    // Extract the first result from the RPC function response
    const userMessageResult = Array.isArray(userMessage) ? userMessage[0] : userMessage
    console.log('✅ Unified Chat API: Saved user message:', userMessageResult?.id)

    // Get conversation context for AI processing
    const conversationContext = await getConversationContext(finalConversationId, conversation.agent_id)
    
    if (!conversationContext) {
      console.log('❌ Unified Chat API: Failed to get conversation context')
      return NextResponse.json(
        { error: 'Failed to get conversation context' },
        { status: 500 }
      )
    }
    
    console.log('✅ Unified Chat API: Got conversation context, processing with enhanced AI agent')
    
    // Process with enhanced AI agent (with fallback to standard agent)
    const agentResponse = await processWithEnhancedAgent(conversationContext, content.trim())
    console.log('✅ Unified Chat API: Enhanced AI agent response received')

    // Encrypt agent response
    const agentMessageEncrypted = encryptText(agentResponse.content)
    const agentMessageHash = hashForIndex(agentResponse.content)

    // Prepare comprehensive metadata for encryption
    const comprehensiveMetadata = {
      // Basic response data
      tokens_used: agentResponse.tokens_used,
      processing_time_ms: agentResponse.processing_time_ms,
      confidence_score: agentResponse.metadata?.confidence_score,
      files_referenced: agentResponse.metadata?.files_referenced,
      
      // SQL and visualization data
      sql_queries: agentResponse.sql_queries,
      graph_data: agentResponse.graph_data,
      
      // XAI data
      xai_metrics: agentResponse.xai_metrics,
      agent_thinking_notes: agentResponse.agent_thinking_notes,
      reasoning_explanation: agentResponse.reasoning_explanation,
      
      // Token tracking
      token_tracking: agentResponse.token_tracking,
      user_input_tokens: agentResponse.token_tracking?.userInputTokens || 0,
      system_prompt_tokens: agentResponse.token_tracking?.systemPromptTokens || 0,
      context_tokens: agentResponse.token_tracking?.contextTokens || 0,
      router_agent_tokens: agentResponse.token_tracking?.routerAgentTokens || 0,
      qa_agent_tokens: agentResponse.token_tracking?.qaAgentTokens || 0,
      file_content_tokens: agentResponse.token_tracking?.fileContentTokens || 0,
      conversation_history_tokens: agentResponse.token_tracking?.conversationHistoryTokens || 0,
      total_input_tokens: agentResponse.token_tracking?.totalInputTokens || 0,
      total_processing_tokens: agentResponse.token_tracking?.totalProcessingTokens || 0,
      total_output_tokens: agentResponse.token_tracking?.totalOutputTokens || 0
    }
    
    console.log('🔍 Saving to database:', {
      hasSqlQueries: !!agentResponse.sql_queries,
      hasGraphData: !!agentResponse.graph_data,
      sqlQueriesValue: agentResponse.sql_queries,
      graphDataValue: agentResponse.graph_data,
      metadataKeys: Object.keys(comprehensiveMetadata)
    })

    // Save agent response with simplified structure using safe function
    const { data: agentMessage, error: agentMsgError } = await supabaseServer
      .rpc('insert_message_safe', {
        p_conversation_id: finalConversationId,
        p_content_encrypted: agentMessageEncrypted,
        p_content_hash: agentMessageHash,
        p_sender_type: 'agent',
        p_message_type: 'text',
        p_metadata_encrypted: encryptObject(comprehensiveMetadata),
        p_tokens_used: agentResponse.tokens_used || 0,
        p_processing_time_ms: agentResponse.processing_time_ms || 0,
        p_encryption_version: 'v1',
        p_confidence_score: agentResponse.xai_metrics?.confidence_score || agentResponse.metadata?.confidence_score,
        p_analysis_depth: agentResponse.analysis_depth,
        p_data_quality_score: agentResponse.data_quality_score,
        p_response_completeness_score: agentResponse.response_completeness_score,
        p_user_satisfaction_prediction: agentResponse.user_satisfaction_prediction
      })

    if (agentMsgError) {
      console.error('❌ Unified Chat API: Failed to save agent message:', agentMsgError)
      return NextResponse.json(
        { error: 'Failed to save agent message' },
        { status: 500 }
      )
    }

    // Extract the first result from the RPC function response
    const agentMessageResult = Array.isArray(agentMessage) ? agentMessage[0] : agentMessage
    console.log('✅ Unified Chat API: Saved agent message:', agentMessageResult?.id)

    // Update conversation last_message_at
    await supabaseServer
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', finalConversationId)

    // Deduct credits for the AI processing
    const { calculateCreditsForTokens, deductCredits, logCreditUsage } = await import('@/lib/credit-utils')
    const creditsUsed = calculateCreditsForTokens(agentResponse.tokens_used || 0)
    
    if (creditsUsed > 0) {
      console.log(`💳 Deducting ${creditsUsed} credits for ${agentResponse.tokens_used} tokens used`)
      
      const creditResult = await deductCredits(
        session.user.id, 
        creditsUsed, 
        `AI Agent Usage - ${conversation.ai_agents?.[0]?.name || 'Unknown Agent'}`
      )
      
      if (!creditResult.success) {
        console.error('❌ Credit deduction failed:', creditResult.error)
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ Successfully deducted ${creditsUsed} credits. Remaining: ${creditResult.remainingCredits}`)
        
        // Log credit usage for analytics
        await logCreditUsage(
          session.user.id,
          conversation.agent_id,
          finalConversationId,
          agentResponse.tokens_used || 0,
          creditsUsed,
          `AI Agent Usage - ${conversation.ai_agents?.[0]?.name || 'Unknown Agent'}`
        )
      }
    }

    console.log('✅ Unified Chat API: Message processing completed successfully')

    // Get the updated conversation with all messages
    const { data: updatedConversation, error: fetchConvError } = await supabaseServer
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
          created_at,
          updated_at,
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
      .eq('id', finalConversationId)
      .single()

    if (fetchConvError || !updatedConversation) {
      console.error('❌ Unified Chat API: Failed to fetch updated conversation:', fetchConvError)
      return NextResponse.json(
        { error: 'Failed to fetch updated conversation' },
        { status: 500 }
      )
    }

    // Fetch all messages for this conversation
    const { data: allMessages, error: messagesError } = await supabaseServer
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_type,
        content_encrypted,
        content_hash,
        message_type,
        metadata_encrypted,
        tokens_used,
        processing_time_ms,
        encryption_version,
        created_at
      `)
      .eq('conversation_id', finalConversationId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('❌ Unified Chat API: Failed to fetch messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Decrypt and transform messages
    const { decryptText, decryptObject } = await import('@/lib/encryption')
    const decryptedMessages = (allMessages || []).map((msg) => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted
          ? decryptObject(msg.metadata_encrypted)
          : {}

        // All data is now in the decrypted metadata
        console.log('🔍 Decrypted metadata for message:', msg.id, {
          metadataKeys: Object.keys(decryptedMetadata),
          hasSqlQueries: !!decryptedMetadata.sql_queries,
          hasGraphData: !!decryptedMetadata.graph_data,
          sqlQueriesValue: decryptedMetadata.sql_queries,
          graphDataValue: decryptedMetadata.graph_data
        })

        return {
          id: msg.id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: decryptedContent,
          created_at: msg.created_at,
          metadata: decryptedMetadata,
        }
      } catch (decryptError) {
        console.error('Error decrypting message:', decryptError)
        return {
          id: msg.id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: '[Message could not be decrypted]',
          created_at: msg.created_at,
          metadata: {},
        }
      }
    })

    // Transform the conversation to match the chat client interface
    const transformedConversation = {
      id: updatedConversation.id,
      title: updatedConversation.title,
      created_at: updatedConversation.created_at,
      updated_at: updatedConversation.updated_at,
      last_message_at: updatedConversation.last_message_at,
      agent: {
        id: (Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents).id,
        name: (Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents).name,
        description: (Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents).description,
        workspace_id: (() => {
          const agent = Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents;
          if (agent && Array.isArray(agent.workspaces)) {
            return agent.workspaces[0]?.id;
          }
          if (agent && agent.workspaces && typeof agent.workspaces === 'object' && 'id' in agent.workspaces) {
            return (agent.workspaces as { id: string }).id;
          }
          return undefined;
        })(),
        agent_type: 'chat',
        status: 'active',
        config: {},
        data_sources: [],
        created_by: '',
        created_at: (Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents).created_at || new Date().toISOString(),
        updated_at: (Array.isArray(updatedConversation.ai_agents) ? updatedConversation.ai_agents[0] : updatedConversation.ai_agents).updated_at || new Date().toISOString()
      },
      messages: decryptedMessages
    }

    // Return response
    return NextResponse.json({
      success: true,
      conversation: transformedConversation
    })

  } catch (error) {
    console.error('❌ Unified Chat API: Error processing message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
