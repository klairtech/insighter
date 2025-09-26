import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';
import { checkOrganizationPermission, OrganizationRole } from '@/lib/permissions';

/**
 * WORKSPACE MEMBERS API - HIERARCHICAL ACCESS CONTROL
 * ==================================================
 * 
 * This API handles workspace membership with hierarchical access control.
 * 
 * Access Hierarchy:
 * Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer)
 * 
 * Key Features:
 * - Organization members automatically inherit workspace access
 * - Workspace-specific members can override organization-level access
 * - Access propagation is handled by database triggers
 * 
 * Database Functions Used:
 * - user_has_workspace_access(): Checks direct and inherited workspace access
 * - get_user_workspace_role(): Gets effective role (direct or inherited)
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Workspace members API called');
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      console.log('❌ Workspace members API: Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ Workspace members API: User authenticated:', decoded.userId);

    const { id: workspaceId } = await params;

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        organization_id,
        organizations (
          id
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has access to this workspace (organization or workspace-specific)
    const { data: orgMembership, error: orgMembershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', decoded.userId)
      .eq('status', 'active')
      .single();

    const { data: workspaceMembership, error: workspaceMembershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', decoded.userId)
      .eq('status', 'active')
      .single();

    const userMembership = orgMembership || workspaceMembership;
    if (!userMembership) {
      console.error('User membership check failed:', {
        userId: decoded.userId,
        organizationId: workspace.organization_id,
        workspaceId,
        orgError: orgMembershipError,
        workspaceError: workspaceMembershipError,
        userMembership
      });
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Get all users who have access to this workspace
    // This includes both organization members (inherited access) and workspace-specific members
    
    // First, get organization members without the join
    const { data: orgMembersRaw, error: orgMembersError } = await supabaseAdmin
      .from('organization_members')
      .select('id, role, created_at, user_id')
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active');

    // Get workspace members without the join
    const { data: workspaceMembersRaw, error: workspaceMembersError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, role, created_at, user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    // Get user details separately
    const allUserIds = [
      ...(orgMembersRaw?.map(m => m.user_id) || []),
      ...(workspaceMembersRaw?.map(m => m.user_id) || [])
    ];
    
    const uniqueUserIds = [...new Set(allUserIds)];
    
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, created_at')
      .in('id', uniqueUserIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
    }

    // Create a user lookup map
    const userMap = new Map(users?.map(user => [user.id, user]) || []);

    // Combine the data
    const orgMembers = orgMembersRaw?.map(member => ({
      ...member,
      users: userMap.get(member.user_id)
    })) || [];

    const workspaceMembers = workspaceMembersRaw?.map(member => ({
      ...member,
      users: userMap.get(member.user_id)
    })) || [];

    // Combine both lists, prioritizing workspace-specific members over organization members
    const workspaceMemberIds = new Set(workspaceMembers?.map(m => m.user_id) || []);
    
    // Add organization members who don't have workspace-specific access
    const inheritedMembers = orgMembers?.filter(m => !workspaceMemberIds.has(m.user_id)) || [];
    
    // Combine: workspace-specific members + inherited organization members
    const allMembers = [
      ...(workspaceMembers || []),
      ...inheritedMembers
    ];

    const membersError = orgMembersError || workspaceMembersError;

    if (membersError) {
      console.error('❌ Workspace members API: Error fetching workspace members:', {
        workspaceId,
        error: membersError,
        code: membersError.code,
        message: membersError.message,
        details: membersError.details,
        hint: membersError.hint
      });
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    console.log('✅ Workspace members API: Returning', allMembers?.length || 0, 'members');
    return NextResponse.json(allMembers || []);

  } catch (error) {
    console.error('❌ Workspace members API: Get workspace members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { memberId, role } = await request.json();

    if (!memberId || !role) {
      return NextResponse.json({ error: 'Member ID and role are required' }, { status: 400 });
    }

    // Validate role
    if (!['member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        organization_id,
        organizations (
          id
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has permission to update workspace members (must be organization owner or admin)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    const permissionCheck = checkOrganizationPermission(
      userMembership.role as OrganizationRole,
      'INVITE_MEMBERS'
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to update workspace members' }, { status: 403 });
    }

    // Check if the member has workspace-specific access or organization access
    const { data: workspaceMember, error: workspaceMemberError } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single();

    const { data: orgMember, error: orgMemberError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', workspace.organization_id)
      .single();

    if (workspaceMemberError && orgMemberError) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const targetMember = workspaceMember || orgMember;
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent users from changing their own role
    if (targetMember.user_id === decoded.userId) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }

    let updatedMember;
    let updateError;

    if (workspaceMember) {
      // Update workspace-specific role
      const result = await supabaseAdmin
        .from('workspace_members')
        .update({ role: role })
        .eq('id', memberId)
        .eq('workspace_id', workspaceId)
        .select(`
          id,
          role,
          created_at,
          users!inner (
            id,
            name,
            email
          )
        `)
        .single();
      updatedMember = result.data;
      updateError = result.error;
    } else {
      // Create workspace-specific membership with the new role
      const result = await supabaseAdmin
        .from('workspace_members')
        .insert([{
          workspace_id: workspaceId,
          user_id: targetMember.user_id,
          role: role,
          status: 'active'
        }])
        .select(`
          id,
          role,
          created_at,
          users!inner (
            id,
            name,
            email
          )
        `)
        .single();
      updatedMember = result.data;
      updateError = result.error;
    }

    if (updateError) {
      console.error('Error updating workspace member role:', updateError);
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Workspace member role updated successfully',
      member: updatedMember
    });

  } catch (error) {
    console.error('Update workspace member role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        organization_id,
        organizations (
          id
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has permission to remove workspace members (must be organization owner or admin)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    const permissionCheck = checkOrganizationPermission(
      userMembership.role as OrganizationRole,
      'INVITE_MEMBERS'
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to remove workspace members' }, { status: 403 });
    }

    // Check if the member has workspace-specific access or organization access
    const { data: workspaceMember, error: workspaceMemberError } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single();

    const { data: orgMember, error: orgMemberError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', workspace.organization_id)
      .single();

    if (workspaceMemberError && orgMemberError) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const targetMember = workspaceMember || orgMember;
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent users from removing themselves
    if (targetMember.user_id === decoded.userId) {
      return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }

    let deleteError;

    if (workspaceMember) {
      // Remove workspace-specific access only
      const result = await supabaseAdmin
        .from('workspace_members')
        .delete()
        .eq('id', memberId)
        .eq('workspace_id', workspaceId);
      deleteError = result.error;
    } else {
      // Remove from organization (which removes access to all workspaces)
      const result = await supabaseAdmin
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', workspace.organization_id);
      deleteError = result.error;
    }

    if (deleteError) {
      console.error('Error removing workspace member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Workspace member removed successfully'
    });

  } catch (error) {
    console.error('Remove workspace member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
