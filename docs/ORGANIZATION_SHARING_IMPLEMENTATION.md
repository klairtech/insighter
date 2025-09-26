# Organization Sharing & Role-Based Access Control Implementation

## 🎯 **Overview**

This document outlines the comprehensive organization sharing and role-based access control system implemented for the Insighter platform. The system provides hierarchical permissions from organizations down to workspaces, agents, and canvases.

## 🏗️ **Architecture**

### **Permission Hierarchy**

```
Organization (Top Level)
├── Owner: Full control over organization and all resources
├── Admin: Manage members, workspaces, and content
├── Member: Create and manage content within workspaces
└── Viewer: Read-only access to organization resources

Workspace (Inherits from Organization)
├── Admin: Full workspace control (inherited from org admin/owner)
├── Member: Create and manage agents/canvases (inherited from org member)
└── Viewer: Read-only access (inherited from org viewer)

Agent & Canvas (Inherits from Workspace)
├── Full Access: Based on workspace membership
└── Read-only: Based on workspace viewer role
```

## 📊 **Database Schema Enhancements**

### **New Tables Created**

#### 1. **organization_invitations**

```sql
CREATE TABLE organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token text UNIQUE NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, email)
);
```

#### 2. **workspace_members**

```sql
CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
```

#### 3. **workspace_invitations**

```sql
CREATE TABLE workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token text UNIQUE NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, email)
);
```

### **Enhanced organization_members**

```sql
ALTER TABLE organization_members
ADD CONSTRAINT organization_members_role_check
CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
```

## 🔧 **API Endpoints**

### **Organization Management**

#### 1. **Invite Users to Organization**

```
POST /api/organizations/[id]/invite
```

- **Purpose**: Send invitation to join organization
- **Authentication**: Required (Bearer token)
- **Permissions**: Owner or Admin only
- **Body**: `{ email: string, role: 'admin' | 'member' | 'viewer' }`
- **Response**: Invitation details with token

#### 2. **Get Organization Invitations**

```
GET /api/organizations/[id]/invite
```

- **Purpose**: List all pending invitations
- **Authentication**: Required (Bearer token)
- **Permissions**: Owner or Admin only
- **Response**: Array of invitation objects

#### 3. **Manage Organization Members**

```
GET /api/organizations/[id]/members
PUT /api/organizations/[id]/members
DELETE /api/organizations/[id]/members
```

- **Purpose**: View, update, and remove organization members
- **Authentication**: Required (Bearer token)
- **Permissions**:
  - GET: Any organization member
  - PUT/DELETE: Owner or Admin only

### **Invitation Management**

#### 4. **Accept Organization Invitation**

```
POST /api/invitations/accept
GET /api/invitations/accept?token=[token]
```

- **Purpose**: Accept or view invitation details
- **Authentication**: Required (Bearer token)
- **Body**: `{ token: string }`
- **Response**: Organization details and membership confirmation

### **Workspace Management**

#### 5. **Invite Users to Workspace**

```
POST /api/workspaces/[id]/invite
GET /api/workspaces/[id]/invite
```

- **Purpose**: Send invitation to join workspace
- **Authentication**: Required (Bearer token)
- **Permissions**: Organization Owner or Admin only
- **Body**: `{ email: string, role: 'admin' | 'member' | 'viewer' }`

#### 6. **Manage Workspace Members**

```
GET /api/workspaces/[id]/members
PUT /api/workspaces/[id]/members
DELETE /api/workspaces/[id]/members
```

- **Purpose**: View, update, and remove workspace members
- **Authentication**: Required (Bearer token)
- **Permissions**: Organization Owner or Admin only

## 🎨 **Frontend Components**

### **1. OrganizationSharing Component**

**Location**: `src/components/OrganizationSharing.tsx`

**Features**:

- Invite users by email with role selection
- View all organization members with their roles
- Update member roles (Owner/Admin only)
- Remove members (Owner/Admin only)
- View pending invitations
- Real-time permission checking

**Props**:

```typescript
interface OrganizationSharingProps {
  organizationId: string;
  organizationName: string;
  userRole: OrganizationRole;
  onClose: () => void;
}
```

### **2. Enhanced Organizations Page**

**Location**: `src/app/organizations/page.tsx`

**New Features**:

- Share button on each organization card
- Modal integration for sharing functionality
- Role-based UI elements
- Permission-aware actions

## 🔐 **Permission System**

### **Permission Utilities**

**Location**: `src/lib/permissions.ts`

**Key Functions**:

- `checkOrganizationPermission()`: Verify organization-level permissions
- `checkWorkspacePermission()`: Verify workspace-level permissions
- `hasMinimumRole()`: Check role hierarchy
- `getEffectiveWorkspaceRole()`: Get workspace role from organization role
- `canPerformAction()`: Generic permission checker

### **Role Definitions**

#### **Organization Roles**

- **Owner**: Full control, can manage all aspects
- **Admin**: Can invite members, manage workspaces
- **Member**: Can create and manage content
- **Viewer**: Read-only access

#### **Workspace Roles**

- **Admin**: Full workspace control
- **Member**: Create and manage agents/canvases
- **Viewer**: Read-only access

### **Permission Matrix**

| Action              | Owner | Admin | Member | Viewer |
| ------------------- | ----- | ----- | ------ | ------ |
| Create Organization | ✅    | ❌    | ❌     | ❌     |
| Delete Organization | ✅    | ❌    | ❌     | ❌     |
| Invite Members      | ✅    | ✅    | ❌     | ❌     |
| Remove Members      | ✅    | ✅    | ❌     | ❌     |
| Update Member Roles | ✅    | ✅    | ❌     | ❌     |
| Create Workspace    | ✅    | ✅    | ❌     | ❌     |
| Delete Workspace    | ✅    | ✅    | ❌     | ❌     |
| Create Agent/Canvas | ✅    | ✅    | ✅     | ❌     |
| View Content        | ✅    | ✅    | ✅     | ✅     |

## 🔄 **Automatic Inheritance**

### **Workspace Membership Inheritance**

When a user is added to an organization:

1. Automatically added to all existing workspaces
2. Role inherited based on organization role:
   - Owner → Workspace Admin
   - Admin → Workspace Admin
   - Member → Workspace Member
   - Viewer → Workspace Viewer

### **Database Triggers**

```sql
CREATE TRIGGER trigger_inherit_workspace_membership
  AFTER INSERT OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION inherit_workspace_membership();
```

## 🛡️ **Security Features**

### **Row Level Security (RLS)**

- All sharing tables have RLS enabled
- Policies ensure users can only access data they're authorized to see
- Automatic permission checking at database level

### **Token-Based Invitations**

- Secure random tokens for invitations
- 7-day expiration for security
- Unique tokens prevent replay attacks

### **Input Validation**

- Email format validation
- Role validation against allowed values
- SQL injection prevention through parameterized queries

## 🧪 **Testing**

### **Test Scripts**

1. **`scripts/test-organization-sharing.js`**: Comprehensive sharing functionality test
2. **`scripts/test-organization-creation.js`**: Organization creation with ownership test
3. **`scripts/debug-organizations.js`**: Database debugging and seeding

### **Test Coverage**

- Organization creation with automatic ownership
- User invitation and acceptance flow
- Role-based permission checking
- Workspace membership inheritance
- Member role updates and removal
- Invitation expiration and cleanup

## 🚀 **Usage Examples**

### **1. Invite User to Organization**

```typescript
const response = await fetch(`/api/organizations/${orgId}/invite`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    email: "user@example.com",
    role: "member",
  }),
});
```

### **2. Check User Permissions**

```typescript
import { checkOrganizationPermission } from "@/lib/permissions";

const canInvite = checkOrganizationPermission(userRole, "INVITE_MEMBERS");
if (canInvite.hasPermission) {
  // Show invite button
}
```

### **3. Get User's Role in Organization**

```typescript
const response = await fetch(`/api/organizations/${orgId}/members`, {
  headers: { Authorization: `Bearer ${token}` },
});
const members = await response.json();
const userRole = members.find((m) => m.users.id === userId)?.role;
```

## 📈 **Benefits**

1. **Scalable Permission System**: Hierarchical permissions that scale with organization growth
2. **Automatic Inheritance**: Users get appropriate access to workspaces automatically
3. **Secure Invitations**: Token-based system with expiration and validation
4. **Role-Based UI**: Interface adapts based on user permissions
5. **Database-Level Security**: RLS policies ensure data protection
6. **Comprehensive Testing**: Full test coverage for all sharing functionality

## 🔮 **Future Enhancements**

1. **Email Notifications**: Integrate with email service for invitation notifications
2. **Bulk Invitations**: Support for inviting multiple users at once
3. **Custom Roles**: Allow organizations to define custom roles
4. **Audit Logging**: Track all permission changes and member activities
5. **Advanced Permissions**: Granular permissions for specific features
6. **Integration APIs**: Webhook support for external integrations

## 📝 **Implementation Status**

- ✅ Organization sharing API endpoints
- ✅ Role-based access control system
- ✅ Workspace sharing with inheritance
- ✅ Frontend UI components
- ✅ Permission utilities and helpers
- ✅ Database schema enhancements
- ✅ Security policies and validation
- ✅ Comprehensive testing scripts
- ⏳ Agent and canvas access control (pending)
- ⏳ Navigation component updates (in progress)

The organization sharing system is now fully functional and provides a robust foundation for collaborative work within the Insighter platform.
