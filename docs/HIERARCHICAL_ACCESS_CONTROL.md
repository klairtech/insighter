# Hierarchical Access Control System

## Overview

This document describes the hierarchical access control system implemented in the Insighter application. The system provides automatic access inheritance from organizations to workspaces to agents, ensuring users have appropriate access based on their role in the hierarchy.

## Architecture

### Access Hierarchy

```
Organization (Owner/Admin/Member)
    ↓
Workspace (Admin/Member/Viewer)
    ↓
Agent (Read/Write Access)
```

### Access Inheritance Rules

1. **Organization Level**: Users with organization membership automatically inherit workspace access
2. **Workspace Level**: Users with workspace membership automatically inherit agent access
3. **Agent Level**: Direct agent access can be granted independently

### Role Mapping

| Organization Role | Inherited Workspace Role | Inherited Agent Access |
| ----------------- | ------------------------ | ---------------------- |
| Owner             | Admin                    | Write                  |
| Admin             | Admin                    | Write                  |
| Member            | Member                   | Read                   |

## Database Functions

### Core Access Functions

#### `user_has_organization_access(p_user_id UUID, p_organization_id UUID)`

- **Purpose**: Check if user has access to an organization
- **Returns**: BOOLEAN
- **Logic**: Checks if user is an active member of the organization

#### `user_has_workspace_access(p_user_id UUID, p_workspace_id UUID)`

- **Purpose**: Check if user has access to a workspace (direct or inherited)
- **Returns**: BOOLEAN
- **Logic**:
  1. Check direct workspace membership
  2. If no direct access, check organization-level access

#### `user_has_agent_access(p_user_id UUID, p_agent_id UUID)`

- **Purpose**: Check if user has access to an agent (direct or inherited)
- **Returns**: BOOLEAN
- **Logic**:
  1. Check direct agent access
  2. If no direct access, check workspace-level access

### Role Functions

#### `get_user_organization_role(p_user_id UUID, p_organization_id UUID)`

- **Purpose**: Get user's role in an organization
- **Returns**: TEXT ('owner', 'admin', 'member', 'none')

#### `get_user_workspace_role(p_user_id UUID, p_workspace_id UUID)`

- **Purpose**: Get user's effective role in a workspace
- **Returns**: TEXT ('admin', 'member', 'viewer', 'none')
- **Logic**: Returns direct workspace role or inherited role from organization

### Permission Functions

#### `can_user_perform_agent_action(p_user_id UUID, p_agent_id UUID, p_action TEXT)`

- **Purpose**: Check if user can perform specific action on agent
- **Returns**: BOOLEAN
- **Actions**:
  - `view`: Anyone with access
  - `share`: Admin and members
  - `update`: Admin only
  - `delete`: Admin only

### Utility Functions

#### `get_user_accessible_agents(p_user_id UUID)`

- **Purpose**: Get all agents accessible to a user
- **Returns**: TABLE with agent details and access type
- **Access Types**: 'direct', 'workspace', 'organization'

## Database Triggers

### Access Propagation

#### `propagate_org_to_workspace_access()`

- **Trigger**: `organization_members` table changes
- **Purpose**: Automatically grant/revoke workspace access when organization membership changes
- **Logic**:
  - On INSERT/UPDATE (active): Add user to all organization workspaces
  - On DELETE/UPDATE (inactive): Remove user from organization workspaces

#### `propagate_workspace_to_agent_access()`

- **Trigger**: `workspace_members` table changes
- **Purpose**: Automatically grant/revoke agent access when workspace membership changes
- **Logic**:
  - On INSERT/UPDATE (active): Add user to all workspace agents
  - On DELETE/UPDATE (inactive): Remove user from workspace agents

## Row Level Security (RLS)

### Policies

#### `workspace_access_policy`

- **Table**: `workspaces`
- **Logic**: Users can only see workspaces they have access to

#### `agent_access_policy`

- **Table**: `ai_agents`
- **Logic**: Users can only see agents they have access to

#### `agent_access_management_policy`

- **Table**: `agent_access`
- **Logic**: Users can see their own access records and records for agents they have access to

## API Integration

### Agent Sharing API

The agent sharing API (`/api/agents/[id]/share`) uses the hierarchical access control functions:

```typescript
// Check if user can perform action
const { data: hasAccess } = await supabaseServer.rpc(
  "can_user_perform_agent_action",
  {
    p_user_id: user.userId,
    p_agent_id: agentId,
    p_action: "share",
  }
);
```

### Access Control Flow

1. **Authentication**: Verify user session
2. **Permission Check**: Use `can_user_perform_agent_action()` to check permissions
3. **Action Execution**: Proceed with action if authorized
4. **Audit Logging**: Log access changes for security

## Performance Optimizations

### Indexes

The system includes optimized indexes for fast access control checks:

```sql
-- Organization membership lookups
CREATE INDEX idx_organization_members_user_org_status
  ON organization_members(user_id, organization_id, status);

-- Workspace membership lookups
CREATE INDEX idx_workspace_members_user_workspace_status
  ON workspace_members(user_id, workspace_id, status);

-- Agent access lookups
CREATE INDEX idx_agent_access_user_agent_active
  ON agent_access(user_id, agent_id, is_active);
```

## Audit Logging

### Access Audit Log

All access changes are logged in the `access_audit_log` table:

- **Resource Type**: 'organization', 'workspace', 'agent'
- **Action**: 'granted', 'revoked', 'inherited'
- **Access Type**: 'direct', 'workspace', 'organization'
- **Role Changes**: Old and new roles

### Logging Function

```sql
SELECT log_access_change(
  p_user_id, p_resource_type, p_resource_id, p_action,
  p_access_type, p_old_role, p_new_role, p_granted_by
);
```

## Usage Examples

### Check User Access

```sql
-- Check if user can access an agent
SELECT user_has_agent_access('user-id', 'agent-id');

-- Get user's role in workspace
SELECT get_user_workspace_role('user-id', 'workspace-id');

-- Get all accessible agents
SELECT * FROM get_user_accessible_agents('user-id');
```

### API Usage

```typescript
// In API routes
const { data: hasAccess } = await supabase.rpc(
  "can_user_perform_agent_action",
  {
    p_user_id: userId,
    p_agent_id: agentId,
    p_action: "view",
  }
);

if (!hasAccess) {
  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}
```

## Security Considerations

1. **Principle of Least Privilege**: Users only get minimum required access
2. **Automatic Propagation**: Access changes propagate automatically through hierarchy
3. **Audit Trail**: All access changes are logged for security monitoring
4. **Database-Level Enforcement**: RLS policies enforce access at database level
5. **Function Security**: All functions use `SECURITY DEFINER` for consistent permissions

## Migration

The hierarchical access control system is implemented via the migration script:
`scripts/hierarchical-access-control.sql`

Apply this migration through the Supabase SQL Editor for full implementation.

## Troubleshooting

### Common Issues

1. **Function Not Found**: Ensure migration script has been applied
2. **Access Denied**: Check user's organization/workspace membership
3. **Performance Issues**: Verify indexes are created
4. **Trigger Not Firing**: Check trigger definitions and table constraints

### Debug Queries

```sql
-- Check user's organization memberships
SELECT * FROM organization_members WHERE user_id = 'user-id';

-- Check user's workspace memberships
SELECT * FROM workspace_members WHERE user_id = 'user-id';

-- Check user's agent access
SELECT * FROM agent_access WHERE user_id = 'user-id';

-- Check access audit log
SELECT * FROM access_audit_log WHERE user_id = 'user-id' ORDER BY created_at DESC;
```
