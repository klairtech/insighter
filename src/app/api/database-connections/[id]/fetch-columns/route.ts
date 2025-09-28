import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject, encryptObject } from '@/lib/encryption'
import { Client } from 'pg'
import mysql from 'mysql2/promise'

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
    const { tableNames } = await request.json()

    if (!tableNames || !Array.isArray(tableNames)) {
      return NextResponse.json({ error: 'Table names array is required' }, { status: 400 })
    }

    // Get database connection with encrypted config
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Check access permissions
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', connection.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

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
    const connectionConfig = decryptObject(connection.connection_config_encrypted) as { type: string; host: string; port: string; database: string; username: string; password: string; ssl?: boolean }
    
    // Fetch column details based on database type
    let columnDetails: Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>> = {}
    
    if (connectionConfig.type === 'postgresql') {
      columnDetails = await fetchPostgreSQLColumns(connectionConfig, tableNames, connection.schema_name)
    } else if (connectionConfig.type === 'mysql') {
      columnDetails = await fetchMySQLColumns(connectionConfig, tableNames, connection.schema_name)
    } else if (connectionConfig.type === 'redshift') {
      columnDetails = await fetchRedshiftColumns(connectionConfig, tableNames, connection.schema_name)
    } else {
      return NextResponse.json({ error: 'Column fetching not supported for this database type' }, { status: 400 })
    }

    // Update the schema with column details
    const { data: currentSchema, error: schemaError } = await supabaseServer
      .from('database_connections')
      .select('schema_info_encrypted')
      .eq('id', connectionId)
      .single()

    if (schemaError || !currentSchema) {
      return NextResponse.json({ error: 'Failed to fetch current schema' }, { status: 500 })
    }

    // Decrypt and update schema
    const decryptedSchema = decryptObject(currentSchema.schema_info_encrypted) as { schema: { tables?: Array<{ name: string; columns?: unknown[] }>; views?: Array<{ name: string; columns?: unknown[] }> } }
    const schema = decryptedSchema.schema

    // Update tables and views with column details
    if (schema.tables) {
      for (const table of schema.tables) {
        if (tableNames.includes(table.name) && columnDetails[table.name]) {
          table.columns = columnDetails[table.name]
        }
      }
    }

    if (schema.views) {
      for (const view of schema.views) {
        if (tableNames.includes(view.name) && columnDetails[view.name]) {
          view.columns = columnDetails[view.name]
        }
      }
    }

    // Encrypt and save updated schema
    const encryptedSchema = encryptObject({ schema })
    
    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_info_encrypted: encryptedSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating schema:', updateError)
      return NextResponse.json({ error: 'Failed to update schema' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Column details fetched for ${tableNames.length} tables`,
      column_details: columnDetails
    })

  } catch (error) {
    console.error('Error fetching column details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchPostgreSQLColumns(config: { host: string; port: string; database: string; username: string; password: string; ssl?: boolean }, tableNames: string[], schemaName: string): Promise<Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>>> {
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
    
    const columnDetails: Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>> = {}
    
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
        is_nullable: row.is_nullable === 'YES',
        default_value: row.column_default,
        is_primary_key: row.is_primary_key,
        is_foreign_key: row.is_foreign_key,
        foreign_key_info: row.is_foreign_key ? {
          referenced_table: row.foreign_table_name,
          referenced_column: row.foreign_column_name
        } : null,
        sample_values: [], // Will be populated below
        ai_definition: null // Will be populated by AI generation
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
          // If we can't get sample data, just continue
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

async function fetchMySQLColumns(config: { host: string; port: string; database: string; username: string; password: string; ssl?: boolean }, tableNames: string[], schemaName: string): Promise<Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>>> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: parseInt(config.port) || 3306,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const columnDetails: Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>> = {}
    
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
      
      columnDetails[tableName] = (columns as Array<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT?: string; COLUMN_KEY?: string }>).map(row => ({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        is_nullable: row.IS_NULLABLE === 'YES',
        default_value: row.COLUMN_DEFAULT,
        is_primary_key: row.COLUMN_KEY === 'PRI',
        is_foreign_key: row.COLUMN_KEY === 'MUL',
        foreign_key_info: null, // Would need additional query for MySQL
        sample_values: [], // Will be populated below
        ai_definition: null
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
          // If we can't get sample data, just continue
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

async function fetchRedshiftColumns(config: { host: string; port: string; database: string; username: string; password: string; ssl?: boolean }, tableNames: string[], schemaName: string): Promise<Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>>> {
  const client = new Client({
    host: config.host,
    port: parseInt(config.port) || 5439,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : true, // Redshift requires SSL
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    
    const columnDetails: Record<string, Array<{ name: string; type: string; is_nullable: boolean; column_default?: string; is_primary_key?: boolean; is_foreign_key?: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[] }>> = {}
    
    for (const tableName of tableNames) {
      // Get column information for Redshift
      const columnQuery = `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
          fk.foreign_table_name,
          fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT ku.column_name, ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1 AND c.table_schema = $2
        ORDER BY c.ordinal_position
      `
      
      const result = await client.query(columnQuery, [tableName, schemaName])
      
      const columns = result.rows.map(row => ({
        name: row.column_name,
        type: row.data_type,
        is_nullable: row.is_nullable === 'YES',
        column_default: row.column_default,
        is_primary_key: row.is_primary_key,
        is_foreign_key: row.is_foreign_key,
        foreign_table: row.foreign_table_name,
        foreign_column: row.foreign_column_name,
        sample_values: [] as string[] // Will be populated below
      }))
      
      // Get sample values for each column (limit to 5 samples)
      for (const column of columns) {
        try {
          const sampleQuery = `SELECT ${column.name} FROM ${schemaName}.${tableName} WHERE ${column.name} IS NOT NULL LIMIT 5`
          const sampleResult = await client.query(sampleQuery)
          column.sample_values = sampleResult.rows
            .map(row => String(row[column.name]))
            .filter(val => val && val.length > 0) as string[]
        } catch (_error) {
          // If we can't get sample data, just continue
          column.sample_values = []
        }
      }
      
      columnDetails[tableName] = columns
    }
    
    await client.end()
    return columnDetails
    
  } catch (error) {
    await client.end()
    throw error
  }
}
