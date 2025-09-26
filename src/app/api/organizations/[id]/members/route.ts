import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // const authHeader = request.headers.get('authorization');
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: organizationId } = await params;
    // Check if user has permission to view members (must be a member)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    // Get all members with their user details
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id,
        role,
        created_at,
        users (
          id,
          name,
          email,
          created_at
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (membersError) {
      console.error('❌ Organization Members API: Error fetching organization members:', {
        code: membersError.code,
        message: membersError.message,
        details: membersError.details,
        hint: membersError.hint
      });
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    return NextResponse.json(members || []);

  } catch (error) {
    console.error('❌ Organization Members API: Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
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

    const { id: organizationId } = await params;
    const { memberId, role } = await request.json();

    if (!memberId || !role) {
      return NextResponse.json({ error: 'Member ID and role are required' }, { status: 400 });
    }

    // Validate role
    if (!['owner', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user has permission to update members (must be owner)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    if (userMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions to update members' }, { status: 403 });
    }

    // Prevent non-owners from changing roles to owner
    if (role === 'owner' && userMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 });
    }

    // Get the member being updated
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent users from changing their own role
    if (targetMember.user_id === decoded.userId) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }

    // Prevent non-owners from changing owner roles
    if (targetMember.role === 'owner' && userMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can modify other owners' }, { status: 403 });
    }

    // Update the member's role
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('organization_members')
      .update({ role: role })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select(`
        id,
        role,
        created_at,
        users (
          id,
          name,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Member role updated successfully',
      member: updatedMember
    });

  } catch (error) {
    console.error('Update member role error:', error);
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
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Check if user has permission to remove members (must be owner)
    const { data: userMembership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', decoded.userId)
      .single();

    if (membershipError || !userMembership) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 });
    }

    if (userMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions to remove members' }, { status: 403 });
    }

    // Get the member being removed
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent users from removing themselves
    if (targetMember.user_id === decoded.userId) {
      return NextResponse.json({ error: 'You cannot remove yourself from the organization' }, { status: 400 });
    }

    // Prevent non-owners from removing owners
    if (targetMember.role === 'owner' && userMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can remove other owners' }, { status: 403 });
    }

    // Remove the member
    const { error: deleteError } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Member removed successfully'
    });

  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
