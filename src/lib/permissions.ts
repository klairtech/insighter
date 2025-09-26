/**
 * PERMISSION CHECKING UTILITIES - HIERARCHICAL ACCESS CONTROL
 * =========================================================
 * 
 * This module provides permission checking utilities that work with the hierarchical
 * access control system implemented in the database.
 * 
 * Access Hierarchy:
 * Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer) → Agent (Read/Write)
 * 
 * Key Features:
 * - Role-based permission checking
 * - Hierarchical role inheritance
 * - Integration with database access control functions
 * 
 * Database Integration:
 * - These functions complement the database functions in hierarchical-access-control.sql
 * - Database functions handle access inheritance automatically
 * - This module provides application-level permission logic
 * 
 * See: docs/HIERARCHICAL_ACCESS_CONTROL.md for complete documentation
 */

// Permission checking utilities for role-based access control

export type OrganizationRole = 'owner' | 'member' | 'viewer';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface PermissionCheck {
  hasPermission: boolean;
  userRole?: OrganizationRole | WorkspaceRole;
  reason?: string;
}

// Role hierarchy definitions
export const ORGANIZATION_ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  owner: 3,
  member: 2,
  viewer: 1
};

export const WORKSPACE_ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};

// Permission definitions
export const ORGANIZATION_PERMISSIONS = {
  // Organization management
  CREATE_ORGANIZATION: ['owner'],
  DELETE_ORGANIZATION: ['owner'],
  UPDATE_ORGANIZATION: ['owner'],
  VIEW_ORGANIZATION: ['owner', 'member', 'viewer'],
  
  // Member management
  INVITE_MEMBERS: ['owner', 'member'],
  INVITE_OWNERS: ['owner'], // Only owners can invite other owners
  REMOVE_MEMBERS: ['owner'],
  UPDATE_MEMBER_ROLES: ['owner'],
  VIEW_MEMBERS: ['owner', 'member', 'viewer'],
  
  // Workspace management
  CREATE_WORKSPACE: ['owner'],
  DELETE_WORKSPACE: ['owner'],
  UPDATE_WORKSPACE: ['owner'],
  VIEW_WORKSPACE: ['owner', 'member', 'viewer'],
  
  // Billing and settings
  MANAGE_BILLING: ['owner'],
  MANAGE_SETTINGS: ['owner']
};

export const WORKSPACE_PERMISSIONS = {
  // Workspace management
  CREATE_WORKSPACE: ['owner'],
  DELETE_WORKSPACE: ['owner'],
  UPDATE_WORKSPACE: ['owner'],
  VIEW_WORKSPACE: ['owner', 'member', 'viewer'],
  
  // Workspace member management
  INVITE_WORKSPACE_MEMBERS: ['owner', 'member'],
  INVITE_WORKSPACE_OWNERS: ['owner'], // Only owners can invite other owners
  REMOVE_WORKSPACE_MEMBERS: ['owner'],
  UPDATE_WORKSPACE_MEMBER_ROLES: ['owner'],
  VIEW_WORKSPACE_MEMBERS: ['owner', 'member', 'viewer'],
  
  // Content management
  CREATE_AGENT: ['owner', 'member'],
  UPDATE_AGENT: ['owner', 'member'],
  DELETE_AGENT: ['owner'],
  VIEW_AGENT: ['owner', 'member', 'viewer'],
  
  CREATE_CANVAS: ['owner', 'member'],
  UPDATE_CANVAS: ['owner', 'member'],
  DELETE_CANVAS: ['owner'],
  VIEW_CANVAS: ['owner', 'member', 'viewer'],
  
  // Data source management
  UPLOAD_FILES: ['owner'],
  CONNECT_DATABASE: ['owner'],
  DELETE_FILES: ['owner'],
  UPDATE_FILES: ['owner'],
  VIEW_FILES: ['owner', 'member', 'viewer']
};

/**
 * Check if a user has a specific permission in an organization
 */
export function checkOrganizationPermission(
  userRole: OrganizationRole,
  permission: keyof typeof ORGANIZATION_PERMISSIONS
): PermissionCheck {
  // Add defensive programming to handle undefined or invalid roles
  if (!userRole) {
    console.warn('checkOrganizationPermission: userRole is undefined or null');
    return {
      hasPermission: false,
      userRole: undefined,
      reason: 'User role is not defined'
    };
  }
  
  const requiredRoles = ORGANIZATION_PERMISSIONS[permission];
  
  if (!requiredRoles || !Array.isArray(requiredRoles)) {
    console.warn('checkOrganizationPermission: invalid permission or requiredRoles:', permission, requiredRoles);
    return {
      hasPermission: false,
      userRole,
      reason: `Invalid permission: ${permission}`
    };
  }
  
  if (!requiredRoles.includes(userRole)) {
    return {
      hasPermission: false,
      userRole,
      reason: `Permission '${permission}' requires one of: ${requiredRoles.join(', ')}`
    };
  }
  
  return {
    hasPermission: true,
    userRole
  };
}

/**
 * Check if a user has a specific permission in a workspace
 */
export function checkWorkspacePermission(
  userRole: WorkspaceRole,
  permission: keyof typeof WORKSPACE_PERMISSIONS
): PermissionCheck {
  const requiredRoles = WORKSPACE_PERMISSIONS[permission];
  
  if (!requiredRoles.includes(userRole)) {
    return {
      hasPermission: false,
      userRole,
      reason: `Permission '${permission}' requires one of: ${requiredRoles.join(', ')}`
    };
  }
  
  return {
    hasPermission: true,
    userRole
  };
}

/**
 * Check if a user role is higher than or equal to a required role
 */
export function hasMinimumRole(
  userRole: OrganizationRole | WorkspaceRole,
  requiredRole: OrganizationRole | WorkspaceRole
): boolean {
  const userHierarchy = ORGANIZATION_ROLE_HIERARCHY[userRole as OrganizationRole] || 
                       WORKSPACE_ROLE_HIERARCHY[userRole as WorkspaceRole] || 0;
  const requiredHierarchy = ORGANIZATION_ROLE_HIERARCHY[requiredRole as OrganizationRole] || 
                           WORKSPACE_ROLE_HIERARCHY[requiredRole as WorkspaceRole] || 0;
  
  return userHierarchy >= requiredHierarchy;
}

/**
 * Get the effective workspace role based on organization role
 */
export function getEffectiveWorkspaceRole(orgRole: OrganizationRole): WorkspaceRole {
  switch (orgRole) {
    case 'owner':
      return 'admin';
    case 'member':
      return 'member';
    case 'viewer':
      return 'viewer';
    default:
      return 'viewer';
  }
}

/**
 * Check if a user can perform an action based on their role
 */
export function canPerformAction(
  userRole: OrganizationRole | WorkspaceRole,
  action: string,
  context: 'organization' | 'workspace' = 'organization'
): PermissionCheck {
  if (context === 'organization') {
    return checkOrganizationPermission(userRole as OrganizationRole, action as keyof typeof ORGANIZATION_PERMISSIONS);
  } else {
    return checkWorkspacePermission(userRole as WorkspaceRole, action as keyof typeof WORKSPACE_PERMISSIONS);
  }
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(role: OrganizationRole | WorkspaceRole): string[] {
  const permissions: string[] = [];
  
  // Check organization permissions
  Object.entries(ORGANIZATION_PERMISSIONS).forEach(([permission, requiredRoles]) => {
    if (requiredRoles.includes(role as OrganizationRole)) {
      permissions.push(`organization:${permission}`);
    }
  });
  
  // Check workspace permissions
  Object.entries(WORKSPACE_PERMISSIONS).forEach(([permission, requiredRoles]) => {
    if (requiredRoles.includes(role as WorkspaceRole)) {
      permissions.push(`workspace:${permission}`);
    }
  });
  
  return permissions;
}

/**
 * Format role for display
 */
export function formatRole(role: OrganizationRole | WorkspaceRole | undefined): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Check if a user can invite a specific role to an organization
 */
export function canInviteOrganizationRole(
  userRole: OrganizationRole,
  targetRole: OrganizationRole
): boolean {
  // Owners can invite anyone
  if (userRole === 'owner') {
    return true;
  }
  
  // Members can only invite viewers and members (not owners)
  if (userRole === 'member') {
    return targetRole === 'viewer' || targetRole === 'member';
  }
  
  // Viewers cannot invite anyone
  return false;
}

/**
 * Check if a user can invite a specific role to a workspace
 */
export function canInviteWorkspaceRole(
  userRole: WorkspaceRole,
  targetRole: WorkspaceRole
): boolean {
  // Owners can invite anyone
  if (userRole === 'owner') {
    return true;
  }
  
  // Members can only invite viewers and members (not owners)
  if (userRole === 'member') {
    return targetRole === 'viewer' || targetRole === 'member';
  }
  
  // Viewers cannot invite anyone
  return false;
}

/**
 * Get available roles that a user can invite to an organization
 */
export function getInvitableOrganizationRoles(userRole: OrganizationRole): OrganizationRole[] {
  // Add defensive programming to handle undefined or invalid roles
  if (!userRole) {
    console.warn('getInvitableOrganizationRoles: userRole is undefined or null');
    return [];
  }
  
  if (userRole === 'owner') {
    return ['owner', 'member', 'viewer'];
  }
  if (userRole === 'member') {
    return ['member', 'viewer'];
  }
  if (userRole === 'viewer') {
    return [];
  }
  
  // Handle unexpected role values
  console.warn('getInvitableOrganizationRoles: unexpected userRole:', userRole);
  return [];
}

/**
 * Get available roles that a user can invite to a workspace
 */
export function getInvitableWorkspaceRoles(userRole: WorkspaceRole): WorkspaceRole[] {
  if (userRole === 'owner') {
    return ['owner', 'member', 'viewer'];
  }
  if (userRole === 'member') {
    return ['member', 'viewer'];
  }
  return [];
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: OrganizationRole | WorkspaceRole): string {
  switch (role) {
    case 'owner':
      return 'text-purple-600 bg-purple-100';
    case 'member':
      return 'text-blue-600 bg-blue-100';
    case 'viewer':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}
