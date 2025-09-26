import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'

/**
 * AGENT API - INDIVIDUAL AGENT OPERATIONS
 * =====================================
 * 
 * This API handles operations on individual agents including:
 * - GET: Retrieve agent details
 * - PUT: Update agent information (name, description)
 * - DELETE: Delete agent (if needed)
 * 
 * Access Control:
 * - Uses hierarchical access control system
 * - Only users with access to the agent's workspace can perform operations
 * - Update/Delete operations require appropriate permissions
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

// GET - Get agent details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent GET API called');
    
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent GET API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: agentId } = await params

    // Check if user has access to this agent using hierarchical access control
    const { data: hasAccess, error: accessError } = await supabaseServer.rpc(
      'user_has_agent_access',
      {
        p_user_id: user.userId,
        p_agent_id: agentId
      }
    )

    if (accessError) {
      console.error('❌ Agent GET API: Error checking access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify access permissions' },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.log('❌ Agent GET API: User does not have access to this agent');
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
      )
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select(`
        id,
        name,
        description,
        workspace_id,
        created_at,
        updated_at,
        workspaces (
          id,
          name,
          organization_id,
          organizations (
            id,
            name
          )
        )
      `)
      .eq('id', agentId)
      .single()

    if (agentError) {
      console.error('❌ Agent GET API: Error fetching agent:', agentError);
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    console.log('✅ Agent GET API: Agent retrieved successfully');
    return NextResponse.json(agent)

  } catch (error) {
    console.error('❌ Agent GET API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update agent details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent PUT API called');
    
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent PUT API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: agentId } = await params

    // Check if user can perform update action on this agent
    const { data: canUpdate, error: permissionError } = await supabaseServer.rpc(
      'can_user_perform_agent_action',
      {
        p_user_id: user.userId,
        p_agent_id: agentId,
        p_action: 'update'
      }
    )

    if (permissionError) {
      console.error('❌ Agent PUT API: Error checking permissions:', permissionError);
      return NextResponse.json(
        { error: 'Failed to verify permissions' },
        { status: 500 }
      )
    }

    if (!canUpdate) {
      console.log('❌ Agent PUT API: User does not have permission to update this agent');
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions to update this agent' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, description } = body

    // Validate required fields
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
      .eq('id', agentId)
      .select(`
        id,
        name,
        description,
        workspace_id,
        created_at,
        updated_at,
        workspaces (
          id,
          name,
          organization_id,
          organizations (
            id,
            name
          )
        )
      `)
      .single()

    if (updateError) {
      console.error('❌ Agent PUT API: Error updating agent:', updateError);
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    console.log('✅ Agent PUT API: Agent updated successfully');
    return NextResponse.json(updatedAgent, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })

  } catch (error) {
    console.error('❌ Agent PUT API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete agent (if needed in the future)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Agent DELETE API called');
    
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      console.log('❌ Agent DELETE API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: agentId } = await params

    // Check if user can perform delete action on this agent
    const { data: canDelete, error: permissionError } = await supabaseServer.rpc(
      'can_user_perform_agent_action',
      {
        p_user_id: user.userId,
        p_agent_id: agentId,
        p_action: 'delete'
      }
    )

    if (permissionError) {
      console.error('❌ Agent DELETE API: Error checking permissions:', permissionError);
      return NextResponse.json(
        { error: 'Failed to verify permissions' },
        { status: 500 }
      )
    }

    if (!canDelete) {
      console.log('❌ Agent DELETE API: User does not have permission to delete this agent');
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions to delete this agent' },
        { status: 403 }
      )
    }

    // Delete agent
    const { error: deleteError } = await supabaseServer
      .from('ai_agents')
      .delete()
      .eq('id', agentId)

    if (deleteError) {
      console.error('❌ Agent DELETE API: Error deleting agent:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    console.log('✅ Agent DELETE API: Agent deleted successfully');
    return NextResponse.json({ message: 'Agent deleted successfully' })

  } catch (error) {
    console.error('❌ Agent DELETE API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
