# Database Setup Instructions

## Step 1: Run the Database Schema

You need to run the SQL schema in your Supabase database to create the required tables for OAuth integration.

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `scripts/database-schema.sql`
4. Paste and run the SQL

### Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db reset
# Then run the schema
```

## Step 2: Verify Tables Exist

After running the schema, verify these tables exist:

- `oauth_tokens`
- `external_connections`
- `workspace_data_sources`

## Step 3: Test OAuth Flow

Once the tables exist, the Google Docs OAuth flow should work properly.

## Required Tables for OAuth

The following tables are required for Google Docs OAuth integration:

### oauth_tokens

- Stores encrypted OAuth access and refresh tokens
- Links to external_connections via connection_id

### external_connections

- Stores connection configurations
- Includes Google Docs connections with document IDs

### workspace_data_sources

- Links data sources to workspaces
- Enables AI agents to find and use connections

## Troubleshooting

If you still get "Failed to store OAuth tokens" error:

1. Check that the tables exist in your database
2. Verify your Supabase connection is working
3. Check the server logs for detailed error messages
