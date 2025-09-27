import { supabaseServer } from './server-utils'

/**
 * Automatically add organization members to all workspaces in the organization
 * This ensures that when users join an organization, they get access to all existing workspaces
 */
export async function addOrganizationMemberToWorkspaces(
  organizationId: string,
  userId: string,
  organizationRole: string
): Promise<{ success: boolean; error?: string; workspacesAdded?: number }> {
  try {
    console.log(`🔄 Adding user ${userId} to all workspaces in organization ${organizationId} with role ${organizationRole}`)

    // Get all active workspaces in the organization
    const { data: workspaces, error: workspacesError } = await supabaseServer
      .from('workspaces')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('status', 'active')

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError)
      return { success: false, error: 'Failed to fetch workspaces' }
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('No workspaces found in organization')
      return { success: true, workspacesAdded: 0 }
    }

    // Map organization role to workspace role
    const workspaceRole = mapOrganizationRoleToWorkspaceRole(organizationRole)
    
    // Check which workspaces the user is not already a member of
    const { data: existingMemberships, error: membershipsError } = await supabaseServer
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (membershipsError) {
      console.error('Error fetching existing workspace memberships:', membershipsError)
      return { success: false, error: 'Failed to fetch existing memberships' }
    }

    const existingWorkspaceIds = new Set(
      existingMemberships?.map(m => m.workspace_id) || []
    )

    // Filter out workspaces where user is already a member
    const workspacesToAdd = workspaces.filter(w => !existingWorkspaceIds.has(w.id))

    if (workspacesToAdd.length === 0) {
      console.log('User is already a member of all workspaces in the organization')
      return { success: true, workspacesAdded: 0 }
    }

    // Create workspace membership records
    const membershipRecords = workspacesToAdd.map(workspace => ({
      workspace_id: workspace.id,
      user_id: userId,
      role: workspaceRole,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabaseServer
      .from('workspace_members')
      .insert(membershipRecords)

    if (insertError) {
      console.error('Error creating workspace memberships:', insertError)
      return { success: false, error: 'Failed to create workspace memberships' }
    }

    console.log(`✅ Successfully added user to ${workspacesToAdd.length} workspaces`)
    return { success: true, workspacesAdded: workspacesToAdd.length }

  } catch (error) {
    console.error('Error in addOrganizationMemberToWorkspaces:', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Map organization role to workspace role based on the hierarchical access control system
 */
function mapOrganizationRoleToWorkspaceRole(organizationRole: string): string {
  switch (organizationRole) {
    case 'owner':
    case 'admin':
      return 'admin'
    case 'member':
      return 'member'
    case 'viewer':
      return 'viewer'
    default:
      return 'member' // Default fallback
  }
}

/**
 * Add a user to a specific workspace when they join an organization
 * This is called when a new workspace is created and we need to add existing organization members
 */
export async function addOrganizationMembersToWorkspace(
  workspaceId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string; membersAdded?: number }> {
  try {
    console.log(`🔄 Adding all organization members to workspace ${workspaceId}`)

    // Get all active organization members
    const { data: orgMembers, error: orgMembersError } = await supabaseServer
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('status', 'active')

    if (orgMembersError) {
      console.error('Error fetching organization members:', orgMembersError)
      return { success: false, error: 'Failed to fetch organization members' }
    }

    if (!orgMembers || orgMembers.length === 0) {
      console.log('No organization members found')
      return { success: true, membersAdded: 0 }
    }

    // Check which members are not already workspace members
    const { data: existingMemberships, error: membershipsError } = await supabaseServer
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (membershipsError) {
      console.error('Error fetching existing workspace memberships:', membershipsError)
      return { success: false, error: 'Failed to fetch existing memberships' }
    }

    const existingUserIds = new Set(
      existingMemberships?.map(m => m.user_id) || []
    )

    // Filter out members who are already workspace members
    const membersToAdd = orgMembers.filter(m => !existingUserIds.has(m.user_id))

    if (membersToAdd.length === 0) {
      console.log('All organization members are already workspace members')
      return { success: true, membersAdded: 0 }
    }

    // Create workspace membership records
    const membershipRecords = membersToAdd.map(member => ({
      workspace_id: workspaceId,
      user_id: member.user_id,
      role: mapOrganizationRoleToWorkspaceRole(member.role),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabaseServer
      .from('workspace_members')
      .insert(membershipRecords)

    if (insertError) {
      console.error('Error creating workspace memberships:', insertError)
      return { success: false, error: 'Failed to create workspace memberships' }
    }

    console.log(`✅ Successfully added ${membersToAdd.length} organization members to workspace`)
    return { success: true, membersAdded: membersToAdd.length }

  } catch (error) {
    console.error('Error in addOrganizationMembersToWorkspace:', error)
    return { success: false, error: 'Internal error' }
  }
}
