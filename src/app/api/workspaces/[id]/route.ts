import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, checkRateLimit } from '@/lib/server-utils'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
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
    console.error('Workspace API token verification error:', err)
    return null
  }
}

// Helper function to check if user has access to workspace
async function checkWorkspaceAccess(userId: string, workspaceId: string) {
  try {
    // First get the workspace to find its organization
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      // Check if the error is because workspace doesn't exist (PGRST116) or other reasons
      if (workspaceError?.code === 'PGRST116') {
        return { hasAccess: false, role: null, workspaceExists: false }
      }
      return { hasAccess: false, role: null, workspaceExists: true }
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

// GET - Get specific workspace details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Get workspace details (only active workspaces)
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('status', 'active')
      .single()

    if (workspaceError || !workspace) {
      console.error('Error fetching workspace:', workspaceError)
      return NextResponse.json(
        { error: 'Failed to fetch workspace' },
        { status: 500 }
      )
    }

    // Add user role to workspace data
    const workspaceWithRole = {
      ...workspace,
      userRole: role
    }

    return NextResponse.json(workspaceWithRole, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60',
      }
    })
  } catch (error) {
    console.error('Error in workspace GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update workspace (admin/owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Only admins and owners can update workspaces
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace admins and organization owners can update workspaces' },
        { status: 403 }
      )
    }

    // Rate limiting for PUT requests
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-workspace-put`, 10, 15 * 60 * 1000) // 10 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    console.log(`✏️ Updating workspace "${workspaceId}" by user: ${user.email} (${user.id})`)

    // Update workspace
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .update({
        name: body.name,
        description: body.description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)
      .select()
      .single()

    if (workspaceError) {
      console.error('Error updating workspace:', workspaceError)
      return NextResponse.json(
        { error: 'Failed to update workspace' },
        { status: 500 }
      )
    }

    return NextResponse.json(workspace, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in workspace PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete workspace (admin/owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Only admins and owners can delete workspaces
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace admins and organization owners can delete workspaces' },
        { status: 403 }
      )
    }

    // Rate limiting for DELETE requests (very restrictive)
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = checkRateLimit(clientIP + '-workspace-delete', 5, 15 * 60 * 1000); // 5 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    console.log(`🗑️ Soft deleting workspace "${workspaceId}" by user: ${user.email} (${user.id})`)

    // First, get workspace name for logging
    await supabaseServer
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    // Soft delete workspace (set status to inactive)
    const { error: updateError } = await supabaseServer
      .from('workspaces')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    if (updateError) {
      console.error('Error soft deleting workspace:', updateError)
      return NextResponse.json(
        { error: 'Failed to delete workspace' },
        { status: 500 }
      )
    }

    // Soft delete all agents under this workspace
    const { error: agentsError } = await supabaseServer
      .from('ai_agents')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId)

    if (agentsError) {
      console.error('Error deactivating agents:', agentsError)
    }

    // Hard delete all data sources (for security)
    const { error: dataSourcesError } = await supabaseServer
      .from('workspace_data_sources')
      .delete()
      .eq('workspace_id', workspaceId)

    if (dataSourcesError) {
      console.error('Error deleting data sources:', dataSourcesError)
    }

    // Hard delete all files (for security)
    const { error: filesError } = await supabaseServer
      .from('file_uploads')
      .delete()
      .eq('workspace_id', workspaceId)

    if (filesError) {
      console.error('Error deleting files:', filesError)
    }

    return NextResponse.json(
      { message: 'Workspace deleted successfully' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    )
  } catch (error) {
    console.error('Error in workspace DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}