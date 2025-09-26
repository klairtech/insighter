import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';
import { checkOrganizationPermission, OrganizationRole } from '@/lib/permissions';
import { randomBytes } from 'crypto';

/**
 * WORKSPACE INVITATIONS API - HIERARCHICAL ACCESS CONTROL
 * =====================================================
 * 
 * This API handles workspace invitations with hierarchical access control.
 * 
 * Access Hierarchy:
 * Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer)
 * 
 * Key Features:
 * - Only organization owners/admins can invite users to workspaces
 * - Invited users must be organization members first
 * - Access inheritance is handled by database triggers
 * 
 * Database Functions Used:
 * - user_has_workspace_access(): Checks if user can manage workspace invitations
 * - get_user_organization_role(): Gets user's role in organization
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

// Helper function to generate secure invitation token
function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate role
function isValidRole(role: string): boolean {
  return ['member', 'viewer'].includes(role);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const { email, role = 'member' } = await request.json();

    // Validate input
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be member or viewer' }, { status: 400 });
    }

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        name,
        organization_id,
        organizations (
          id,
          name
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has permission to invite to workspace (must be organization owner or admin)
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
      return NextResponse.json({ error: 'Insufficient permissions to invite users to workspace' }, { status: 403 });
    }

    // Get user by email from users table
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already a member of the organization
    const { data: orgMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', userData.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ 
        error: 'User must be a member of the organization before being invited to a workspace' 
      }, { status: 400 });
    }

    // Check if user is already a workspace member
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 });
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('workspace_invitations')
      .select('id, status')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .single();

    if (existingInvitation && existingInvitation.status === 'pending') {
      return NextResponse.json({ error: 'Invitation already sent to this email' }, { status: 409 });
    }

    // Create invitation
    const invitationToken = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('workspace_invitations')
      .insert([{
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role: role,
        invited_by: decoded.userId,
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      }])
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating workspace invitation:', invitationError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // TODO: Send email notification here
    // For now, we'll just return the invitation data

    return NextResponse.json({
      message: 'Workspace invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        workspace_name: workspace.name,
        organization_name: workspace.organizations?.[0]?.name || 'Unknown'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Workspace invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 Workspace invitations API called');
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      console.log('❌ Workspace invitations API: Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ Workspace invitations API: User authenticated:', decoded.userId);

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

    // Check if user has permission to view invitations (must be organization owner or admin)
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
      return NextResponse.json({ error: 'Insufficient permissions to view workspace invitations' }, { status: 403 });
    }

    // Get all invitations for this workspace (without join)
    const { data: invitationsRaw, error: invitationsError } = await supabaseAdmin
      .from('workspace_invitations')
      .select(`
        id,
        email,
        role,
        status,
        expires_at,
        created_at,
        invited_by
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('❌ Workspace invitations API: Error fetching workspace invitations:', invitationsError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Get user details for invited_by users
    const invitedByUserIds = invitationsRaw?.map(inv => inv.invited_by).filter(Boolean) || [];
    let users: Array<{ id: string; name: string; email: string }> = [];
    
    if (invitedByUserIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .in('id', invitedByUserIds);

      if (usersError) {
        console.error('❌ Workspace invitations API: Error fetching users:', usersError);
        return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
      }

      users = usersData || [];
    }

    // Create a user lookup map
    const userMap = new Map(users.map(user => [user.id, user]));

    // Combine the data
    const invitations = invitationsRaw?.map(invitation => ({
      ...invitation,
      users: userMap.get(invitation.invited_by)
    })) || [];

    console.log('✅ Workspace invitations API: Returning', invitations.length, 'invitations');
    return NextResponse.json(invitations);

  } catch (error) {
    console.error('Get workspace invitations error:', error);
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
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Get workspace and organization info
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        name,
        organization_id,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user has organization membership
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', decoded.userId)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Check if user has permission to cancel invitations
    const hasPermission = checkOrganizationPermission(
      userMembership.role as OrganizationRole,
      'INVITE_MEMBERS'
    );

    if (!hasPermission.hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to cancel invitations' }, { status: 403 });
    }

    // Check if invitation exists and belongs to this workspace
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('workspace_invitations')
      .select('id, email, status')
      .eq('id', invitationId)
      .eq('workspace_id', workspaceId)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Only allow canceling pending invitations
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Can only cancel pending invitations' }, { status: 400 });
    }

    // Delete the invitation
    const { error: deleteError } = await supabaseAdmin
      .from('workspace_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      console.error('Error deleting workspace invitation:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }

    console.log(`🗑️ Cancelled workspace invitation for ${invitation.email} by user: ${decoded.user.email} (${decoded.userId})`);

    return NextResponse.json({
      message: 'Invitation cancelled successfully',
      invitation: {
        id: invitationId,
        email: invitation.email
      }
    });

  } catch (error) {
    console.error('Workspace invitation cancellation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
