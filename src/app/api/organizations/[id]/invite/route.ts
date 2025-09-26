import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';
import { sendInvitationEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

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
  return ['owner', 'member', 'viewer'].includes(role);
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

    const { id: organizationId } = await params;
    const { email, role = 'member' } = await request.json();

    // Validate input
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be owner, member, or viewer' }, { status: 400 });
    }

    // Check if user has permission to invite (must be owner)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    // Check if user can invite (owners and members can invite)
    if (!['owner', 'member'].includes(userMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to invite users' }, { status: 403 });
    }

    // Check if user can invite the specific role
    if (userMembership.role === 'member' && role === 'owner') {
      return NextResponse.json({ error: 'Only owners can invite other owners' }, { status: 403 });
    }

    // Check if organization exists
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userData.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('organization_invitations')
      .select('id, status')
      .eq('organization_id', organizationId)
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
      .from('organization_invitations')
      .insert([{
        organization_id: organizationId,
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
      console.error('Error creating organization invitation:', invitationError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send email notification
    const emailSent = await sendInvitationEmail();

    if (!emailSent) {
      console.warn('Failed to send invitation email, but invitation was created');
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        organization_name: organization.name
      },
      email_sent: emailSent
    }, { status: 201 });

  } catch (error) {
    console.error('Organization invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: organizationId } = await params;
    // Check if user has permission to view invitations (must be owner)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    // Allow owners and members to view invitations
    if (!['owner', 'member'].includes(userMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to view invitations' }, { status: 403 });
    }

    // Get all invitations for this organization
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('organization_invitations')
      .select(`
        id,
        email,
        role,
        status,
        expires_at,
        created_at,
        invited_by,
        users!organization_invitations_invited_by_fkey (
          name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('❌ Organization Invitations API: Error fetching invitations:', {
        code: invitationsError.code,
        message: invitationsError.message,
        details: invitationsError.details,
        hint: invitationsError.hint
      });
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json(invitations || []);

  } catch (error) {
    console.error('❌ Organization Invitations API: Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
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

    const { id: organizationId } = await params;
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Check if user has permission to cancel invitations (must be owner or member)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    // Allow owners and members to cancel invitations
    if (!['owner', 'member'].includes(userMembership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to cancel invitations' }, { status: 403 });
    }

    // Check if invitation exists and belongs to this organization
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('organization_invitations')
      .select('id, email, status')
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
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
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      console.error('Error deleting organization invitation:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }

    console.log(`🗑️ Cancelled organization invitation for ${invitation.email} by user: ${decoded.user.email} (${decoded.userId})`);

    return NextResponse.json({
      message: 'Invitation cancelled successfully',
      invitation: {
        id: invitationId,
        email: invitation.email
      }
    });

  } catch (error) {
    console.error('Organization invitation cancellation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
