import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, checkRateLimit } from '@/lib/server-utils'
import { getRandomAgentAvatar } from '@/lib/agent-avatars'
import { addOrganizationMembersToWorkspace } from '@/lib/workspace-inheritance'

// Helper function to create agent for new workspace
async function createWorkspaceAgent(workspaceId: string, userId: string, workspaceName: string) {
  try {
    if (!supabaseServer) {
      throw new Error('Database not configured');
    }

    // Get a random avatar for the new agent
    const randomAvatar = getRandomAgentAvatar()
    
    const { data: newAgent, error: agentCreateError } = await supabaseServer
      .from('ai_agents')
      .insert([{
        name: `${workspaceName} Agent`,
        description: 'AI agent for analyzing workspace data and answering questions',
        workspace_id: workspaceId,
        agent_type: 'data_analyzer',
        status: 'active',
        config: {
          avatar: {
            image: randomAvatar.image,
            name: randomAvatar.name
          }
        },
        data_sources: [],
        created_by: userId
      }])
      .select('id')
      .single()

    if (!agentCreateError && newAgent) {
      // Grant access to all workspace members
      const { data: workspace } = await supabaseServer
        .from('workspaces')
        .select('organization_id')
        .eq('id', workspaceId)
        .single()

      if (workspace) {
        const { data: members } = await supabaseServer
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', workspace.organization_id)

        if (members && members.length > 0) {
          const accessRecords = members.map((member: { user_id: string }) => ({
            user_id: member.user_id,
            agent_id: newAgent.id,
            access_level: 'read',
            granted_by: userId,
            granted_at: new Date().toISOString(),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))

          await supabaseServer
            .from('agent_access')
            .insert(accessRecords)
        }
      }
    }
  } catch {
    // Silent fail - agent creation is not critical for workspace creation
  }
}

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

// Helper function to check if user has permission to create workspaces in organization
async function checkWorkspacePermission(userId: string, organizationId: string) {
  try {
    const { data: membership, error } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !membership) {
      return false
    }

    // Only organization owners can create workspaces
    return membership.role === 'owner'
  } catch (err) {
    console.error('Error checking workspace permission:', err)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Check if user has access to this organization
    const hasPermission = await checkWorkspacePermission(user.id, organizationId)
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      )
    }

    // Fetch only active workspaces for the organization
    const { data, error } = await supabaseServer
      .from('workspaces')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workspaces:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'private, max-age=30, s-maxage=30',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error in workspaces GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.organization_id) {
      return NextResponse.json(
        { error: 'Workspace name and organization ID are required' },
        { status: 400 }
      )
    }

    // Check if user has permission to create workspaces in this organization
    const hasPermission = await checkWorkspacePermission(user.id, body.organization_id)
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to create workspaces in this organization' },
        { status: 403 }
      )
    }

    // Rate limiting for POST requests
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-workspace-post`, 20, 15 * 60 * 1000) // 20 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    // Create workspace
    const { data, error } = await supabaseServer
      .from('workspaces')
      .insert([{
        name: body.name,
        description: body.description || null,
        organization_id: body.organization_id,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating workspace:', error)
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      )
    }

    // Create agent for the new workspace
    await createWorkspaceAgent(data.id, user.id, body.name)

    // Automatically add all organization members to the new workspace
    console.log(`🔄 Adding all organization members to new workspace ${data.id}`);
    const membersResult = await addOrganizationMembersToWorkspace(data.id, body.organization_id);
    
    if (!membersResult.success) {
      console.error('Error adding organization members to workspace:', membersResult.error);
      // Don't fail the request, just log the error - workspace is still created
    } else {
      console.log(`✅ Added ${membersResult.membersAdded || 0} organization members to workspace`);
    }

    return NextResponse.json({
      ...data,
      membersAdded: membersResult.membersAdded || 0
    }, { 
      status: 201,
      headers: {
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in workspaces POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
