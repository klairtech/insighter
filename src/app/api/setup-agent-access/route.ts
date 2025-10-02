import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'

export async function POST() {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔧 Setting up agent access for user:', session.user.email)

    // Get user's organization memberships with role information
    const { data: orgMemberships, error: orgMembershipError } = await supabaseServer
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('status', 'active')

    // Get user's workspace memberships with role information
    const { data: workspaceMemberships, error: workspaceMembershipError } = await supabaseServer
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .eq('status', 'active')

    if ((orgMembershipError && workspaceMembershipError) || 
        (!orgMemberships?.length && !workspaceMemberships?.length)) {
      return NextResponse.json(
        { error: 'No organization or workspace memberships found' },
        { status: 404 }
      )
    }

    let workspaceIds: string[] = []
    let accessLevel = 'read' // Default access level
    let userRole = 'member'

    // Process organization memberships
    if (orgMemberships && orgMemberships.length > 0) {
      const organizationIds = orgMemberships.map(m => m.organization_id)
      
      // Check if user is owner/admin of any organizations
      const ownedOrganizations = orgMemberships.filter(m => m.role === 'owner' || m.role === 'admin')
      if (ownedOrganizations.length > 0) {
        accessLevel = 'chat'
        userRole = 'org_owner'
      }

      console.log(`User is ${userRole} of ${orgMemberships.length} organizations`)

      // Get all workspaces in user's organizations
      const { data: orgWorkspaces, error: orgWorkspaceError } = await supabaseServer
        .from('workspaces')
        .select('id, organization_id')
        .in('organization_id', organizationIds)

      if (!orgWorkspaceError && orgWorkspaces) {
        workspaceIds.push(...orgWorkspaces.map(w => w.id))
      }
    }

    // Process workspace memberships
    if (workspaceMemberships && workspaceMemberships.length > 0) {
      const directWorkspaceIds = workspaceMemberships.map(m => m.workspace_id)
      
      // Check if user is owner/admin of any workspaces
      const ownedWorkspaces = workspaceMemberships.filter(m => m.role === 'owner' || m.role === 'admin')
      if (ownedWorkspaces.length > 0) {
        accessLevel = 'chat'
        userRole = userRole === 'org_owner' ? 'org_owner' : 'workspace_owner'
      }

      console.log(`User is member of ${workspaceMemberships.length} workspaces`)
      workspaceIds.push(...directWorkspaceIds)
    }

    // Remove duplicate workspace IDs
    workspaceIds = [...new Set(workspaceIds)]

    if (workspaceIds.length === 0) {
      return NextResponse.json(
        { error: 'No accessible workspaces found' },
        { status: 404 }
      )
    }

    console.log(`Found ${workspaceIds.length} accessible workspaces`)

    // Get all agents from those workspaces
    const { data: agents, error: agentsError } = await supabaseServer
      .from('ai_agents')
      .select('id, workspace_id')
      .in('workspace_id', workspaceIds)
      .eq('status', 'active')

    if (agentsError || !agents) {
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    // Check which agents the user doesn't have access to
    const { data: existingAccess, error: accessError } = await supabaseServer
      .from('agent_access')
      .select('agent_id')
      .eq('user_id', session.user.id)
      .in('agent_id', agents.map(a => a.id))

    if (accessError) {
      return NextResponse.json(
        { error: 'Failed to check existing access' },
        { status: 500 }
      )
    }

    const existingAgentIds = new Set((existingAccess || []).map(a => a.agent_id))
    const agentsNeedingAccess = agents.filter(agent => !existingAgentIds.has(agent.id))

    if (agentsNeedingAccess.length === 0) {
      return NextResponse.json({
        message: 'User already has access to all agents',
        agentsGranted: 0
      })
    }

    // Create access records for agents the user doesn't have access to
    const accessRecords = agentsNeedingAccess.map(agent => ({
      user_id: session.user.id,
      agent_id: agent.id,
      access_level: accessLevel, // Use determined access level based on role
      granted_by: session.user.id,
      granted_at: new Date().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabaseServer
      .from('agent_access')
      .insert(accessRecords)

    if (insertError) {
      console.error('Error creating access records:', insertError)
      return NextResponse.json(
        { error: 'Failed to create access records' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Access granted to ${agentsNeedingAccess.length} agents (${userRole} - ${accessLevel} access)`,
      agentsGranted: agentsNeedingAccess.length,
      agentIds: agentsNeedingAccess.map(a => a.id),
      userRole: userRole,
      accessLevel: accessLevel
    })
  } catch (error) {
    console.error('Error in setup agent access API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
