import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
  if (!supabaseServer) {
    return null
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error('Agent API token verification error:', err)
    return null
  }
}

// Helper function to check workspace access
async function checkWorkspaceAccess(userId: string, workspaceId: string) {
  try {
    // First get the workspace to find its organization
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return { hasAccess: false, role: null, workspaceExists: false }
    }

    // Check if user has organization-level access
    const { data: orgMembership } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single()

    // Check if user has workspace-specific access
    const { data: workspaceMembership } = await supabaseServer
      .from('workspace_members')
      .select('role')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    // User has access if they have either organization or workspace-specific access
    const membership = orgMembership || workspaceMembership
    if (!membership) {
      return { hasAccess: false, role: null, workspaceExists: true }
    }

    return { hasAccess: true, role: membership.role, workspaceExists: true }
  } catch (err) {
    console.error('Error checking workspace access:', err)
    return { hasAccess: false, role: null, workspaceExists: true }
  }
}

// GET - Get workspace agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: workspaceId } = await params

    // Check if user has access to this workspace
    const { hasAccess, workspaceExists } = await checkWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      if (!workspaceExists) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Access denied to this workspace' },
        { status: 403 }
      )
    }

    // Get workspace agent
    const { data: agent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        // No agent found - this is normal for workspaces without data sources
        return NextResponse.json(null, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          }
        })
      }
      console.error('Error fetching agent:', agentError)
      return NextResponse.json(
        { error: 'Failed to fetch agent' },
        { status: 500 }
      )
    }

    return NextResponse.json(agent, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Error in agent GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update workspace agent (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: workspaceId } = await params

    // Check if user has access and appropriate role
    const { hasAccess, role, workspaceExists } = await checkWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      if (!workspaceExists) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Access denied to this workspace' },
        { status: 403 }
      )
    }

    // Only owners can update agents
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace owners can update agents' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    // Update agent
    const { data: updatedAgent, error: updateError } = await supabaseServer
      .from('ai_agents')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedAgent, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error in agent PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
