# External Data Sources Implementation

This document outlines the implementation of external data source connectors for Google Sheets, Google Docs, and public web URLs, following the same patterns as the existing PostgreSQL and Redshift database connections.

## Overview

The system now supports four new types of external data sources:

1. **Google Sheets** - Connect to Google Sheets spreadsheets via OAuth
2. **Google Docs** - Connect to Google Docs documents via OAuth
3. **Public Web URLs** - Scrape content from public websites
4. **Google Analytics** - Connect to Google Analytics properties via OAuth

All implementations follow the same architectural patterns as database connections:

- Encrypted storage of credentials and data
- AI-powered analysis and schema generation
- Credit system integration
- Workspace-based access control
- Hierarchical AI definitions (column/table/database level)

## Database Schema

### New Tables

#### `web_scraped_content`

Stores scraped content from web URLs:

```sql
CREATE TABLE web_scraped_content (
  id uuid PRIMARY KEY,
  connection_id uuid REFERENCES external_connections(id),
  url text NOT NULL,
  title text,
  content_encrypted text NOT NULL,
  content_hash text NOT NULL,
  content_type text DEFAULT 'html',
  metadata jsonb DEFAULT '{}',
  scraped_at timestamp with time zone DEFAULT now(),
  content_size_bytes integer DEFAULT 0,
  word_count integer DEFAULT 0,
  language text DEFAULT 'en'
);
```

#### `spreadsheet_data`

Stores Google Sheets data in a normalized format:

```sql
CREATE TABLE spreadsheet_data (
  id uuid PRIMARY KEY,
  connection_id uuid REFERENCES external_connections(id),
  sheet_name text NOT NULL,
  row_index integer NOT NULL,
  column_index integer NOT NULL,
  cell_value_encrypted text,
  cell_type text DEFAULT 'text',
  cell_format jsonb DEFAULT '{}',
  is_header boolean DEFAULT false
);
```

#### `document_content`

Stores Google Docs content in structured sections:

```sql
CREATE TABLE document_content (
  id uuid PRIMARY KEY,
  connection_id uuid REFERENCES external_connections(id),
  section_title text,
  section_content_encrypted text NOT NULL,
  section_type text DEFAULT 'paragraph',
  section_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  word_count integer DEFAULT 0
);
```

#### `oauth_tokens`

Manages OAuth tokens for Google services:

```sql
CREATE TABLE oauth_tokens (
  id uuid PRIMARY KEY,
  connection_id uuid REFERENCES external_connections(id),
  provider text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamp with time zone,
  scope text[] DEFAULT '{}'
);
```

#### `analytics_data`

Stores Google Analytics data:

```sql
CREATE TABLE analytics_data (
  id uuid PRIMARY KEY,
  connection_id uuid REFERENCES external_connections(id),
  report_name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('standard', 'realtime')),
  date date NOT NULL,
  dimensions_encrypted text NOT NULL,
  metrics_encrypted text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### Updated Tables

#### `external_connections`

Enhanced to support new data source types:

```sql
ALTER TABLE external_connections ADD COLUMN:
- oauth_provider text
- oauth_scopes text[]
- refresh_token_encrypted text
- token_expires_at timestamp with time zone
- web_scraping_config jsonb
- content_filters jsonb
- sync_frequency text
- last_content_hash text
- content_size_bytes integer
- row_count integer
- column_count integer
```

## API Endpoints

### External Connections Management

#### `GET /api/external-connections`

List all external connections for a workspace.

#### `POST /api/external-connections`

Create a new external connection.

**Request Body:**

```json
{
  "workspaceId": "uuid",
  "connectionType": "google-sheets|google-docs|web-url|google-analytics",
  "connectionConfig": {
    "name": "My Google Sheet",
    "sheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Sheet1",
    "range": "A:Z",
    "includeHeaders": true,
    "maxRows": 1000
  },
  "contentType": "spreadsheet|document|web-page|analytics",
  "oauthProvider": "google",
  "oauthScopes": ["sheets", "docs"],
  "webScrapingConfig": {
    "selectors": {
      "title": "h1",
      "content": ".main-content",
      "exclude": [".ads", ".sidebar"]
    },
    "maxContentLength": 50000,
    "includeImages": false,
    "includeLinks": true,
    "respectRobotsTxt": true
  },
  "syncFrequency": "manual|hourly|daily|weekly|monthly"
}
```

### OAuth Authentication

#### `GET /api/oauth/google`

Generate OAuth authorization URL for Google services.

**Query Parameters:**

- `connectionId`: UUID of the external connection
- `scopes`: Comma-separated list of scopes (sheets,docs,analytics)

**OAuth Scopes for Private Document Access:**

- **Google Sheets**: `spreadsheets.readonly` + `drive.readonly` (for private sheets)
- **Google Docs**: `documents.readonly` + `drive.readonly` (for private docs)
- **Google Analytics**: `analytics.readonly`

#### `POST /api/oauth/google`

Exchange OAuth authorization code for access tokens.

**Request Body:**

```json
{
  "code": "oauth_authorization_code",
  "state": "base64_encoded_state",
  "connectionId": "uuid"
}
```

### Data Synchronization

#### `POST /api/external-connections/[id]/sync`

Synchronize data from external source.

**Request Body:**

```json
{
  "syncType": "full|incremental|manual"
}
```

## Connector Implementations

### Google Sheets Connector (`/src/lib/connectors/google-sheets.ts`)

**Features:**

- OAuth 2.0 authentication with Google Sheets API
- Access to both public and private Google Sheets
- Automatic token refresh
- Data type detection (text, number, date, boolean, URL)
- Sample data collection for AI analysis
- Batch data storage with encryption
- Schema generation for AI processing

**Key Methods:**

- `fetchSheetData(config)` - Fetch data from Google Sheets
- `generateSchema(data, sheetName)` - Generate schema metadata
- `storeSheetData(connectionId, data, schema)` - Store data in database
- `getAuthUrl()` - Generate OAuth authorization URL
- `exchangeCodeForTokens(code)` - Exchange code for tokens

### Google Docs Connector (`/src/lib/connectors/google-docs.ts`)

**Features:**

- OAuth 2.0 authentication with Google Docs API
- Content parsing into structured sections (headings, paragraphs, lists, tables)
- Metadata extraction (word count, section count, last modified)
- Schema generation for document structure
- Encrypted content storage

**Key Methods:**

- `fetchDocumentData(config)` - Fetch document content
- `parseDocumentContent(document, config)` - Parse into sections
- `generateSchema(data)` - Generate schema metadata
- `storeDocumentData(connectionId, data, schema)` - Store content in database

### Web Scraper Connector (`/src/lib/connectors/web-scraper.ts`)

**Features:**

- Respectful web scraping with robots.txt compliance
- Content extraction with configurable selectors
- Structured data extraction (headings, tables, lists, links, images)
- Language detection
- Content change detection via hashing
- Configurable content length limits

**Key Methods:**

- `scrapeUrl()` - Scrape content from URL
- `extractStructuredData(document)` - Extract structured elements
- `generateSchema(data)` - Generate schema metadata
- `storeScrapedData(connectionId, data, schema)` - Store scraped content

### Google Analytics Connector (`/src/lib/connectors/google-analytics.ts`)

**Features:**

- OAuth 2.0 authentication with Google Analytics API
- Multiple report types (audience, traffic sources, content, devices)
- Real-time data support
- Configurable date ranges and metrics
- Automatic property information retrieval
- Schema generation for analytics data

**Key Methods:**

- `fetchAnalyticsData(config)` - Fetch analytics data from Google Analytics
- `fetchStandardReports(config)` - Fetch standard analytics reports
- `fetchRealtimeData(config)` - Fetch real-time analytics data
- `generateSchema(data)` - Generate schema metadata
- `storeAnalyticsData(connectionId, data, schema)` - Store analytics data

## AI Integration

All external data sources follow the same AI analysis pattern as database connections:

### 1. Schema Generation

- **Google Sheets**: Columns become database-like fields with data types
- **Google Docs**: Document sections become structured content fields
- **Web URLs**: Page elements become content fields (title, content, metadata)
- **Google Analytics**: Analytics dimensions and metrics become structured data fields

### 2. AI Definitions

- **Column/Field Level**: Business purpose, data insights, common queries
- **Table/Section Level**: Business purpose, key entities, use cases, relationships
- **Source Level**: Overall purpose, architecture, data flow analysis

### 3. Sample Data Analysis

- Collects sample values for AI analysis
- Identifies patterns and data types
- Generates business-focused descriptions

## Security Features

### Private Document Access

**Google Sheets & Docs:**

- Uses OAuth 2.0 with proper scopes for private document access
- `spreadsheets.readonly` + `drive.readonly` for Google Sheets
- `documents.readonly` + `drive.readonly` for Google Docs
- Users must explicitly grant permission during OAuth flow
- Access is limited to documents the user owns or has been granted access to
- No access to documents the user doesn't have permission to view

**Access Control:**

- OAuth tokens are user-specific and respect Google's permission model
- Cannot access documents the user hasn't been granted access to
- Respects Google Workspace domain policies and sharing settings
- Automatic token refresh maintains access without re-authorization

### Encryption

- All sensitive data encrypted at rest
- OAuth tokens encrypted before storage
- Content encrypted before database storage
- Connection configurations encrypted

### Access Control

- Workspace-based access control
- Organization membership verification
- Row-level security (RLS) policies
- OAuth state parameter validation

### Data Privacy

- Respects robots.txt for web scraping
- Configurable content length limits
- User-agent identification for transparency
- Content filtering capabilities

## Credit System Integration

The system integrates with the existing credit system:

### Token Usage Tracking

- AI analysis token usage tracked and logged
- Credit deduction for AI processing
- Usage analytics for external data sources

### Cost Calculation

- Credits calculated based on token usage
- Separate tracking for different data source types
- Batch processing for efficiency

## Usage Examples

### 1. Connect to Google Sheets

```javascript
// Create connection
const response = await fetch("/api/external-connections", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspaceId: "workspace-uuid",
    connectionType: "google-sheets",
    connectionConfig: {
      name: "Sales Data",
      sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      sheetName: "Sales",
      includeHeaders: true,
      maxRows: 1000,
    },
    contentType: "spreadsheet",
    oauthProvider: "google",
  }),
});

// Get OAuth URL
const authResponse = await fetch(
  `/api/oauth/google?connectionId=${connectionId}&scopes=sheets`
);
const { authUrl } = await authResponse.json();

// After user authorizes, exchange code for tokens
const tokenResponse = await fetch("/api/oauth/google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    code: "oauth_code",
    state: "state_parameter",
    connectionId: "connection-uuid",
  }),
});

// Sync data
const syncResponse = await fetch(
  `/api/external-connections/${connectionId}/sync`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ syncType: "full" }),
  }
);
```

### 2. Scrape Public Website

```javascript
// Create web scraping connection
const response = await fetch("/api/external-connections", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspaceId: "workspace-uuid",
    connectionType: "web-url",
    connectionConfig: {
      name: "Company Blog",
      url: "https://example.com/blog",
    },
    contentType: "web-page",
    webScrapingConfig: {
      selectors: {
        title: "h1",
        content: ".post-content",
        exclude: [".ads", ".sidebar"],
      },
      maxContentLength: 50000,
      includeLinks: true,
      respectRobotsTxt: true,
    },
  }),
});

// Sync data
const syncResponse = await fetch(
  `/api/external-connections/${connectionId}/sync`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ syncType: "full" }),
  }
);
```

### 3. Connect to Google Analytics

```javascript
// Create Google Analytics connection
const response = await fetch("/api/external-connections", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspaceId: "workspace-uuid",
    connectionType: "google-analytics",
    connectionConfig: {
      name: "Website Analytics",
      propertyId: "123456789",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      includeRealtime: true,
      maxResults: 1000,
    },
    contentType: "analytics",
    oauthProvider: "google",
  }),
});

// Get OAuth URL
const authResponse = await fetch(
  `/api/oauth/google?connectionId=${connectionId}&scopes=analytics`
);
const { authUrl } = await authResponse.json();

// After user authorizes, exchange code for tokens
const tokenResponse = await fetch("/api/oauth/google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    code: "oauth_code",
    state: "state_parameter",
    connectionId: "connection-uuid",
  }),
});

// Sync data
const syncResponse = await fetch(
  `/api/external-connections/${connectionId}/sync`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ syncType: "full" }),
  }
);
```

## Environment Variables

Add these environment variables to your `.env.local`:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

# Google Analytics API (included in Google Client ID above)
# Ensure your Google Cloud project has Analytics API enabled

# Web Scraping Configuration
WEB_SCRAPER_USER_AGENT=InsighterBot/1.0 (+https://insighter.ai/bot)
WEB_SCRAPER_TIMEOUT=30000
WEB_SCRAPER_MAX_CONTENT_LENGTH=50000
```

## Database Migration

Run the SQL migration script to add the new tables and columns:

```bash
psql -d your_database -f scripts/external-data-sources-schema.sql
```

## Testing

### Unit Tests

- Test connector classes with mock data
- Test OAuth flow with test credentials
- Test web scraping with test URLs

### Integration Tests

- Test full OAuth flow with Google APIs
- Test data synchronization end-to-end
- Test AI analysis with sample data

### Security Tests

- Test encryption/decryption of sensitive data
- Test access control and permissions
- Test OAuth state parameter validation

## Monitoring and Analytics

### Metrics to Track

- Sync success/failure rates by data source type
- Token usage and credit consumption
- Data volume processed per sync
- OAuth token refresh frequency
- Web scraping success rates

### Logging

- OAuth authentication events
- Data synchronization events
- AI analysis token usage
- Error rates and failure reasons

## Future Enhancements

### Planned Features

1. **Scheduled Sync**: Automatic periodic synchronization
2. **Change Detection**: Incremental sync based on content changes
3. **Data Transformation**: Custom data processing pipelines
4. **More Data Sources**: Notion, Airtable, Slack, GitHub, etc.
5. **Real-time Updates**: Webhook-based real-time synchronization
6. **Data Validation**: Schema validation and data quality checks
7. **Export Capabilities**: Export synchronized data to various formats

### Performance Optimizations

1. **Caching**: Redis-based caching for frequently accessed data
2. **Batch Processing**: Optimized batch operations for large datasets
3. **Parallel Processing**: Concurrent sync operations
4. **Compression**: Data compression for storage efficiency

## Troubleshooting

### Common Issues

#### OAuth Authentication Failures

- Verify Google OAuth credentials
- Check redirect URI configuration
- Ensure proper scopes are requested

#### Web Scraping Failures

- Check robots.txt compliance
- Verify URL accessibility
- Review content length limits

#### Google Analytics Failures

- Verify Google Analytics property ID
- Check OAuth token permissions
- Ensure Analytics API is enabled in Google Cloud Console
- Verify date range validity

#### Data Sync Issues

- Check OAuth token expiration
- Verify API rate limits
- Review error logs for specific failures

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=external-connectors:*
```

This will provide detailed logging for troubleshooting connector issues.
