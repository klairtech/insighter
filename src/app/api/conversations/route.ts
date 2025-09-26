import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'

export async function GET(request: NextRequest) {
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

    // Get conversation type from query params (default to 'chat')
    const { searchParams } = new URL(request.url)
    const conversationType = searchParams.get('type') || 'chat'

    // Validate conversation type
    if (!['chat', 'api'].includes(conversationType)) {
      return NextResponse.json(
        { error: 'Invalid conversation type. Must be "chat" or "api"' },
        { status: 400 }
      )
    }

    // Get user's conversations with agent details
    const { data: conversations, error } = await supabaseServer
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
      .eq('conversation_type', conversationType)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    // Transform the data to match our interface
    const transformedConversations = conversations?.map(conv => ({
      id: conv.id,
      user_id: conv.user_id,
      agent_id: conv.agent_id,
      conversation_type: conv.conversation_type,
      title: conv.title,
      status: conv.status,
      external_conversation_id: conv.external_conversation_id,
      api_metadata: conv.api_metadata,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message_at: conv.last_message_at,
      agent: {
        agent_id: conv.ai_agents[0].id,
        agent_name: conv.ai_agents[0].name,
        agent_description: conv.ai_agents[0].description,
        workspace_name: conv.ai_agents[0].workspaces[0].name,
        organization_name: conv.ai_agents[0].workspaces[0].organizations.name,
        access_level: 'read', // Default for existing conversations
        last_conversation_at: conv.last_message_at,
        unread_count: 0 // Will be calculated separately if needed
      },
      messages: [] // Will be loaded separately
    })) || []

    return NextResponse.json({
      conversations: transformedConversations,
      conversation_type: conversationType,
      total: transformedConversations.length
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, s-maxage=30',
      }
    })
  } catch (error) {
    console.error('Error in unified conversations GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
          agent_id: existingConversation.ai_agents[0].id,
          agent_name: existingConversation.ai_agents[0].name,
          agent_description: existingConversation.ai_agents[0].description,
          workspace_name: existingConversation.ai_agents[0].workspaces[0].name,
          organization_name: existingConversation.ai_agents[0].workspaces[0].organizations.name,
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
        agent_id: newConversation.ai_agents[0].id,
        agent_name: newConversation.ai_agents[0].name,
        agent_description: newConversation.ai_agents[0].description,
        workspace_name: newConversation.ai_agents[0].workspaces[0].name,
        organization_name: newConversation.ai_agents[0].workspaces[0].organizations.name,
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
