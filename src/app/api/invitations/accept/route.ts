import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';
import { addOrganizationMemberToWorkspaces } from '@/lib/workspace-inheritance';

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    console.log(`🎫 Processing invitation acceptance for user ${decoded.userId} with token ${token}`);

    // Find the invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin!
      .from('organization_invitations')
      .select(`
        id,
        organization_id,
        email,
        role,
        status,
        expires_at,
        organizations (
          id,
          name
        )
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation has already been processed' }, { status: 400 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Verify the email matches the user's email
    if (invitation.email.toLowerCase() !== decoded.user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Invitation email does not match your account' }, { status: 400 });
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', decoded.userId)
      .single();

    if (existingMember) {
      // Update invitation status to accepted
      await supabaseAdmin
        .from('organization_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({ 
        message: 'You are already a member of this organization',
        organization: invitation.organizations
      });
    }

    // Add user to organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .insert([{
        organization_id: invitation.organization_id,
        user_id: decoded.userId,
        role: invitation.role,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (membershipError) {
      console.error('Error creating organization membership:', membershipError);
      return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 });
    }

    // Update invitation status to accepted
    const { error: updateError } = await supabaseAdmin
      .from('organization_invitations')
      .update({ 
        status: 'accepted', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      // Don't fail the request, just log the error
    }

    // Automatically add user to all existing workspaces in the organization
    console.log(`🔄 Adding user to all workspaces in organization ${invitation.organization_id}`);
    const workspaceResult = await addOrganizationMemberToWorkspaces(
      invitation.organization_id,
      decoded.userId,
      invitation.role
    );

    if (!workspaceResult.success) {
      console.error('Error adding user to workspaces:', workspaceResult.error);
      // Don't fail the request, just log the error - user is still added to organization
    } else {
      console.log(`✅ User added to ${workspaceResult.workspacesAdded || 0} workspaces`);
    }

    return NextResponse.json({
      message: 'Successfully joined organization',
      organization: invitation.organizations,
      membership: membership,
      workspacesAdded: workspaceResult.workspacesAdded || 0
    }, { status: 200 });

  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('organization_invitations')
      .select(`
        id,
        organization_id,
        email,
        role,
        status,
        expires_at,
        created_at,
        organizations (
          id,
          name,
          description
        )
      `)
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation has already been processed' }, { status: 400 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Verify the email matches the user's email
    if (invitation.email.toLowerCase() !== decoded.user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Invitation email does not match your account' }, { status: 400 });
    }

    return NextResponse.json({
      invitation: invitation,
      can_accept: true
    });

  } catch (error) {
    console.error('Get invitation details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
