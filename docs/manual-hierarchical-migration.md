# Hierarchical Access Control - Manual Migration

Since the `exec_sql` function is not available in Supabase, please apply this migration manually through the Supabase SQL Editor.

## Steps:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL from `scripts/hierarchical-access-control.sql`
4. Execute the SQL

## Alternative: Apply in smaller chunks

If the full SQL is too large, apply it in these smaller chunks:

### Chunk 1: Core Access Functions
```sql
-- Function to check if user has organization access
CREATE OR REPLACE FUNCTION user_has_organization_access(
  p_user_id UUID,
  p_organization_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM organization_members 
    WHERE user_id = p_user_id 
      AND organization_id = p_organization_id 
      AND status = 'active'
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Chunk 2: Workspace Access Function
```sql
-- Function to check if user has workspace access (direct or inherited)
CREATE OR REPLACE FUNCTION user_has_workspace_access(
  p_user_id UUID,
  p_workspace_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN := FALSE;
  workspace_org_id UUID;
BEGIN
  -- Get the organization ID for this workspace
  SELECT organization_id INTO workspace_org_id
  FROM workspaces 
  WHERE id = p_workspace_id;
  
  -- Check direct workspace membership
  SELECT EXISTS(
    SELECT 1 
    FROM workspace_members 
    WHERE user_id = p_user_id 
      AND workspace_id = p_workspace_id 
      AND status = 'active'
  ) INTO has_access;
  
  -- If no direct access, check organization-level access
  IF NOT has_access AND workspace_org_id IS NOT NULL THEN
    SELECT user_has_organization_access(p_user_id, workspace_org_id) INTO has_access;
  END IF;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Chunk 3: Agent Access Function
```sql
-- Function to check if user has agent access (direct or inherited)
CREATE OR REPLACE FUNCTION user_has_agent_access(
  p_user_id UUID,
  p_agent_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN := FALSE;
  agent_workspace_id UUID;
BEGIN
  -- Get the workspace ID for this agent
  SELECT workspace_id INTO agent_workspace_id
  FROM ai_agents 
  WHERE id = p_agent_id;
  
  -- Check direct agent access
  SELECT EXISTS(
    SELECT 1 
    FROM agent_access 
    WHERE user_id = p_user_id 
      AND agent_id = p_agent_id 
      AND is_active = TRUE
  ) INTO has_access;
  
  -- If no direct access, check workspace-level access
  IF NOT has_access AND agent_workspace_id IS NOT NULL THEN
    SELECT user_has_workspace_access(p_user_id, agent_workspace_id) INTO has_access;
  END IF;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Chunk 4: Permission Check Function
```sql
-- Function to check if user can perform action on agent
CREATE OR REPLACE FUNCTION can_user_perform_agent_action(
  p_user_id UUID,
  p_agent_id UUID,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Check if user has access to the agent
  SELECT user_has_agent_access(p_user_id, p_agent_id) INTO has_access;
  
  IF NOT has_access THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's role for permission checking
  SELECT get_user_workspace_role(p_user_id, (
    SELECT workspace_id FROM ai_agents WHERE id = p_agent_id
  )) INTO user_role;
  
  -- Check permissions based on action
  CASE p_action
    WHEN 'view' THEN
      RETURN TRUE; -- Anyone with access can view
    WHEN 'share' THEN
      RETURN user_role IN ('admin', 'member'); -- Admin and members can share
    WHEN 'update' THEN
      RETURN user_role IN ('admin'); -- Only admins can update
    WHEN 'delete' THEN
      RETURN user_role IN ('admin'); -- Only admins can delete
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Chunk 5: Role Functions
```sql
-- Function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_organization_role(
  p_user_id UUID,
  p_organization_id UUID
) RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM organization_members 
  WHERE user_id = p_user_id 
    AND organization_id = p_organization_id 
    AND status = 'active';
  
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in workspace
CREATE OR REPLACE FUNCTION get_user_workspace_role(
  p_user_id UUID,
  p_workspace_id UUID
) RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
  workspace_org_id UUID;
  org_role TEXT;
BEGIN
  -- Check direct workspace membership
  SELECT role INTO user_role
  FROM workspace_members 
  WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id 
    AND status = 'active';
  
  -- If no direct role, check organization-level role
  IF user_role IS NULL THEN
    SELECT organization_id INTO workspace_org_id
    FROM workspaces 
    WHERE id = p_workspace_id;
    
    IF workspace_org_id IS NOT NULL THEN
      SELECT get_user_organization_role(p_user_id, workspace_org_id) INTO org_role;
      -- Map organization roles to workspace roles
      CASE org_role
        WHEN 'owner' THEN user_role := 'admin';
        WHEN 'admin' THEN user_role := 'admin';
        WHEN 'member' THEN user_role := 'member';
        ELSE user_role := 'none';
      END CASE;
    END IF;
  END IF;
  
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## After applying the migration:

1. Test the functions work correctly
2. The API will automatically use these functions
3. Hierarchical access control will be enforced at the database level

## Testing:

You can test the functions with:
```sql
-- Test organization access
SELECT user_has_organization_access('5871bcf8-1868-4781-ad50-a16ad25838de', '2f8155d1-a5b8-4504-8fb9-6d9829882793');

-- Test workspace access
SELECT user_has_workspace_access('5871bcf8-1868-4781-ad50-a16ad25838de', '16bb7501-c437-4d74-9b33-a8d5afdcc345');

-- Test agent access
SELECT user_has_agent_access('5871bcf8-1868-4781-ad50-a16ad25838de', 'b140154f-4561-4541-b68b-bbcafae1debe');

-- Test permission check
SELECT can_user_perform_agent_action('5871bcf8-1868-4781-ad50-a16ad25838de', 'b140154f-4561-4541-b68b-bbcafae1debe', 'view');
```
