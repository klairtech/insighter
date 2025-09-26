import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject, encryptText } from '@/lib/encryption'
import { generateHierarchicalAIDefinitions } from '@/lib/hierarchical-ai-generation'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'
import { DatabaseSchema, SelectedTable, DatabaseColumn, DatabaseConnectionConfig } from '@/types/database-schema'
import { Client } from 'pg'
import mysql from 'mysql2/promise'

interface ColumnDetails {
  [tableName: string]: DatabaseColumn[]
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get database connections for the workspace
    const { data: connections, error } = await supabaseServer
      .from('database_connections')
      .select('id, name, type, host, port, database, username, is_active, created_at, updated_at, last_schema_sync, schema_version, schema_name')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching database connections:', error)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connections: connections || []
    })

  } catch (error) {
    console.error('Database connections API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId, config, schema, selectedTables, schemaName = 'public' } = await request.json()

    if (!workspaceId || !config || !schema || !selectedTables) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Step 1: Save basic connection info
    
    const connectionConfig = {
      ...config,
      password: config.password || '',
      connectionString: config.connectionString || ''
    }

    const encryptedPassword = config.password ? encryptText(config.password) : null
    const encryptedConfig = encryptObject(connectionConfig)
    
    // Save connection with minimal schema (just table names)
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .insert([{
        workspace_id: workspaceId,
        name: config.name,
        type: config.type,
        host: config.host || '',
        port: parseInt(config.port) || 0,
        database: config.database,
        username: config.username || '',
        password_encrypted: encryptedPassword,
        connection_config_encrypted: encryptedConfig,
        schema_name: schemaName,
        schema_info_encrypted: encryptObject({ schema: schema as DatabaseSchema }),
        selected_tables_encrypted: encryptObject({ selectedTables: selectedTables as SelectedTable[] }),
        last_schema_sync: new Date().toISOString(),
        schema_version: 'v1',
        is_active: true
      }])
      .select('id, name, type, created_at, last_schema_sync')
      .single()

    if (connectionError || !connection) {
      console.error('❌ Error saving database connection:', connectionError)
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
    }

    console.log(`✅ Database connection created successfully: ${connection.id} for workspace ${workspaceId}`)

    // Step 2: Fetch column details for selected tables
    const tableNames = selectedTables.map((t: SelectedTable) => t.table_name)
    let columnDetails: ColumnDetails = {}
    
    if (config.type === 'postgresql') {
      columnDetails = await fetchPostgreSQLColumns(connectionConfig, tableNames, schemaName)
    } else if (config.type === 'mysql') {
      columnDetails = await fetchMySQLColumns(connectionConfig, tableNames, schemaName)
    }

    // Step 3: Update schema with column details
    const updatedSchema = { ...schema as DatabaseSchema }
    
    // Update tables with column details
    if (updatedSchema.tables) {
      for (const table of updatedSchema.tables) {
        if (tableNames.includes(table.name) && columnDetails[table.name]) {
          table.columns = columnDetails[table.name]
        }
      }
    }

    // Update views with column details
    if (updatedSchema.views) {
      for (const view of updatedSchema.views) {
        if (tableNames.includes(view.name) && columnDetails[view.name]) {
          view.columns = columnDetails[view.name]
        }
      }
    }

    // Step 4: Generate AI definitions
    let totalTokensUsed = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    
    console.log(`🔍 Schema structure before AI generation:`)
    console.log(`   - Tables: ${updatedSchema.tables?.length || 0}`)
    console.log(`   - Views: ${updatedSchema.views?.length || 0}`)
    console.log(`   - Selected tables: ${selectedTables.length}`)
    console.log(`   - Selected tables: ${selectedTables.map((t: SelectedTable) => t.table_name).join(', ')}`)
    
    // Check if tables have columns with sample data
    if (updatedSchema.tables) {
      for (const table of updatedSchema.tables) {
        if (tableNames.includes(table.name)) {
          console.log(`   - Table ${table.name}: ${table.columns?.length || 0} columns`)
          if (table.columns) {
            const columnsWithSampleData = table.columns.filter(col => col.sample_values && col.sample_values.length > 0)
            console.log(`     - Columns with sample data: ${columnsWithSampleData.length}`)
          }
        }
      }
    }
    
    try {
      const {
        columnDefinitions,
        tableDefinitions,
        databaseDefinition,
        totalTokensUsed: aiTokens,
        totalInputTokens: aiInputTokens,
        totalOutputTokens: aiOutputTokens
      } = await generateHierarchicalAIDefinitions(
        updatedSchema,
        selectedTables as SelectedTable[],
        config.name,
        config.type
      )

      totalTokensUsed = aiTokens
      totalInputTokens = aiInputTokens
      totalOutputTokens = aiOutputTokens

      // Apply AI definitions to schema
      // Apply column definitions
      for (const [columnKey, columnDef] of columnDefinitions) {
        const [tableName, columnName] = columnKey.split('.')
        
        // Find and update the column in tables
        const table = updatedSchema.tables?.find(t => t.name === tableName)
        if (table) {
          const column = table.columns?.find(c => c.name === columnName)
          if (column) {
            column.ai_definition = columnDef
          }
        }
        
        // Find and update the column in views
        const view = updatedSchema.views?.find(v => v.name === tableName)
        if (view) {
          const column = view.columns?.find(c => c.name === columnName)
          if (column) {
            column.ai_definition = columnDef
          }
        }
      }

      // Apply table definitions
      for (const [tableName, tableDef] of tableDefinitions) {
        // Update table
        const table = updatedSchema.tables?.find(t => t.name === tableName)
        if (table) {
          table.ai_definition = tableDef
        }
        
        // Update view
        const view = updatedSchema.views?.find(v => v.name === tableName)
        if (view) {
          view.ai_definition = tableDef
        }
      }

      // Apply database-level AI definition to the schema
      updatedSchema.ai_definition = databaseDefinition

    } catch (aiError) {
      console.warn('AI generation failed, continuing without AI definitions:', aiError)
      // Continue without AI definitions - connection is still valid
    }

    // Step 5: Single final write with complete schema
    const encryptedCompleteSchema = encryptObject({ schema: updatedSchema })
    
    const { error: finalUpdateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_info_encrypted: encryptedCompleteSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    if (finalUpdateError) {
      console.error('Error updating final schema:', finalUpdateError)
      return NextResponse.json({ error: 'Failed to save complete schema' }, { status: 500 })
    }

    console.log(`✅ Database connection created successfully: ${connection.id} for workspace ${workspaceId}`)

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

    return NextResponse.json({
      success: true,
      connection,
      connectionId: connection.id,
      message: 'Database connection setup completed successfully',
      columns_processed: Object.keys(columnDetails).length,
      tables_processed: selectedTables.length,
      tokens_used: totalTokensUsed
    })

  } catch (error) {
    console.error('Complete database setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions for fetching column details
async function fetchPostgreSQLColumns(config: DatabaseConnectionConfig, tableNames: string[], schemaName: string): Promise<ColumnDetails> {
  const client = new Client({
    host: config.host,
    port: parseInt(config.port) || 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    
    const columnDetails: ColumnDetails = {}
    
    for (const tableName of tableNames) {
      const columnsQuery = `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
          fk.foreign_table_name,
          fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT 
            ku.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `
      
      const result = await client.query(columnsQuery, [schemaName, tableName])
      
      columnDetails[tableName] = result.rows.map(row => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default_value: row.column_default,
        is_primary_key: row.is_primary_key,
        is_foreign_key: row.is_foreign_key,
        foreign_table: row.is_foreign_key ? row.foreign_table_name : undefined,
        foreign_column: row.is_foreign_key ? row.foreign_column_name : undefined,
        sample_values: [], // Will be populated below
        ai_definition: undefined // Will be populated by AI generation
      }))
      
      // Fetch sample values for each column
      for (const column of columnDetails[tableName]) {
        try {
          const sampleQuery = `
            SELECT ${column.name} 
            FROM ${tableName} 
            WHERE ${column.name} IS NOT NULL 
            LIMIT 5
          `
          const sampleResult = await client.query(sampleQuery)
          column.sample_values = sampleResult.rows
            .map(row => String(row[column.name]))
            .filter(val => val && val.length > 0)
        } catch {
          column.sample_values = []
        }
      }
    }
    
    await client.end()
    return columnDetails
    
  } catch (error) {
    await client.end()
    throw error
  }
}

async function fetchMySQLColumns(config: DatabaseConnectionConfig, tableNames: string[], schemaName: string): Promise<ColumnDetails> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const columnDetails: ColumnDetails = {}
    
    for (const tableName of tableNames) {
      const [columns] = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          COLUMN_KEY,
          EXTRA
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [schemaName, tableName])
      
      columnDetails[tableName] = (columns as Array<Record<string, unknown>>).map(row => ({
        name: String(row.COLUMN_NAME),
        type: String(row.DATA_TYPE),
        nullable: row.IS_NULLABLE === 'YES',
        default_value: row.COLUMN_DEFAULT ? String(row.COLUMN_DEFAULT) : undefined,
        is_primary_key: row.COLUMN_KEY === 'PRI',
        is_foreign_key: row.COLUMN_KEY === 'MUL',
        foreign_table: undefined,
        foreign_column: undefined,
        sample_values: [],
        ai_definition: undefined
      }))
      
      // Fetch sample values for each column
      for (const column of columnDetails[tableName]) {
        try {
          const [sampleResult] = await connection.execute(`
            SELECT ${column.name} 
            FROM ${tableName} 
            WHERE ${column.name} IS NOT NULL 
            LIMIT 5
          `)
          column.sample_values = (sampleResult as Array<Record<string, unknown>>)
            .map(row => String(row[column.name]))
            .filter(val => val && val.length > 0)
        } catch {
          column.sample_values = []
        }
      }
    }
    
    await connection.end()
    return columnDetails
    
  } catch (error) {
    await connection.end()
    throw error
  }
}
