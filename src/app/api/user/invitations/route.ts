import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyUserSession } from '@/lib/server-utils';

export async function GET(request: NextRequest) {
  try {
    // Debug the request headers
    // const authHeader = request.headers.get('authorization');
    
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all pending invitations for this user's email
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('organization_invitations')
      .select(`
        id,
        organization_id,
        email,
        role,
        status,
        expires_at,
        created_at,
        token,
        organizations (
          id,
          name,
          description
        ),
        users!organization_invitations_invited_by_fkey (
          name,
          email
        )
      `)
      .eq('email', decoded.user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching user invitations:', invitationsError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json(invitations || []);

  } catch (error) {
    console.error('Get user invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
