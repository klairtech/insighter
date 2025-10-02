import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, verifyUserSession } from '@/lib/server-utils';
import { addOrganizationMemberToWorkspaces } from '@/lib/workspace-inheritance';

/**
 * Migration endpoint to fix workspace access for existing organization members
 * This should be called to ensure all organization members have access to workspaces
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔄 Starting workspace access migration for user ${decoded.userId}`);

    // Get all organizations where the user is a member
    const { data: orgMemberships, error: orgError } = await supabaseServer
      .from('organization_members')
      .select(`
        organization_id,
        role,
        organizations (
          id,
          name
        )
      `)
      .eq('user_id', decoded.userId)
      .eq('status', 'active');

    if (orgError) {
      console.error('Error fetching organization memberships:', orgError);
      return NextResponse.json({ error: 'Failed to fetch organization memberships' }, { status: 500 });
    }

    if (!orgMemberships || orgMemberships.length === 0) {
      return NextResponse.json({ 
        message: 'No organization memberships found',
        organizationsProcessed: 0,
        workspacesAdded: 0
      });
    }

    let totalWorkspacesAdded = 0;
    const results = [];

    // Process each organization
    for (const membership of orgMemberships) {
      console.log(`🔄 Processing organization: ${membership.organizations?.[0]?.name} (${membership.organization_id})`);
      
      const result = await addOrganizationMemberToWorkspaces(
        membership.organization_id,
        decoded.userId,
        membership.role
      );

      if (result.success) {
        totalWorkspacesAdded += result.workspacesAdded || 0;
        results.push({
          organizationId: membership.organization_id,
          organizationName: membership.organizations?.[0]?.name,
          workspacesAdded: result.workspacesAdded || 0,
          success: true
        });
      } else {
        results.push({
          organizationId: membership.organization_id,
          organizationName: membership.organizations?.[0]?.name,
          workspacesAdded: 0,
          success: false,
          error: result.error
        });
      }
    }

    console.log(`✅ Migration completed. Total workspaces added: ${totalWorkspacesAdded}`);

    return NextResponse.json({
      message: 'Workspace access migration completed',
      organizationsProcessed: orgMemberships.length,
      workspacesAdded: totalWorkspacesAdded,
      results: results
    });

  } catch (error) {
    console.error('Error in workspace access migration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET endpoint to check current workspace access status
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyUserSession(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Checking workspace access status for user ${decoded.userId}`);

    // Get all organizations where the user is a member
    const { data: orgMemberships, error: orgError } = await supabaseServer
      .from('organization_members')
      .select(`
        organization_id,
        role,
        organizations (
          id,
          name
        )
      `)
      .eq('user_id', decoded.userId)
      .eq('status', 'active');

    if (orgError) {
      console.error('Error fetching organization memberships:', orgError);
      return NextResponse.json({ error: 'Failed to fetch organization memberships' }, { status: 500 });
    }

    if (!orgMemberships || orgMemberships.length === 0) {
      return NextResponse.json({ 
        message: 'No organization memberships found',
        organizations: []
      });
    }

    const statusResults = [];

    // Check workspace access for each organization
    for (const membership of orgMemberships) {
      // Get all workspaces in the organization
      const { data: workspaces, error: workspacesError } = await supabaseServer
        .from('workspaces')
        .select('id, name')
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active');

      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        continue;
      }

      if (!workspaces || workspaces.length === 0) {
        statusResults.push({
          organizationId: membership.organization_id,
          organizationName: membership.organizations?.[0]?.name,
          totalWorkspaces: 0,
          accessibleWorkspaces: 0,
          missingAccess: []
        });
        continue;
      }

      // Check which workspaces the user has access to
      const { data: workspaceMemberships, error: membershipsError } = await supabaseServer
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', decoded.userId)
        .eq('status', 'active');

      if (membershipsError) {
        console.error('Error fetching workspace memberships:', membershipsError);
        continue;
      }

      const accessibleWorkspaceIds = new Set(
        workspaceMemberships?.map(m => m.workspace_id) || []
      );

      const missingAccess = workspaces
        .filter(w => !accessibleWorkspaceIds.has(w.id))
        .map(w => ({ id: w.id, name: w.name }));

      statusResults.push({
        organizationId: membership.organization_id,
        organizationName: membership.organizations?.[0]?.name,
        totalWorkspaces: workspaces.length,
        accessibleWorkspaces: workspaces.length - missingAccess.length,
        missingAccess: missingAccess
      });
    }

    return NextResponse.json({
      message: 'Workspace access status retrieved',
      organizations: statusResults
    });

  } catch (error) {
    console.error('Error checking workspace access status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
