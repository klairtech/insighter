import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'

export async function GET() {
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
      .eq('conversation_type', 'chat')
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
      title: conv.title,
      status: conv.status,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message_at: conv.last_message_at,
      agent: {
        agent_id: (Array.isArray(conv.ai_agents) ? conv.ai_agents[0] : conv.ai_agents).id,
        agent_name: (Array.isArray(conv.ai_agents) ? conv.ai_agents[0] : conv.ai_agents).name,
        agent_description: (Array.isArray(conv.ai_agents) ? conv.ai_agents[0] : conv.ai_agents).description,
        workspace_name: (() => {
          const agent = Array.isArray(conv.ai_agents) ? conv.ai_agents[0] : conv.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.name;
        })(),
        organization_name: (() => {
          const agent = Array.isArray(conv.ai_agents) ? conv.ai_agents[0] : conv.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.organizations?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.organizations?.name;
        })(),
        access_level: 'chat', // Default for existing conversations
        last_conversation_at: conv.last_message_at,
        unread_count: 0 // Will be calculated separately if needed
      },
      messages: [] // Will be loaded separately
    })) || []

    return NextResponse.json({
      conversations: transformedConversations
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, s-maxage=30',
      }
    })
  } catch (error) {
    console.error('Error in chat conversations GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Conversation Creation API: Starting request')
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔍 Conversation Creation API: Session check result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message
    })
    
    if (sessionError || !session?.user) {
      console.log('❌ Conversation Creation API: Unauthorized - no valid session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { agent_id } = body

    console.log('🔍 Conversation Creation API: Request body:', {
      agent_id,
      body
    })

    if (!agent_id) {
      console.log('❌ Conversation Creation API: Missing agent_id')
      return NextResponse.json(
        { error: 'agent_id is required' },
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
      console.log('❌ Conversation Creation API: Access denied for agent:', agent_id)
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    console.log('✅ Conversation Creation API: User has access to agent:', agent_id)


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
      .eq('conversation_type', 'chat')
      .eq('status', 'active')
      .single()

    if (existingConversation && !existingError) {
      // Return existing conversation
      const transformedConversation = {
        id: existingConversation.id,
        user_id: existingConversation.user_id,
        agent_id: existingConversation.agent_id,
        title: existingConversation.title,
        status: existingConversation.status,
        created_at: existingConversation.created_at,
        updated_at: existingConversation.updated_at,
        last_message_at: existingConversation.last_message_at,
        agent: {
        agent_id: (Array.isArray(existingConversation.ai_agents) ? existingConversation.ai_agents[0] : existingConversation.ai_agents).id,
        agent_name: (Array.isArray(existingConversation.ai_agents) ? existingConversation.ai_agents[0] : existingConversation.ai_agents).name,
        agent_description: (Array.isArray(existingConversation.ai_agents) ? existingConversation.ai_agents[0] : existingConversation.ai_agents).description,
        workspace_name: (() => {
          const agent = Array.isArray(existingConversation.ai_agents) ? existingConversation.ai_agents[0] : existingConversation.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.name;
        })(),
        organization_name: (() => {
          const agent = Array.isArray(existingConversation.ai_agents) ? existingConversation.ai_agents[0] : existingConversation.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.organizations?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.organizations?.name;
        })(),
          access_level: 'read',
          last_conversation_at: existingConversation.last_message_at,
          unread_count: 0
        },
        messages: []
      }

      return NextResponse.json({ conversation: transformedConversation })
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabaseServer
      .from('conversations')
      .insert([{
        user_id: session.user.id,
        agent_id: agent_id,
        conversation_type: 'chat',
        title: 'New Conversation',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      }])
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
      title: newConversation.title,
      status: newConversation.status,
      created_at: newConversation.created_at,
      updated_at: newConversation.updated_at,
      last_message_at: newConversation.last_message_at,
      agent: {
        agent_id: (Array.isArray(newConversation.ai_agents) ? newConversation.ai_agents[0] : newConversation.ai_agents).id,
        agent_name: (Array.isArray(newConversation.ai_agents) ? newConversation.ai_agents[0] : newConversation.ai_agents).name,
        agent_description: (Array.isArray(newConversation.ai_agents) ? newConversation.ai_agents[0] : newConversation.ai_agents).description,
        workspace_name: (() => {
          const agent = Array.isArray(newConversation.ai_agents) ? newConversation.ai_agents[0] : newConversation.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.name;
        })(),
        organization_name: (() => {
          const agent = Array.isArray(newConversation.ai_agents) ? newConversation.ai_agents[0] : newConversation.ai_agents;
          const workspaces = agent?.workspaces;
          if (Array.isArray(workspaces)) {
            return workspaces[0]?.organizations?.name;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (workspaces as any)?.organizations?.name;
        })(),
        access_level: 'read',
        last_conversation_at: newConversation.last_message_at,
        unread_count: 0
      },
      messages: []
    }

    return NextResponse.json({ conversation: transformedConversation })
  } catch (error) {
    console.error('Error in chat conversations POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
