import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'

/**
 * AGENT SHARING API - HIERARCHICAL ACCESS CONTROL
 * ===============================================
 * 
 * This API uses the hierarchical access control system implemented in the database.
 * Access is determined by the following hierarchy:
 * 
 * Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer) → Agent (Read/Write)
 * 
 * Key Functions Used:
 * - can_user_perform_agent_action(): Checks if user can perform specific action on agent
 * - user_has_agent_access(): Checks if user has access to agent (direct or inherited)
 * - get_user_workspace_role(): Gets user's effective role in workspace
 * 
 * Access Inheritance:
 * - Organization owners/admins → Workspace admins → Agent write access
 * - Organization members → Workspace members → Agent read access
 * - Direct agent access can override inherited access
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

// Helper function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// POST - Share agent with a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent share API called');
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent share API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.log('✅ Agent share API: User authenticated:', user.userId);

    if (!supabaseServer) {
      console.log('❌ Agent share API: Database not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id: agentId } = await params
    const body = await request.json()
    const { email } = body

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to share this agent using database function
    console.log('📊 Checking agent access using database function...');
    const { data: hasAccess, error: accessError } = await supabaseServer.rpc('can_user_perform_agent_action', {
      p_user_id: user.userId,
      p_agent_id: agentId,
      p_action: 'share'
    });

    if (accessError) {
      console.error('❌ Agent share API: Error checking access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify access permissions' },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.log('❌ Agent share API: User does not have permission to share this agent');
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    console.log('✅ Agent share API: User has permission to share agent');

    // Get agent info for response
    const { data: agent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select(`
        id,
        name,
        workspace_id
      `)
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get workspace and organization info for response
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select(`
        id,
        name,
        organization_id
      `)
      .eq('id', agent.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    const { data: organization, error: organizationError } = await supabaseServer
      .from('organizations')
      .select(`
        id,
        name
      `)
      .eq('id', workspace.organization_id)
      .single()

    if (organizationError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get user by email from users table
    const { data: targetUser, error: userError } = await supabaseServer
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has access to this agent
    const { data: existingAccess } = await supabaseServer
      .from('agent_access')
      .select('id, access_level')
      .eq('user_id', targetUser.id)
      .eq('agent_id', agentId)
      .single()

    if (existingAccess) {
      return NextResponse.json(
        { error: 'User already has access to this agent' },
        { status: 409 }
      )
    }

    // Create agent access record (viewer-only access)
    const { data: accessRecord, error: createError } = await supabaseServer
      .from('agent_access')
      .insert([{
        user_id: targetUser.id,
        agent_id: agentId,
        access_level: 'read', // Viewer-only access
        granted_by: user.userId,
        granted_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (createError) {
      console.error('❌ Agent share API: Error creating agent access:', createError)
      return NextResponse.json(
        { error: 'Failed to share agent' },
        { status: 500 }
      )
    }

    console.log('✅ Agent share API: Agent shared successfully');
    return NextResponse.json({
      message: 'Agent shared successfully',
      access: {
        id: accessRecord.id,
        user_email: email,
        agent_name: agent.name,
        access_level: 'read',
        workspace_name: workspace.name,
        organization_name: organization.name
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Agent share API: Agent share error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get users who have access to this agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent access API called');
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent access API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.log('✅ Agent access API: User authenticated:', user.userId);

    if (!supabaseServer) {
      console.log('❌ Agent access API: Database not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id: agentId } = await params

    // Check if user has permission to view access list using database function
    console.log('📊 Checking agent access using database function...');
    const { data: hasAccess, error: accessError } = await supabaseServer.rpc('can_user_perform_agent_action', {
      p_user_id: user.userId,
      p_agent_id: agentId,
      p_action: 'view'
    });

    if (accessError) {
      console.error('❌ Agent access API: Error checking access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify access permissions' },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.log('❌ Agent access API: User does not have access to this agent');
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    console.log('✅ Agent access API: User has access to view agent access list');

    // Get all users who have access to this agent (without joins)
    const { data: accessListRaw, error: accessListError } = await supabaseServer
      .from('agent_access')
      .select(`
        id,
        access_level,
        granted_at,
        granted_by,
        user_id
      `)
      .eq('agent_id', agentId)
      .order('granted_at', { ascending: false })

    if (accessListError) {
      console.error('❌ Agent access API: Error fetching agent access list:', accessListError)
      return NextResponse.json(
        { error: 'Failed to fetch agent access list' },
        { status: 500 }
      )
    }

    // Get user details for all users involved
    const userIds = accessListRaw?.map(access => [access.user_id, access.granted_by]).flat().filter(Boolean) || [];
    const uniqueUserIds = [...new Set(userIds)];
    let users: Array<{ id: string; name: string; email: string }> = [];
    
    if (uniqueUserIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseServer
        .from('users')
        .select('id, email, name')
        .in('id', uniqueUserIds);

      if (usersError) {
        console.error('❌ Agent access API: Error fetching users:', usersError);
        return NextResponse.json(
          { error: 'Failed to fetch user details' },
          { status: 500 }
        );
      }

      users = usersData || [];
    }

    // Create user lookup map
    const userMap = new Map(users.map(user => [user.id, user]));

    // Combine the data
    const accessList = accessListRaw?.map(access => ({
      ...access,
      users: userMap.get(access.user_id),
      granted_by_user: userMap.get(access.granted_by)
    })) || [];

    console.log('✅ Agent access API: Returning', accessList.length, 'access records');
    return NextResponse.json(accessList)

  } catch (error) {
    console.error('❌ Agent access API: Get agent access list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove user access to agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent access removal API called');
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent access removal API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.log('✅ Agent access removal API: User authenticated:', user.userId);

    if (!supabaseServer) {
      console.log('❌ Agent access removal API: Database not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id: agentId } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to remove access using database function
    console.log('📊 Checking agent access using database function...');
    const { data: hasAccess, error: accessError } = await supabaseServer.rpc('can_user_perform_agent_action', {
      p_user_id: user.userId,
      p_agent_id: agentId,
      p_action: 'update'
    });

    if (accessError) {
      console.error('❌ Agent access removal API: Error checking access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify access permissions' },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.log('❌ Agent access removal API: User does not have permission to remove access');
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    console.log('✅ Agent access removal API: User has permission to remove access');

    // Remove agent access
    const { error: deleteError } = await supabaseServer
      .from('agent_access')
      .delete()
      .eq('agent_id', agentId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('❌ Agent access removal API: Error removing agent access:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove agent access' },
        { status: 500 }
      )
    }

    console.log('✅ Agent access removal API: Agent access removed successfully');
    return NextResponse.json({
      message: 'Agent access removed successfully'
    })

  } catch (error) {
    console.error('❌ Agent access removal API: Remove agent access error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}