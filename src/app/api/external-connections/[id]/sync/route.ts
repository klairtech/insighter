import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject } from '@/lib/encryption'

interface SyncResult {
  success: boolean
  recordsProcessed?: number
  error?: string
  tokensUsed?: number
  inputTokens?: number
  outputTokens?: number
  schema?: {
    tables: Array<{
      name: string
      type: string
      columns: Array<{
        name: string
        type: string
        nullable: boolean
        sample_values: string[]
        ai_definition?: any
      }>
      row_count: number
      ai_definition?: any
    }>
    ai_definition?: any
  }
  summary?: string
  rowCount?: number
  columnCount?: number
  contentSize?: number
  contentHash?: string
  sampleData?: any
}
import { generateMultipleTablesBatchAIDefinitions } from '@/lib/hierarchical-ai-generation'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'
import { calculateCreditsForTokens, deductCredits, logCreditUsage } from '@/lib/credit-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params
    const { syncType = 'full' } = await request.json()

    // Get external connection
    const { data: connection, error } = await supabaseServer
      .from('external_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'External connection not found' }, { status: 404 })
    }

    // Check workspace access
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', connection.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', session.userId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Decrypt connection config
    const connectionConfig = decryptObject(connection.config_encrypted)
    
    console.log(`🔄 Starting ${syncType} sync for ${connection.type} connection: ${connection.name}`)

    // Update connection status to syncing
    await supabaseServer
      .from('external_connections')
      .update({ connection_status: 'syncing' })
      .eq('id', connectionId)

    let syncResult: SyncResult = { success: false }
    let totalTokensUsed = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    try {
      // Route to appropriate sync handler based on connection type
      switch (connection.type) {
        case 'google-sheets':
          syncResult = await syncGoogleSheets(connection, connectionConfig, syncType)
          break
        case 'google-docs':
          syncResult = await syncGoogleDocs(connection, connectionConfig, syncType)
          break
        case 'web-url':
          syncResult = await syncWebURL(connection, connectionConfig as { url: string; [key: string]: unknown }, syncType)
          break
        case 'google-analytics':
          syncResult = await syncGoogleAnalytics(connection, connectionConfig, syncType)
          break
        default:
          throw new Error(`Unsupported connection type: ${connection.type}`)
      }

      totalTokensUsed = syncResult.tokensUsed || 0
      totalInputTokens = syncResult.inputTokens || 0
      totalOutputTokens = syncResult.outputTokens || 0

      // Generate AI definitions if we have structured data
      if (syncResult.schema && syncResult.schema.tables && syncResult.schema.tables.length > 0) {
        console.log(`🤖 Generating AI definitions for ${syncResult.schema.tables.length} tables`)
        
        const {
          results: batchResults,
          totalTokensUsed: aiTokens,
          totalInputTokens: aiInputTokens,
          totalOutputTokens: aiOutputTokens
        } = await generateMultipleTablesBatchAIDefinitions(
          syncResult.schema.tables as any,
          connection.name,
          connection.type,
          3
        )

        totalTokensUsed += aiTokens
        totalInputTokens += aiInputTokens
        totalOutputTokens += aiOutputTokens

        // Apply AI definitions to schema
        for (const [tableName, { tableDefinition, columnDefinitions }] of batchResults) {
          const table = syncResult.schema.tables.find((t: { name: string }) => t.name === tableName)
          if (table) {
            (table as { ai_definition?: unknown }).ai_definition = tableDefinition
            if ((table as { columns?: Array<{ name: string }> }).columns) {
              for (const columnDef of columnDefinitions) {
                const column = (table as { columns: Array<{ name: string }> }).columns.find((c: { name: string }) => c.name === columnDef.name)
                if (column) {
                  (column as { ai_definition?: unknown }).ai_definition = columnDef
                }
              }
            }
          }
        }

        // Generate database-level AI definition
        const tableInsights = Array.from(batchResults.values()).map(({ tableDefinition }) => tableDefinition)
        const allKeyEntities = tableInsights.flatMap(t => Array.isArray(t.key_entities) ? t.key_entities : [t.key_entities]).filter(Boolean)
        const allUseCases = tableInsights.flatMap(t => Array.isArray(t.common_use_cases) ? t.common_use_cases : [t.common_use_cases]).filter(Boolean)
        
        syncResult.schema.ai_definition = {
          description: `${connection.name} data source containing ${syncResult.schema.tables.length} data structures`,
          business_purpose: tableInsights.length > 0 ? 
            tableInsights[0].business_purpose || "Data storage and management with intelligent analysis capabilities" :
            "Data storage and management with intelligent analysis capabilities",
          key_entities: [...new Set(allKeyEntities)].slice(0, 10),
          common_use_cases: [...new Set(allUseCases)].slice(0, 8),
          data_relationships: ["Data relationships within the source"],
          table_summary: `Data source contains ${syncResult.schema.tables.length} structured data elements`,
          overall_architecture: "External data source with structured content",
          data_flow_analysis: "Data flows from external source to internal analysis"
        }
      }

      // Update connection with sync results
      const updateData: {
        connection_status: string
        last_sync: string
        content_summary: string
        row_count: number
        column_count: number
        content_size_bytes?: number
        last_content_hash?: string | null
        schema_metadata?: unknown
        data_sample?: unknown
        ai_definitions?: unknown
      } = {
        connection_status: 'active',
        last_sync: new Date().toISOString(),
        content_summary: syncResult.summary || 'Data synchronized successfully',
        row_count: syncResult.rowCount || 0,
        column_count: syncResult.columnCount || 0,
        content_size_bytes: syncResult.contentSize || 0,
        last_content_hash: syncResult.contentHash || null
      }

      // Add schema metadata if available
      if (syncResult.schema) {
        updateData.schema_metadata = syncResult.schema
        updateData.ai_definitions = syncResult.schema.ai_definition || {}
        updateData.data_sample = syncResult.sampleData || {}
      }

      await supabaseServer
        .from('external_connections')
        .update(updateData)
        .eq('id', connectionId)

      // Deduct credits for AI processing
      if (totalTokensUsed > 0) {
        console.log(`💳 Deducting credits for AI data analysis: ${totalTokensUsed} tokens used`)
        
        const creditsUsed = calculateCreditsForTokens(totalTokensUsed)
        
        if (creditsUsed > 0) {
          const creditResult = await deductCredits(
            session.user.id, 
            creditsUsed, 
            `External Data AI Analysis - ${connection.name} (${connection.type})`
          )
          
          if (creditResult.success) {
            console.log(`✅ Successfully deducted ${creditsUsed} credits for external data AI analysis. Remaining: ${creditResult.remainingCredits}`)
            
            // Log credit usage for analytics
            await logCreditUsage(
              session.user.id,
              'external-data-ai-analysis',
              connectionId,
              totalTokensUsed,
              creditsUsed,
              `External Data AI Analysis - ${connection.name} (${connection.type})`
            )
          }
        }
      }

      // Save token usage
      if (totalTokensUsed > 0) {
        try {
          await saveTokenUsageToDatabase(
            session.userId,
            {
              userInputTokens: 0,
              systemPromptTokens: 0,
              contextTokens: 0,
              routerAgentTokens: 0,
              qaAgentTokens: 0,
              fileContentTokens: 0,
              conversationHistoryTokens: 0,
              agentResponseTokens: totalOutputTokens,
              totalInputTokens: totalInputTokens,
              totalProcessingTokens: 0,
              totalOutputTokens: totalOutputTokens,
              totalTokensUsed: totalTokensUsed,
              stageBreakdown: {
                input: totalInputTokens,
                routing: 0,
                fileProcessing: 0,
                qaGeneration: 0,
                output: totalOutputTokens
              }
            },
            'chat'
          )
        } catch (tokenError) {
          console.warn('Failed to save token usage:', tokenError)
        }
      }

      // Log sync completion
      await supabaseServer
        .from('external_connection_syncs')
        .insert({
          connection_id: connectionId,
          sync_type: syncType,
          status: 'success',
          records_processed: syncResult.recordsProcessed || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      console.log(`✅ Sync completed successfully for ${connection.name}`)

      return NextResponse.json({
        success: true,
        message: 'Data synchronized successfully',
        syncResult: {
          recordsProcessed: syncResult.recordsProcessed || 0,
          summary: syncResult.summary,
          tokensUsed: totalTokensUsed,
          tablesProcessed: syncResult.schema?.tables?.length || 0
        }
      })

    } catch (syncError) {
      console.error('❌ Sync failed:', syncError)
      
      // Update connection status to error
      await supabaseServer
        .from('external_connections')
        .update({ connection_status: 'error' })
        .eq('id', connectionId)

      // Log sync failure
      await supabaseServer
        .from('external_connection_syncs')
        .insert({
          connection_id: connectionId,
          sync_type: syncType,
          status: 'error',
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      return NextResponse.json({ 
        error: 'Sync failed', 
        details: syncError instanceof Error ? syncError.message : 'Unknown error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('External connection sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Google Sheets sync handler
async function syncGoogleSheets(connection: { id: string; name: string; type: string }, config: { sheetId?: string; url?: string; [key: string]: unknown }, _syncType: string): Promise<SyncResult> {
  console.log(`📊 Syncing Google Sheets: ${config.sheetId || config.url}`)
  
  try {
    // Get OAuth tokens from database
    const { data: oauthTokens, error: tokenError } = await supabaseServer
      .from('oauth_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, expires_at')
      .eq('connection_id', connection.id)
      .eq('provider', 'google')
      .single()

    if (tokenError || !oauthTokens) {
      throw new Error('No OAuth tokens found for Google Sheets connection')
    }

    // Decrypt tokens
    const accessToken = decryptObject(oauthTokens.access_token_encrypted)
    const refreshToken = oauthTokens.refresh_token_encrypted ? 
      decryptObject(oauthTokens.refresh_token_encrypted) : undefined

    // Initialize Google Sheets connector
    const { GoogleSheetsConnector } = await import('@/lib/datasources/google-sheets')
    const connector = new GoogleSheetsConnector(accessToken as any, refreshToken as any)

    // Fetch sheet data
    const sheetData = await connector.fetchSheetData({
      sheetId: config.sheetId as string,
      sheetName: config.sheetName as string | undefined,
      range: config.range as string | undefined,
      includeHeaders: config.includeHeaders !== false,
      maxRows: (config.maxRows as number) || 1000
    })

    // Generate schema
    const schema = connector.generateSchema(sheetData, sheetData.metadata.sheetName)

    // Store data in database
    await connector.storeSheetData(connection.id, sheetData, schema)

    return {
      success: true,
      recordsProcessed: sheetData.metadata.rowCount,
      summary: `Synced ${sheetData.metadata.rowCount} rows from ${sheetData.metadata.sheetName}`,
      schema,
      rowCount: sheetData.metadata.rowCount,
      columnCount: sheetData.metadata.columnCount,
      contentSize: JSON.stringify(sheetData).length,
      contentHash: `sheet_${sheetData.metadata.sheetName}_${Date.now()}`,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    }

  } catch (error) {
    console.error('Google Sheets sync error:', error)
    throw new Error(`Google Sheets sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Google Docs sync handler
async function syncGoogleDocs(connection: { id: string; name: string; type: string }, config: { documentId?: string; url?: string; [key: string]: unknown }, _syncType: string): Promise<SyncResult> {
  console.log(`📄 Syncing Google Docs: ${config.documentId || config.url}`)
  
  try {
    // Get OAuth tokens from database
    const { data: oauthTokens, error: tokenError } = await supabaseServer
      .from('oauth_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, expires_at')
      .eq('connection_id', connection.id)
      .eq('provider', 'google')
      .single()

    if (tokenError || !oauthTokens) {
      throw new Error('No OAuth tokens found for Google Docs connection')
    }

    // Decrypt tokens
    const accessToken = decryptObject(oauthTokens.access_token_encrypted)
    const refreshToken = oauthTokens.refresh_token_encrypted ? 
      decryptObject(oauthTokens.refresh_token_encrypted) : undefined

    // Initialize Google Docs connector
    const { GoogleDocsConnector } = await import('@/lib/datasources/google-docs')
    const connector = new GoogleDocsConnector(accessToken as any, refreshToken as any)

    // Fetch document data
    const docData = await connector.fetchDocumentData({
      documentId: config.documentId as string,
      includeFormatting: config.includeFormatting !== false,
      maxSections: (config.maxSections as number) || 100
    })

    // Generate schema
    const schema = connector.generateSchema(docData)

    // Store data in database
    await connector.storeDocumentData(connection.id, docData, schema)

    return {
      success: true,
      recordsProcessed: docData.metadata.sectionCount,
      summary: `Synced ${docData.metadata.sectionCount} sections from ${docData.title}`,
      schema,
      rowCount: docData.metadata.sectionCount,
      columnCount: schema.tables[0]?.columns?.length || 0,
      contentSize: docData.metadata.wordCount,
      contentHash: `doc_${config.documentId}_${Date.now()}`,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    }

  } catch (error) {
    console.error('Google Docs sync error:', error)
    throw new Error(`Google Docs sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Web URL sync handler
async function syncWebURL(connection: { id: string; name: string; type: string }, config: { url: string; [key: string]: unknown }, _syncType: string): Promise<SyncResult> {
  console.log(`🌐 Syncing Web URL: ${config.url}`)
  
  try {
    // Initialize web scraper connector
    const { WebScraperConnector } = await import('@/lib/datasources/web-scraper')
    const connector = new WebScraperConnector({
      url: config.url,
      selectors: config.selectors as { title?: string; content?: string; exclude?: string[]; include?: string[] } | undefined,
      maxContentLength: (config.maxContentLength as number) || 50000,
      includeImages: (config.includeImages as boolean) || false,
      includeLinks: config.includeLinks !== false,
      respectRobotsTxt: config.respectRobotsTxt !== false,
      userAgent: config.userAgent as string | undefined,
      timeout: (config.timeout as number) || 30000
    })

    // Scrape the URL
    const scrapedData = await connector.scrapeUrl()

    // Generate schema
    const schema = connector.generateSchema(scrapedData)

    // Store data in database
    await connector.storeScrapedData(connection.id, scrapedData, schema)

    return {
      success: true,
      recordsProcessed: 1, // Single page scraped
      summary: `Scraped ${scrapedData.metadata.wordCount} words from ${scrapedData.title}`,
      schema,
      rowCount: 1,
      columnCount: schema.tables[0]?.columns?.length || 0,
      contentSize: scrapedData.metadata.contentLength,
      contentHash: scrapedData.metadata.scrapedAt,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    }

  } catch (error) {
    console.error('Web URL sync error:', error)
    throw new Error(`Web URL sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Google Analytics sync handler
async function syncGoogleAnalytics(connection: { id: string; name: string; type: string }, config: { propertyId?: string; url?: string; [key: string]: unknown }, _syncType: string): Promise<SyncResult> {
  console.log(`📊 Syncing Google Analytics: ${config.propertyId || config.url}`)
  
  try {
    // Get OAuth tokens from database
    const { data: oauthTokens, error: tokenError } = await supabaseServer
      .from('oauth_tokens')
      .select('access_token_encrypted, refresh_token_encrypted, expires_at')
      .eq('connection_id', connection.id)
      .eq('provider', 'google')
      .single()

    if (tokenError || !oauthTokens) {
      throw new Error('No OAuth tokens found for Google Analytics connection')
    }

    // Decrypt tokens
    const accessToken = decryptObject(oauthTokens.access_token_encrypted)
    const refreshToken = oauthTokens.refresh_token_encrypted ? 
      decryptObject(oauthTokens.refresh_token_encrypted) : undefined

    // Initialize Google Analytics connector
    const { GoogleAnalyticsConnector } = await import('@/lib/datasources/google-analytics')
    const connector = new GoogleAnalyticsConnector(accessToken as any, refreshToken as any)

    // Fetch analytics data
    const analyticsData = await connector.fetchAnalyticsData({
      propertyId: config.propertyId as string,
      startDate: config.startDate as string | undefined,
      endDate: config.endDate as string | undefined,
      metrics: config.metrics as string[] | undefined,
      dimensions: config.dimensions as string[] | undefined,
      maxResults: (config.maxResults as number) || 1000,
      includeRealtime: config.includeRealtime !== false
    })

    // Generate schema
    const schema = connector.generateSchema(analyticsData)

    // Store data in database
    await connector.storeAnalyticsData(connection.id, analyticsData, schema)

    const totalRecords = analyticsData.reports.reduce((sum, report) => sum + report.metadata.rowCount, 0)

    return {
      success: true,
      recordsProcessed: totalRecords,
      summary: `Synced ${totalRecords} analytics records from ${analyticsData.propertyName}`,
      schema,
      rowCount: totalRecords,
      columnCount: schema.tables.reduce((sum, table) => sum + table.columns.length, 0),
      contentSize: JSON.stringify(analyticsData).length,
      contentHash: `analytics_${config.propertyId}_${Date.now()}`,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    }

  } catch (error) {
    console.error('Google Analytics sync error:', error)
    throw new Error(`Google Analytics sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
