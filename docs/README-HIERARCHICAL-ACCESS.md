# Hierarchical Access Control Implementation

## Overview

This directory contains the implementation of the hierarchical access control system for the Insighter application.

## Files

### `hierarchical-access-control.sql`

**Main implementation file** containing:

- Database functions for access control checks
- Access propagation triggers
- Row Level Security (RLS) policies
- Performance optimization indexes
- Audit logging system

### `manual-hierarchical-migration.md`

**Migration guide** with step-by-step instructions for applying the hierarchical access control system manually through the Supabase SQL Editor.

### `apply-hierarchical-access.js`

**Automated migration script** (requires `exec_sql` function which may not be available in all Supabase instances).

## Quick Start

1. **Apply the migration**:

   ```bash
   # Option 1: Manual (Recommended)
   # Copy the SQL from hierarchical-access-control.sql and run in Supabase SQL Editor

   # Option 2: Automated (if exec_sql function is available)
   node scripts/apply-hierarchical-access.js
   ```

2. **Test the implementation**:

   ```sql
   -- Test organization access
   SELECT user_has_organization_access('user-id', 'org-id');

   -- Test workspace access
   SELECT user_has_workspace_access('user-id', 'workspace-id');

   -- Test agent access
   SELECT user_has_agent_access('user-id', 'agent-id');
   ```

3. **Verify API integration**:
   The API endpoints will automatically use the new database functions for access control.

## Architecture

```
Organization (Owner/Admin/Member)
    ↓ (automatic inheritance)
Workspace (Admin/Member/Viewer)
    ↓ (automatic inheritance)
Agent (Read/Write Access)
```

## Key Features

- **Automatic Access Inheritance**: Users automatically get workspace and agent access based on organization membership
- **Database-Level Enforcement**: Row Level Security policies enforce access at the database level
- **Performance Optimized**: Indexes ensure fast access control checks
- **Audit Logging**: All access changes are logged for security monitoring
- **API Integration**: Seamless integration with existing API endpoints

## Troubleshooting

### Common Issues

1. **Function Not Found Error**:

   ```
   ERROR: function user_has_organization_access(uuid, uuid) does not exist
   ```

   **Solution**: Ensure the migration script has been applied completely.

2. **Return Type Error**:

   ```
   ERROR: cannot change return type of existing function
   ```

   **Solution**: The migration script includes `DROP FUNCTION` statements to handle this.

3. **Permission Denied**:
   ```
   ERROR: permission denied for table organization_members
   ```
   **Solution**: Ensure the migration is run with sufficient database privileges.

### Debug Queries

```sql
-- Check if functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%access%';

-- Check if triggers exist
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('workspaces', 'ai_agents', 'agent_access');
```

## Documentation

- **Complete Documentation**: `docs/HIERARCHICAL_ACCESS_CONTROL.md`
- **API Documentation**: See comments in API files
- **Schema Documentation**: See comments in `scripts/supabase-schema.sql`

## Support

For issues or questions about the hierarchical access control system:

1. Check the troubleshooting section above
2. Review the complete documentation
3. Check the API endpoint comments for usage examples
