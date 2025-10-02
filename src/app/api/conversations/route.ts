import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Conversations API: Starting request')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔍 Conversations API: Session check result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message
    })
    
    if (sessionError || !session?.user) {
      console.log('❌ Conversations API: Unauthorized - no valid session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get conversation type and agent_id from query params
    const { searchParams } = new URL(request.url)
    const conversationType = searchParams.get('type') || 'chat'
    const agentId = searchParams.get('agent_id')
    const includeMessages = searchParams.get('include_messages') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('🔍 Conversations API: Query parameters:', {
      conversationType,
      agentId,
      agentIdType: typeof agentId,
      agentIdLength: agentId?.length,
      includeMessages,
      page,
      limit
    })

    // Validate conversation type
    if (!['chat', 'api'].includes(conversationType)) {
      console.log('❌ Conversations API: Invalid conversation type:', conversationType)
      return NextResponse.json(
        { error: 'Invalid conversation type. Must be "chat" or "api"' },
        { status: 400 }
      )
    }

    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get user's conversations with agent details
    let query = supabaseServer
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
        ai_agents(
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at,
          workspaces(
            id,
            name,
            organizations(
              id,
              name
            )
          )
        )
      `)
      .eq('user_id', session.user.id)
      .eq('conversation_type', conversationType)
      .eq('status', 'active')

    // Add agent_id filter if provided
    if (agentId) {
      console.log('✅ Conversations API: Filtering conversations for agent:', agentId)
      query = query.eq('agent_id', agentId)
    }

    console.log('🔍 Conversations API: Executing database query...')
    
    // First, let's check what conversations exist for this user without agent filtering
    const { data: allConversations, error: allConversationsError } = await supabaseServer
      .from('conversations')
      .select('id, agent_id, title, conversation_type')
      .eq('user_id', session.user.id)
      .eq('conversation_type', conversationType)
      .eq('status', 'active')
    
    console.log('🔍 Conversations API: All conversations for user:', {
      count: allConversations?.length || 0,
      conversations: allConversations?.map(c => ({ id: c.id, agent_id: c.agent_id, title: c.title })) || [],
      error: allConversationsError?.message
    })
    
    let { data: conversations, error } = await query.order('last_message_at', { ascending: false })

    console.log('🔍 Conversations API: Filtered conversations result:', {
      count: conversations?.length || 0,
      agentId: agentId,
      conversations: conversations?.map(c => ({ id: c.id, agent_id: c.agent_id, title: c.title })) || [],
      error: error?.message
    })

    // If no conversations found with agent filtering, or if conversations exist but missing agent data, try without the complex joins
    if (((!conversations || conversations.length === 0) || (conversations && conversations.some(c => !c.ai_agents || c.ai_agents.length === 0))) && agentId && !error) {
      console.log('🔍 Conversations API: Conversations found but missing agent data, trying simple query...')
      const { data: simpleConversations, error: simpleError } = await supabaseServer
        .from('conversations')
        .select('id, user_id, agent_id, conversation_type, title, status, external_conversation_id, api_metadata, created_at, updated_at, last_message_at')
        .eq('user_id', session.user.id)
        .eq('conversation_type', conversationType)
        .eq('status', 'active')
        .eq('agent_id', agentId)
        .order('last_message_at', { ascending: false })
      
      console.log('🔍 Conversations API: Simple query result:', {
        count: simpleConversations?.length || 0,
        conversations: simpleConversations?.map(c => ({ id: c.id, agent_id: c.agent_id, title: c.title })) || [],
        error: simpleError?.message
      })
      
      if (simpleConversations && simpleConversations.length > 0) {
        // Use the simple conversations and fetch agent data separately
        const agentIds = [...new Set(simpleConversations.map(c => c.agent_id))]
        const { data: agentsData, error: agentsError } = await supabaseServer
          .from('ai_agents')
          .select(`
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at,
            workspaces(
              id,
              name,
              organizations(
                id,
                name
              )
            )
          `)
          .in('id', agentIds)
        
        console.log('🔍 Conversations API: Agent data for simple conversations:', {
          count: agentsData?.length || 0,
          agents: agentsData?.map(a => ({ id: a.id, name: a.name })) || [],
          error: agentsError?.message
        })
        
        // Combine the data
        const enrichedConversations = simpleConversations.map(conv => {
          const agent = agentsData?.find(a => a.id === conv.agent_id)
          return {
            ...conv,
            ai_agents: agent ? [agent] : []
          }
        })
        
        // Use the enriched conversations
        conversations = enrichedConversations
        error = null
      }
    }

    if (error) {
      console.error('❌ Conversations API: Error fetching conversations:', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        query: {
          conversationType,
          agentId,
          userId: session.user.id
        }
      })
      return NextResponse.json(
        { error: 'Failed to fetch conversations', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Conversations API: Found conversations:', conversations?.length || 0)

    // Check if we need to fetch agent data separately
    // Force the fallback if we have conversations but they're missing agent data
    const needsAgentData = conversations && conversations.length > 0 && conversations.some(c => {
      const hasNoAgents = !c.ai_agents || c.ai_agents.length === 0
      console.log('🔍 Conversations API: Individual conversation check:', {
        id: c.id,
        ai_agents: c.ai_agents,
        hasNoAgents,
        type: typeof c.ai_agents,
        isArray: Array.isArray(c.ai_agents)
      })
      return hasNoAgents
    })
    
    // Force fallback if we have conversations but they're missing agent data
    const forceFallback = conversations && conversations.length > 0 && conversations.some(c => !c.ai_agents || c.ai_agents.length === 0)
    console.log('🔍 Conversations API: Needs agent data check:', {
      hasConversations: !!conversations,
      conversationsLength: conversations?.length || 0,
      needsAgentData,
      forceFallback,
      conversationChecks: conversations?.map(c => ({
        id: c.id,
        hasAiAgents: !!c.ai_agents,
        aiAgentsLength: c.ai_agents?.length || 0,
        condition: !c.ai_agents || c.ai_agents.length === 0
      })) || []
    })

    // If conversations exist but are missing agent data, fetch agent data separately
    if (forceFallback) {
      console.log('🔍 Conversations API: Detected missing agent data, fetching separately...')
      console.log('🔍 Conversations API: Conversation agent data status:', conversations?.map(c => ({ 
        id: c.id, 
        hasAgents: !!c.ai_agents, 
        agentsLength: c.ai_agents?.length || 0 
      })) || [])
      const agentIds = [...new Set(conversations?.map(c => c.agent_id) || [])]
      const { data: agentsData, error: agentsError } = await supabaseServer
        .from('ai_agents')
        .select(`
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at,
          workspaces(
            id,
            name,
            organizations(
              id,
              name
            )
          )
        `)
        .in('id', agentIds)
      
      console.log('🔍 Conversations API: Fetched agent data:', {
        count: agentsData?.length || 0,
        agents: agentsData?.map(a => ({ id: a.id, name: a.name })) || [],
        error: agentsError?.message
      })
      
      // Enrich conversations with agent data
      conversations = conversations?.map(conv => {
        const agent = agentsData?.find(a => a.id === conv.agent_id)
        const enrichedConv = {
          ...conv,
          ai_agents: agent ? [agent] : []
        }
        console.log('🔍 Conversations API: Enriched conversation:', {
          id: enrichedConv.id,
          hasAgents: !!enrichedConv.ai_agents,
          agentsLength: enrichedConv.ai_agents?.length || 0,
          agentId: enrichedConv.agent_id
        })
        return enrichedConv
      }) || []
    }

    // Initialize pagination variables
    let totalMessagesCount = 0
    const offset = (page - 1) * limit

    // If messages are requested, fetch them separately for each conversation
    if (includeMessages && conversations && conversations.length > 0) {
      try {
        console.log('🔍 Conversations API: Fetching messages for conversations...')
        const conversationIds = conversations.map(conv => conv.id)
        console.log('🔍 Conversations API: Conversation IDs:', conversationIds)
        console.log('🔍 Conversations API: Pagination params:', { page, limit, offset })
        
        // Get total count of messages for pagination metadata
        const { count: messagesCount } = await supabaseServer
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
        
        totalMessagesCount = messagesCount || 0
        
        const { data: messages, error: messagesError } = await supabaseServer
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
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (messagesError) {
          console.error('Error fetching messages:', messagesError)
          // Continue without messages rather than failing completely
        } else {
          console.log('🔍 Conversations API: Fetched messages:', {
            messageCount: messages?.length || 0,
            messageIds: messages?.map(m => m.id) || [],
            firstMessageId: messages?.[0]?.id,
            lastMessageId: messages?.[messages.length - 1]?.id
          })
          // Import decryption functions
          const { decryptText, decryptObject } = await import('@/lib/encryption')
          
          // Decrypt and transform messages
          const decryptedMessages = (messages || []).map((msg) => {
            try {
              const decryptedContent = decryptText(msg.content_encrypted)
              const decryptedMetadata = msg.metadata_encrypted
                ? decryptObject(msg.metadata_encrypted)
                : {}

              // All data is now in the decrypted metadata

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
          }).reverse() // Reverse to show oldest first in chat

          // Group messages by conversation_id
          const messagesByConversation = new Map()
          decryptedMessages.forEach(message => {
            // Find the original message to get conversation_id
            const originalMsg = messages.find(m => m.id === message.id)
            if (originalMsg) {
              if (!messagesByConversation.has(originalMsg.conversation_id)) {
                messagesByConversation.set(originalMsg.conversation_id, [])
              }
              messagesByConversation.get(originalMsg.conversation_id).push(message)
            }
          })

          // Add messages to conversations
          conversations.forEach(conversation => {
            const conversationMessages = messagesByConversation.get(conversation.id) || [];
            (conversation as Record<string, unknown>).messages = conversationMessages;
          });
        }
      } catch (messagesError) {
        console.error('Error processing messages:', messagesError)
        // Continue without messages rather than failing completely
      }
    }

    // Transform the data to match the chat client interface
    console.log('🔍 Conversations API: Before transformation, conversation data:', conversations?.map(c => ({
      id: c.id,
      hasAgents: !!c.ai_agents,
      agentsLength: c.ai_agents?.length || 0,
      agentId: c.agent_id
    })))
    
    const transformedConversations = conversations?.map(conv => {
      // Safely access the nested data with proper error handling
      // Handle both cases: ai_agents as object or array
      let agent
      if (Array.isArray(conv.ai_agents)) {
        agent = conv.ai_agents[0]
      } else if (conv.ai_agents && typeof conv.ai_agents === 'object') {
        agent = conv.ai_agents
      }
      
      const workspace = agent?.workspaces?.[0] || agent?.workspaces
      
      if (!agent) {
        console.error('❌ Conversations API: Missing agent data for conversation:', conv.id, {
          hasAiAgents: !!conv.ai_agents,
          aiAgentsType: typeof conv.ai_agents,
          isArray: Array.isArray(conv.ai_agents),
          agentId: conv.agent_id
        })
        return null
      }
      
      return {
        id: conv.id,
        title: conv.title,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_at: conv.last_message_at,
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          workspace_id: workspace?.id || null,
          agent_type: 'chat', // Default type for conversations
          status: 'active',
          config: {},
          data_sources: [],
          created_by: agent.created_by || '',
          created_at: agent.created_at,
          updated_at: agent.updated_at
        },
        messages: (conv as Record<string, unknown>).messages || [] // Use fetched messages or empty array
      }
    }).filter(Boolean) || []

    console.log('✅ Conversations API: Returning response with', transformedConversations?.length || 0, 'conversations')
    
    // Calculate pagination metadata
    const hasMoreMessages = totalMessagesCount ? (offset + limit) < totalMessagesCount : false
    const currentPage = page
    const totalPages = totalMessagesCount ? Math.ceil(totalMessagesCount / limit) : 1
    
    return NextResponse.json({
      conversations: transformedConversations,
      conversation_type: conversationType,
      total: transformedConversations.length,
      pagination: {
        currentPage,
        totalPages,
        hasMoreMessages,
        totalMessages: totalMessagesCount || 0,
        limit
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, s-maxage=30',
      }
    })
  } catch (error) {
    console.error('❌ Conversations API: Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Unified Conversation Creation API: Starting request')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔍 Unified Conversation Creation API: Session check result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    })
    
    if (sessionError || !session?.user) {
      console.log('❌ Unified Conversation Creation API: Unauthorized - no session:', sessionError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { agent_id, conversation_type = 'chat', title, external_conversation_id, api_metadata } = body

    console.log('🔍 Unified Conversation Creation API: Request body:', {
      agent_id,
      conversation_type,
      title,
      external_conversation_id,
      api_metadata,
      body
    })

    if (!agent_id) {
      console.log('❌ Unified Conversation Creation API: Missing agent_id')
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    // Validate conversation type
    if (!['chat', 'api'].includes(conversation_type)) {
      console.log('❌ Unified Conversation Creation API: Invalid conversation type:', conversation_type)
      return NextResponse.json(
        { error: 'Invalid conversation type. Must be "chat" or "api"' },
        { status: 400 }
      )
    }

    // Check if user has access to this agent using hierarchical access control
    const { data: hasAccess, error: accessError } = await supabaseServer
      .rpc('user_has_agent_access', {
        p_user_id: session.user.id,
        p_agent_id: agent_id,
        p_required_access: 'read'
      })

    if (accessError || !hasAccess) {
      console.log('❌ Unified Conversation Creation API: Access denied for agent:', agent_id)
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    console.log('✅ Unified Conversation Creation API: User has access to agent:', agent_id)

    // Check if conversation already exists
    const { data: existingConversation, error: existingError } = await supabaseServer
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
      .eq('user_id', session.user.id)
      .eq('agent_id', agent_id)
      .eq('conversation_type', conversation_type)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()

    if (existingConversation && !existingError) {
      // Return existing conversation
      // Safely access the nested data with proper error handling
      // Handle both cases: ai_agents as object or array
      let agent
      if (Array.isArray(existingConversation.ai_agents)) {
        agent = existingConversation.ai_agents[0]
      } else if (existingConversation.ai_agents && typeof existingConversation.ai_agents === 'object') {
        agent = existingConversation.ai_agents
      }
      
      const workspace = agent?.workspaces?.[0] || agent?.workspaces
      const organization = workspace?.organizations?.[0] || workspace?.organizations
      
      if (!agent) {
        console.error('❌ Conversations API: Missing agent data for existing conversation:', existingConversation.id)
        return NextResponse.json(
          { error: 'Invalid conversation data' },
          { status: 500 }
        )
      }
      
      const transformedConversation = {
        id: existingConversation.id,
        user_id: existingConversation.user_id,
        agent_id: existingConversation.agent_id,
        conversation_type: existingConversation.conversation_type,
        title: existingConversation.title,
        status: existingConversation.status,
        external_conversation_id: existingConversation.external_conversation_id,
        api_metadata: existingConversation.api_metadata,
        created_at: existingConversation.created_at,
        updated_at: existingConversation.updated_at,
        last_message_at: existingConversation.last_message_at,
        agent: {
          agent_id: agent.id,
          agent_name: agent.name,
          agent_description: agent.description,
          workspace_name: workspace?.name || 'Unknown Workspace',
          organization_name: organization?.name || 'Unknown Organization',
          access_level: 'read',
          last_conversation_at: existingConversation.last_message_at,
          unread_count: 0
        },
        messages: []
      }

      return NextResponse.json({ conversation: transformedConversation })
    }

    // Create new conversation
    const conversationData: Record<string, unknown> = {
      user_id: session.user.id,
      agent_id: agent_id,
      conversation_type: conversation_type,
      title: title || 'New Conversation',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    }

    // Add API-specific fields if conversation type is 'api'
    if (conversation_type === 'api') {
      if (external_conversation_id) {
        conversationData.external_conversation_id = external_conversation_id
      }
      if (api_metadata) {
        conversationData.api_metadata = api_metadata
      }
    }

    const { data: newConversation, error: createError } = await supabaseServer
      .from('conversations')
      .insert([conversationData])
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
      .single()

    if (createError) {
      console.error('Error creating conversation:', createError)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    // Safely access the nested data with proper error handling
    // Handle both cases: ai_agents as object or array
    let agent
    if (Array.isArray(newConversation.ai_agents)) {
      agent = newConversation.ai_agents[0]
    } else if (newConversation.ai_agents && typeof newConversation.ai_agents === 'object') {
      agent = newConversation.ai_agents
    }
    
    const workspace = agent?.workspaces?.[0] || agent?.workspaces
    const organization = workspace?.organizations?.[0] || workspace?.organizations
    
    if (!agent) {
      console.error('❌ Conversations API: Missing agent data for new conversation:', newConversation.id)
      return NextResponse.json(
        { error: 'Invalid conversation data' },
        { status: 500 }
      )
    }
    
    const transformedConversation = {
      id: newConversation.id,
      user_id: newConversation.user_id,
      agent_id: newConversation.agent_id,
      conversation_type: newConversation.conversation_type,
      title: newConversation.title,
      status: newConversation.status,
      external_conversation_id: newConversation.external_conversation_id,
      api_metadata: newConversation.api_metadata,
      created_at: newConversation.created_at,
      updated_at: newConversation.updated_at,
      last_message_at: newConversation.last_message_at,
      agent: {
        agent_id: agent.id,
        agent_name: agent.name,
        agent_description: agent.description,
        workspace_name: workspace?.name || 'Unknown Workspace',
        organization_name: organization?.name || 'Unknown Organization',
        access_level: 'read',
        last_conversation_at: newConversation.last_message_at,
        unread_count: 0
      },
      messages: []
    }

    console.log('✅ Unified Conversation Creation API: Conversation created successfully:', newConversation.id)
    return NextResponse.json({ conversation: transformedConversation }, { status: 201 })

  } catch (error) {
    console.error('Error in unified conversation creation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
