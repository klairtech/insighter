import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'
import { processWithAgent, getConversationContext } from '@/lib/ai-agents'
import { encryptText, encryptObject, hashForIndex } from '@/lib/encryption'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    console.log('🔍 Agent Message API: Starting message processing')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      console.log('❌ Agent Message API: Unauthorized - no session:', sessionError)
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
      console.log('❌ Agent Message API: CHAT_ENCRYPTION_KEY not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Check if user has access to this agent
    const { data: access, error: accessError } = await supabaseServer
      .from('agent_access')
      .select('access_level')
      .eq('user_id', session.user.id)
      .eq('agent_id', agentId)
      .single()
    
    let userAccess = access

    // If no direct access found, check organization/workspace membership
    if (accessError || !userAccess) {
      console.log('No direct agent access found, checking organization/workspace membership...')
      
      try {
        // Get user's organization memberships
        const { data: orgMemberships, error: orgError } = await supabaseServer
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', session.user.id)
          .eq('status', 'active')

        console.log('🔍 Organization memberships:', { orgMemberships, orgError })

        // Get user's workspace memberships
        const { data: workspaceMemberships, error: workspaceError } = await supabaseServer
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', session.user.id)
          .eq('status', 'active')

        console.log('🔍 Workspace memberships:', { workspaceMemberships, workspaceError })

        let hasAccess = false
        let accessLevel = 'read'

        // Get agent's workspace first
        const { data: agent, error: agentError } = await supabaseServer
          .from('ai_agents')
          .select('workspace_id')
          .eq('id', agentId)
          .single()

        console.log('🔍 Agent lookup:', { agent, agentError, agentId })

        if (agentError || !agent) {
          console.log('❌ Agent not found:', agentError)
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }

        // Check organization access
        if (!orgError && orgMemberships && orgMemberships.length > 0) {
          console.log('🔍 Checking organization access...')
          const organizationIds = orgMemberships.map(m => m.organization_id)
          
          // Get agent's workspace organization
          const { data: agentWorkspace, error: workspaceError } = await supabaseServer
            .from('workspaces')
            .select('organization_id')
            .eq('id', agent.workspace_id)
            .single()

          console.log('🔍 Agent workspace organization:', { agentWorkspace, workspaceError })

          if (!workspaceError && agentWorkspace && organizationIds.includes(agentWorkspace.organization_id)) {
            hasAccess = true
            const userRole = orgMemberships.find(m => m.organization_id === agentWorkspace.organization_id)?.role
            if (userRole === 'owner' || userRole === 'admin') {
              accessLevel = 'chat'
            }
            console.log('✅ Organization access granted:', { userRole, accessLevel })
          }
        }

        // Check direct workspace access
        if (!workspaceError && workspaceMemberships && workspaceMemberships.length > 0) {
          console.log('🔍 Checking workspace access...')
          const workspaceIds = workspaceMemberships.map(m => m.workspace_id)
          
          if (workspaceIds.includes(agent.workspace_id)) {
            hasAccess = true
            const userRole = workspaceMemberships.find(m => m.workspace_id === agent.workspace_id)?.role
            if (userRole === 'owner' || userRole === 'admin') {
              accessLevel = 'chat'
            }
            console.log('✅ Workspace access granted:', { userRole, accessLevel })
          }
        }

        console.log('🔍 Final access check:', { hasAccess, accessLevel, agentWorkspaceId: agent.workspace_id })

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Access denied to this agent' },
            { status: 403 }
          )
        }

        // Create access record for future use
        await supabaseServer
          .from('agent_access')
          .upsert({
            user_id: session.user.id,
            agent_id: agentId,
            access_level: accessLevel,
            granted_by: session.user.id,
            granted_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,agent_id',
            ignoreDuplicates: true
          })

        userAccess = { access_level: accessLevel }
      } catch (error) {
        console.error('❌ Error checking organization/workspace access:', error)
        return NextResponse.json(
          { error: 'Failed to verify access permissions' },
          { status: 500 }
        )
      }
    }

    if (userAccess.access_level === 'read') {
      return NextResponse.json(
        { error: 'Read-only access to this agent' },
        { status: 403 }
      )
    }

    // Check if conversation already exists between user and agent
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
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
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
      console.log('✅ Created new conversation:', conversationId)
    } else {
      conversationId = existingConversation.id
      console.log('✅ Using existing conversation:', conversationId)
    }

    // Get conversation context for the agent
    const conversationContext = await getConversationContext(conversationId, agentId)
    
    if (!conversationContext) {
      console.error('❌ Failed to get conversation context')
      return NextResponse.json(
        { error: 'Failed to get conversation context' },
        { status: 500 }
      )
    }
    

    // Process with the AI agent
    const agentResponse = await processWithAgent(
      conversationContext,
      content.trim()
    )


    // Calculate user input tokens
    const { estimateTokenCount } = await import('@/lib/token-utils')
    const userInputTokens = estimateTokenCount(content.trim())

    // Encrypt user message
    const userMessageEncrypted = encryptText(content.trim())
    const userMessageHash = hashForIndex(content.trim())

    // Encrypt agent response
    const agentMessageEncrypted = encryptText(agentResponse.content)
    const agentMessageHash = hashForIndex(agentResponse.content)

    // Save user message with actual token count
    const { data: userMessage, error: userMsgError } = await supabaseServer
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content_encrypted: userMessageEncrypted,
        content_hash: userMessageHash,
        sender_type: 'user',
        message_type: message_type,
        metadata_encrypted: encryptObject({
          input_tokens: userInputTokens,
          message_length: content.trim().length
        }),
        tokens_used: userInputTokens,
        processing_time_ms: 0,
        encryption_version: 'v1'
      })
      .select('id, created_at')
      .single()

    if (userMsgError) {
      console.error('❌ Failed to save user message:', userMsgError)
      return NextResponse.json(
        { error: 'Failed to save user message' },
        { status: 500 }
      )
    }

    // Save agent response with comprehensive token tracking

    // Prepare XAI data for encryption
    const xaiMetricsEncrypted = agentResponse.xai_metrics ? encryptObject(agentResponse.xai_metrics as unknown as Record<string, unknown>) : null
    const agentThinkingNotesEncrypted = agentResponse.agent_thinking_notes ? encryptObject(agentResponse.agent_thinking_notes as unknown as Record<string, unknown>) : null
    const sqlQueriesEncrypted = agentResponse.sql_queries ? encryptObject(agentResponse.sql_queries as unknown as Record<string, unknown>) : null
    const graphDataEncrypted = agentResponse.graph_data ? encryptObject(agentResponse.graph_data as unknown as Record<string, unknown>) : null
    const reasoningExplanationEncrypted = agentResponse.reasoning_explanation ? encryptText(agentResponse.reasoning_explanation) : null

    // Prepare comprehensive token tracking data (stored in metadata_encrypted)
    // const tokenTrackingEncrypted = agentResponse.token_tracking ? encryptObject(agentResponse.token_tracking as unknown as Record<string, unknown>) : null

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
          processing_time_ms: agentResponse.processing_time_ms,
          confidence_score: agentResponse.metadata?.confidence_score,
          files_referenced: agentResponse.metadata?.files_referenced,
          sql_query: (agentResponse.metadata as Record<string, unknown>)?.sql_query,
          // Comprehensive token tracking
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
        }),
        tokens_used: agentResponse.tokens_used || 0,
        processing_time_ms: agentResponse.processing_time_ms || 0,
        encryption_version: 'v1',
        // XAI Data
        xai_metrics_encrypted: xaiMetricsEncrypted,
        confidence_score: agentResponse.xai_metrics?.confidence_score || agentResponse.metadata?.confidence_score,
        reasoning_explanation_encrypted: reasoningExplanationEncrypted,
        agent_thinking_notes_encrypted: agentThinkingNotesEncrypted,
        sql_queries_encrypted: sqlQueriesEncrypted,
        graph_data_encrypted: graphDataEncrypted,
        analysis_depth: agentResponse.analysis_depth,
        data_quality_score: agentResponse.data_quality_score,
        response_completeness_score: agentResponse.response_completeness_score,
        user_satisfaction_prediction: agentResponse.user_satisfaction_prediction
      })
      .select('id, created_at')
      .single()

    if (agentMsgError) {
      console.error('❌ Failed to save agent message:', agentMsgError)
      return NextResponse.json(
        { error: 'Failed to save agent message' },
        { status: 500 }
      )
    }

    // Update conversation's last_message_at
    await supabaseServer
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // Save comprehensive token usage to database
    if (agentResponse.token_tracking) {
      try {
        const { saveTokenUsageToDatabase } = await import('@/lib/token-utils-server')
        await saveTokenUsageToDatabase(
          session.user.id,
          agentResponse.token_tracking,
          'chat'
        )
      } catch (tokenError) {
        console.error('❌ Failed to save token usage:', tokenError)
        // Don't fail the request if token saving fails
      }
    }

    // Return the response
    const response = {
      conversation_id: conversationId,
      user_message: {
        id: userMessage.id,
        content: content.trim(),
        sender_type: 'user',
        message_type: message_type,
        created_at: userMessage.created_at,
        tokens_used: userInputTokens
      },
      agent_message: {
        id: agentMessage.id,
        content: agentResponse.content,
        sender_type: 'agent',
        message_type: 'text',
        created_at: agentMessage.created_at,
        metadata: {
          tokens_used: agentResponse.tokens_used,
          processing_time_ms: agentResponse.processing_time_ms,
          confidence_score: agentResponse.metadata?.confidence_score,
          files_referenced: agentResponse.metadata?.files_referenced,
          sql_query: (agentResponse.metadata as Record<string, unknown>)?.sql_query
        },
        token_tracking: agentResponse.token_tracking
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error in agent message API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
