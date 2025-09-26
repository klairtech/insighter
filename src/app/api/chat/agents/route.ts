import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUserSession } from '@/lib/server-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Verify user session
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }


    // First, get user's organization memberships
    const { data: memberships, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.userId)

    if (membershipError) {
      console.error('Error fetching user memberships:', membershipError)
      return NextResponse.json(
        { error: 'Failed to fetch user memberships' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        agents: []
      })
    }

    const organizationIds = memberships.map(m => m.organization_id)

    // Get all workspaces in user's organizations first
    const { data: userWorkspaces, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('id, name, organization_id')
      .in('organization_id', organizationIds)

    if (workspaceError) {
      console.error('Error fetching user workspaces:', workspaceError)
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      )
    }

    if (!userWorkspaces || userWorkspaces.length === 0) {
      return NextResponse.json({
        agents: []
      })
    }

    const workspaceIds = userWorkspaces.map(w => w.id)

    // Get agents from those workspaces (including inactive for debugging)
    const { data: agents, error } = await supabaseServer
      .from('ai_agents')
      .select(`
        id,
        name,
        description,
        agent_type,
        status,
        created_at,
        workspace_id
      `)
      .in('workspace_id', workspaceIds)

    if (error) {
      console.error('Error fetching accessible agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }


    // Get organization names
    const { data: organizations } = await supabaseServer
      .from('organizations')
      .select('id, name')
      .in('id', organizationIds)

    const orgMap = new Map((organizations || []).map(org => [org.id, org.name]))
    const workspaceMap = new Map(userWorkspaces.map(ws => [ws.id, ws]))

    // Filter to only active agents and transform to match frontend expectations
    const activeAgents = (agents || []).filter(agent => agent.status === 'active')
    const transformedAgents = activeAgents.map(agent => {
      const workspace = workspaceMap.get(agent.workspace_id)
      const orgName = workspace?.organization_id ? orgMap.get(workspace.organization_id) : 'Unknown Organization'
      
      
      return {
        agent_id: agent.id,
        agent_name: agent.name,
        agent_description: agent.description,
        workspace_name: workspace?.name || 'Unknown Workspace',
        organization_name: orgName || 'Unknown Organization',
        access_level: 'chat',
        last_conversation_at: null,
        unread_count: 0
      }
    })

    return NextResponse.json({
      agents: transformedAgents
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60',
      }
    })
  } catch (error) {
    console.error('Error in chat agents GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
