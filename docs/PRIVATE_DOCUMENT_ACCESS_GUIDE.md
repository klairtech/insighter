# Private Document Access Guide

## Overview

This guide explains how the system ensures access to private Google Sheets and Google Docs through proper OAuth scopes and permissions.

## How Private Document Access Works

### 1. OAuth Scopes Required

**For Google Sheets:**

- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read access to spreadsheets
- `https://www.googleapis.com/auth/drive.readonly` - Read access to Google Drive files

**For Google Docs:**

- `https://www.googleapis.com/auth/documents.readonly` - Read access to documents
- `https://www.googleapis.com/auth/drive.readonly` - Read access to Google Drive files

### 2. Why Both Scopes Are Needed

**Spreadsheets/Documents Scope:**

- Provides access to the content of the specific file type
- Allows reading data from the spreadsheet/document

**Drive Scope:**

- Provides access to file metadata and permissions
- Enables discovery of files the user has access to
- Required for accessing private files that aren't publicly shared

### 3. User Permission Model

The system respects Google's permission model:

**What Users Can Access:**

- Files they own
- Files shared with them directly
- Files shared with groups they belong to
- Files in shared drives they have access to

**What Users Cannot Access:**

- Files they don't have permission to view
- Files in private domains they're not part of
- Files with restricted sharing settings

## Implementation Details

### OAuth Flow

```javascript
// 1. User initiates connection
const response = await fetch("/api/external-connections", {
  method: "POST",
  body: JSON.stringify({
    connectionType: "google-sheets",
    connectionConfig: {
      name: "My Private Sheet",
      sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    },
  }),
});

// 2. System generates OAuth URL with proper scopes
const authResponse = await fetch(
  `/api/oauth/google?connectionId=${connectionId}&scopes=sheets`
);
const { authUrl } = await authResponse.json();

// 3. User is redirected to Google OAuth
// Google shows permission screen with:
// - "View your Google Sheets"
// - "View your Google Drive files"

// 4. User grants permissions
// 5. System exchanges code for tokens with both scopes
// 6. Tokens are stored encrypted in database
```

### Token Storage

```sql
-- OAuth tokens are stored with all granted scopes
INSERT INTO oauth_tokens (
  connection_id,
  provider,
  access_token_encrypted,
  refresh_token_encrypted,
  scope
) VALUES (
  'connection-uuid',
  'google',
  'encrypted_access_token',
  'encrypted_refresh_token',
  ARRAY[
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
);
```

### Access Verification

The system verifies access before attempting to read files:

```typescript
// Check if user has access to the specific file
const fileResponse = await drive.files.get({
  fileId: sheetId,
  fields: "id,name,permissions",
});

// If successful, user has access
// If error, user doesn't have permission
```

## Security Considerations

### 1. Principle of Least Privilege

- Only requests read-only access
- No write permissions to user files
- No access to user's personal data beyond specified files

### 2. Token Security

- OAuth tokens are encrypted before storage
- Tokens are user-specific and cannot be shared
- Automatic token refresh maintains access securely

### 3. Access Validation

- System validates user permissions before data access
- Respects Google Workspace domain policies
- Cannot bypass Google's sharing settings

## Common Scenarios

### Scenario 1: User's Own Private Sheet

**Setup:**

1. User creates a private Google Sheet
2. User connects it to the system
3. OAuth flow requests permissions
4. User grants access to their own file

**Result:** ✅ Full access to sheet data

### Scenario 2: Shared Private Sheet

**Setup:**

1. User is shared a private Google Sheet by a colleague
2. User connects it to the system
3. OAuth flow requests permissions
4. User grants access

**Result:** ✅ Full access to sheet data (if user has view permissions)

### Scenario 3: Restricted Sheet

**Setup:**

1. User tries to connect a sheet they don't have access to
2. OAuth flow requests permissions
3. User grants access, but Google denies it

**Result:** ❌ Access denied - system cannot read the file

### Scenario 4: Domain-Restricted Sheet

**Setup:**

1. User tries to connect a sheet from a different Google Workspace domain
2. Sheet has domain restrictions
3. User is not part of the allowed domain

**Result:** ❌ Access denied - domain policy prevents access

## Troubleshooting

### "Access Denied" Errors

**Possible Causes:**

1. User doesn't have permission to the file
2. File is in a restricted domain
3. OAuth scopes are insufficient
4. Token has expired and refresh failed

**Solutions:**

1. Verify user has access to the file in Google Drive
2. Check if file is in a shared drive the user can access
3. Ensure both `spreadsheets.readonly` and `drive.readonly` scopes are granted
4. Re-authenticate to get fresh tokens

### "File Not Found" Errors

**Possible Causes:**

1. Incorrect file ID
2. File has been deleted
3. File has been moved or renamed

**Solutions:**

1. Verify the file ID is correct
2. Check if file still exists in Google Drive
3. Update connection with correct file ID

### "Insufficient Permissions" Errors

**Possible Causes:**

1. Missing `drive.readonly` scope
2. Token doesn't have required permissions
3. File permissions changed after connection

**Solutions:**

1. Re-authenticate to get proper scopes
2. Check file sharing settings in Google Drive
3. Verify user still has access to the file

## Best Practices

### 1. User Education

- Explain what permissions are being requested
- Clarify that only read access is needed
- Show which files will be accessible

### 2. Error Handling

- Provide clear error messages for access issues
- Guide users to check file permissions
- Offer re-authentication when needed

### 3. Security

- Never store unencrypted tokens
- Regularly refresh tokens
- Monitor for unusual access patterns

## Testing Private Access

### Test Cases

1. **Own Private File**

   - Create a private Google Sheet
   - Connect it to the system
   - Verify data is accessible

2. **Shared Private File**

   - Share a private sheet with a test user
   - Have test user connect it
   - Verify data is accessible

3. **Restricted File**

   - Try to connect a file the user doesn't have access to
   - Verify access is properly denied

4. **Domain Restrictions**
   - Test with files from different Google Workspace domains
   - Verify domain policies are respected

### Test Data

```javascript
// Test with various file types and permissions
const testCases = [
  {
    name: "Own Private Sheet",
    sheetId: "user_owned_private_sheet_id",
    expectedAccess: true,
  },
  {
    name: "Shared Private Sheet",
    sheetId: "shared_private_sheet_id",
    expectedAccess: true,
  },
  {
    name: "Public Sheet",
    sheetId: "public_sheet_id",
    expectedAccess: true,
  },
  {
    name: "Restricted Sheet",
    sheetId: "restricted_sheet_id",
    expectedAccess: false,
  },
];
```

## Conclusion

The system ensures access to private Google Sheets and Docs through:

1. **Proper OAuth Scopes** - Both file-specific and Drive scopes
2. **User Permission Respect** - Only accesses files the user can view
3. **Secure Token Management** - Encrypted storage and automatic refresh
4. **Access Validation** - Verifies permissions before data access
5. **Clear Error Handling** - Guides users when access issues occur

This approach provides secure, reliable access to private documents while respecting Google's permission model and maintaining user privacy.
