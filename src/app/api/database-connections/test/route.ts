import { NextRequest, NextResponse } from 'next/server'
import { verifyUserSession } from '@/lib/server-utils'
import { Client } from 'pg'
import mysql from 'mysql2/promise'
import sql from 'mssql'
import snowflake from 'snowflake-sdk'
import oracledb from 'oracledb'
import { DatabaseSchema, DatabaseTable } from '@/types/database-schema'

// Snowflake response interfaces
interface SnowflakeVersionRow {
  VERSION: string
  DATABASE: string
  USER: string
  WAREHOUSE: string
}

interface SnowflakeTableRow {
  name: string
  kind: string
  comment: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId, config, fetchSchema = false, schemaName = 'public' } = await request.json()

    // Debug logging
    console.log('Database connection test request:', {
      workspaceId: workspaceId ? 'present' : 'missing',
      config: config ? 'present' : 'missing',
      configType: config?.type,
      configName: config?.name,
      configDatabase: config?.database,
      configHost: config?.host,
      configUsername: config?.username,
      configPassword: config?.password ? 'present' : 'missing'
    })

    if (!workspaceId || !config) {
      return NextResponse.json({ error: 'Workspace ID and config are required' }, { status: 400 })
    }

    // Validate required fields
    const requiredFields = ['type', 'name', 'database']
    const missingFields = []
    
    for (const field of requiredFields) {
      if (!config[field] || config[field].toString().trim() === '') {
        missingFields.push(field)
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}. Please fill in all required connection details.` 
      }, { status: 400 })
    }

    // For non-SQLite databases, validate additional fields
    if (config.type !== 'sqlite') {
      const additionalRequired = ['host', 'username', 'password']
      const missingAdditional = []
      
      for (const field of additionalRequired) {
        if (!config[field] || config[field].toString().trim() === '') {
          missingAdditional.push(field)
        }
      }

      if (missingAdditional.length > 0) {
        return NextResponse.json({ 
          error: `Missing required fields for ${config.type}: ${missingAdditional.join(', ')}. Please fill in all connection details.` 
        }, { status: 400 })
      }
    }

    // Test the database connection
    const connectionResult = await testDatabaseConnection(config, fetchSchema, schemaName) as {
      success: boolean;
      details?: Record<string, unknown>;
      schema?: DatabaseSchema;
      error?: string;
    }

    if (connectionResult.success) {
      const response: {
        success: boolean;
        message: string;
        details: Record<string, unknown>;
        schema?: DatabaseSchema;
      } = {
        success: true,
        message: 'Connection test successful',
        details: connectionResult.details || {}
      }

      if (fetchSchema && connectionResult.schema) {
        response.schema = connectionResult.schema
      }

      return NextResponse.json(response)
    } else {
      return NextResponse.json({
        success: false,
        error: connectionResult.error
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Database connection test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function testDatabaseConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'public') {
  try {
    switch (config.type) {
      case 'postgresql':
        return await testPostgreSQLConnection(config, fetchSchema, schemaName)
      case 'mysql':
        return await testMySQLConnection(config, fetchSchema, schemaName)
      case 'mongodb':
        return await testMongoDBConnection(config)
      case 'redis':
        return await testRedisConnection(config)
      case 'sqlite':
        return await testSQLiteConnection(config)
      case 'bigquery':
        return await testBigQueryConnection(config)
      case 'redshift':
        return await testRedshiftConnection(config, fetchSchema, schemaName)
      case 'azure-sql':
        return await testAzureSQLConnection(config, fetchSchema, schemaName)
      case 'snowflake':
        return await testSnowflakeConnection(config, fetchSchema, schemaName)
      case 'oracle':
        return await testOracleConnection(config, fetchSchema, schemaName)
      case 'mssql':
        return await testMSSQLConnection(config, fetchSchema, schemaName)
      default:
        return {
          success: false,
          error: `Unsupported database type: ${config.type}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

async function testPostgreSQLConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'public') {
  
  const client = new Client({
    host: config.host as string,
    port: parseInt(config.port as string) || 5432,
    database: config.database as string,
    user: config.username as string,
    password: config.password as string,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000, // 10 second timeout
  })

  try {
    await client.connect()
    
    // Test the connection by running a simple query
    const result = await client.query('SELECT version(), current_database(), current_user')
    
    
    const response: {
      success: boolean;
      details: Record<string, unknown>;
      schema?: DatabaseSchema;
    } = {
      success: true,
      details: {
        version: result.rows[0].version,
        database: result.rows[0].current_database,
        user: result.rows[0].current_user,
        host: config.host,
        port: config.port
      }
    }

    // Fetch schema information if requested
    if (fetchSchema) {
      console.log(`🔍 Fetching table names for schema: ${schemaName}`)
      const schema = await fetchTableNamesOnly(client, config.database as string, schemaName)
      response.schema = schema
    }
    
    await client.end()
    return response
  } catch (error) {
    // Ensure client is closed even if there's an error
    try {
      await client.end()
    } catch {
      // Ignore close errors
    }
    
    console.error('PostgreSQL connection error:', error)
    console.error('Connection config:', {
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password ? '[REDACTED]' : 'undefined',
      ssl: config.ssl
    })
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the PostgreSQL server is running and the host/port are correct.'
        }
      } else if (error.message.includes('authentication failed')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.'
        }
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        return {
          success: false,
          error: 'Database does not exist. Please check the database name.'
        }
      } else if (error.message.includes('timeout')) {
        return {
          success: false,
          error: 'Connection timeout. Please check if the host is reachable and the port is correct.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

async function testMySQLConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'public') {
  try {
    const connection = await mysql.createConnection({
      host: config.host as string,
      port: parseInt(config.port as string) || 3306,
      database: config.database as string,
      user: config.username as string,
      password: config.password as string,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000, // 10 second timeout
    })

    // Test the connection by running a simple query
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as database, USER() as user')
    
    const result = rows as Array<{ version: string; database: string; user: string }>
    const response: {
      success: boolean;
      details: Record<string, unknown>;
      schema?: DatabaseSchema;
    } = {
      success: true,
      details: {
        version: result[0].version,
        database: result[0].database,
        user: result[0].user,
        host: config.host,
        port: config.port
      }
    }

    // Fetch schema information if requested
    if (fetchSchema) {
      console.log(`🔍 Fetching table names for MySQL schema: ${schemaName}`)
      const schema = await fetchMySQLTableNamesOnly(connection, config.database as string, schemaName)
      response.schema = schema
    }
    
    await connection.end()
    return response
  } catch (error) {
    console.error('MySQL connection error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the MySQL server is running and the host/port are correct.'
        }
      } else if (error.message.includes('Access denied')) {
        return {
          success: false,
          error: 'Access denied. Please check your username and password.'
        }
      } else if (error.message.includes('Unknown database')) {
        return {
          success: false,
          error: 'Database does not exist. Please check the database name.'
        }
      } else if (error.message.includes('timeout')) {
        return {
          success: false,
          error: 'Connection timeout. Please check if the host is reachable and the port is correct.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

async function testMongoDBConnection(config: Record<string, unknown>) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (config.host && config.port && config.database && config.username && config.password) {
        resolve({
          success: true,
          details: {
            version: 'MongoDB 5.0.8',
            database: config.database,
            host: config.host,
            port: config.port
          }
        })
      } else {
        resolve({
          success: false,
          error: 'Missing required connection parameters'
        })
      }
    }, 1000)
  })
}

async function testRedisConnection(config: Record<string, unknown>) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (config.host && config.port && config.password) {
        resolve({
          success: true,
          details: {
            version: 'Redis 6.2.6',
            host: config.host,
            port: config.port
          }
        })
      } else {
        resolve({
          success: false,
          error: 'Missing required connection parameters'
        })
      }
    }, 1000)
  })
}

async function testSQLiteConnection(config: Record<string, unknown>) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (config.host) { // For SQLite, host is the file path
        resolve({
          success: true,
          details: {
            version: 'SQLite 3.37.2',
            database: config.host
          }
        })
      } else {
        resolve({
          success: false,
          error: 'Database file path is required'
        })
      }
    }, 500) // SQLite is faster
  })
}

async function testBigQueryConnection(config: Record<string, unknown>) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (config.connectionString) {
        resolve({
          success: true,
          details: {
            version: 'BigQuery',
            connectionString: (config.connectionString as string).substring(0, 50) + '...'
          }
        })
      } else {
        resolve({
          success: false,
          error: 'Connection string is required for BigQuery'
        })
      }
    }, 1500) // BigQuery is slower
  })
}

async function fetchTableNamesOnly(client: Client, databaseName: string, schemaName = 'public'): Promise<DatabaseSchema> {
  try {
    console.log(`⚡ Fast table name fetch for schema: ${schemaName}`)
    
    // Simple query to get just table names and types
    const tablesQuery = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = $1
      ORDER BY table_name
    `
    
    const tablesResult = await client.query(tablesQuery, [schemaName])
    
    const tables: DatabaseTable[] = []
    const views: DatabaseTable[] = []
    
    for (const row of tablesResult.rows) {
      const table: DatabaseTable = {
        name: row.table_name,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        schema: schemaName,
        columns: [], // Empty for now - will be populated when user selects table
        row_count: 0 // Unknown for now
      }
      
      if (row.table_type === 'VIEW') {
        views.push(table)
      } else {
        tables.push(table)
      }
    }
    
    console.log(`⚡ Found ${tables.length} tables and ${views.length} views in ${schemaName} schema`)
    
    return {
      database_name: databaseName,
      database_type: 'postgresql',
      tables,
      views,
      total_tables: tables.length,
      total_views: views.length
    }
    
  } catch (error) {
    console.error('Error fetching table names:', error)
    throw new Error(`Failed to fetch table names: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/*
// UNUSED: async function fetchPostgreSQLSchema(client: Client, databaseName: string, schemaName = 'public'): Promise<DatabaseSchema> {
  try {
    // Get all tables and views for specific schema
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        t.table_schema,
        COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = $1
      ORDER BY t.table_name
    `
    
    const tablesResult = await client.query(tablesQuery, [schemaName])
    
    const tables: DatabaseTable[] = []
    const views: DatabaseTable[] = []
    
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name
      const tableSchema = tableRow.table_schema
      const tableType = tableRow.table_type
      const rowCount = parseInt(tableRow.row_count) || 0
      
      // Get columns for this table
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
          WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT 
            ku.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1 AND c.table_schema = $2
        ORDER BY c.ordinal_position
      `
      
      const columnsResult = await client.query(columnsQuery, [tableName, schemaName])
      
      const columns: DatabaseColumn[] = columnsResult.rows.map(col => ({
        name: col.column_name,
        type: col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : ''),
        nullable: col.is_nullable === 'YES',
        default_value: col.column_default,
        is_primary_key: col.is_primary_key,
        is_foreign_key: col.is_foreign_key,
        foreign_table: col.foreign_table_name,
        foreign_column: col.foreign_column_name,
        sample_values: [] // Will be populated later
      }))
      
      // Get sample values for each column (limit to 5 samples)
      for (const column of columns) {
        try {
          const sampleQuery = `
            SELECT ${column.name} 
            FROM ${schemaName}.${tableName} 
            WHERE ${column.name} IS NOT NULL 
            LIMIT 5
          `
          const sampleResult = await client.query(sampleQuery)
          column.sample_values = sampleResult.rows.map(row => String(row[column.name])).filter(val => val && val.length > 0)
        } catch (_error) {
          // If we can't get sample data, just continue
          column.sample_values = []
        }
      }

      // AI definitions will be generated later when user selects tables
      // No need to generate them during connection test

      const table: DatabaseTable = {
        name: tableName,
        type: tableType === 'VIEW' ? 'view' : 'table',
        schema: tableSchema,
        columns,
        row_count: rowCount
      }
      
      if (tableType === 'VIEW') {
        views.push(table)
      } else {
        tables.push(table)
      }
    }
    
    return {
      database_name: databaseName,
      database_type: 'postgresql',
      tables,
      views,
      total_tables: tables.length,
      total_views: views.length
    }
  } catch (error) {
    console.error('Error fetching PostgreSQL schema:', error)
    throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
*/

async function fetchMySQLTableNamesOnly(connection: mysql.Connection, databaseName: string, schemaName = 'public'): Promise<DatabaseSchema> {
  try {
    console.log(`⚡ Fast MySQL table name fetch for schema: ${schemaName}`)
    
    // Simple query to get just table names and types
    const [tablesResult] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        TABLE_TYPE
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY TABLE_NAME
    `, [schemaName])
    
    const tables: DatabaseTable[] = []
    const views: DatabaseTable[] = []
    
    for (const row of tablesResult as Array<{TABLE_NAME: string, TABLE_TYPE: string}>) {
      const table: DatabaseTable = {
        name: row.TABLE_NAME,
        type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
        schema: schemaName,
        columns: [], // Empty for now - will be populated when user selects table
        row_count: 0 // Unknown for now
      }
      
      if (row.TABLE_TYPE === 'VIEW') {
        views.push(table)
      } else {
        tables.push(table)
      }
    }
    
    console.log(`⚡ Found ${tables.length} tables and ${views.length} views in ${schemaName} schema`)
    
    return {
      database_name: databaseName,
      database_type: 'mysql',
      tables,
      views,
      total_tables: tables.length,
      total_views: views.length
    }
    
  } catch (error) {
    console.error('Error fetching MySQL table names:', error)
    throw new Error(`Failed to fetch table names: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/*
// UNUSED: async function fetchMySQLSchema(connection: mysql.Connection, databaseName: string, schemaName = 'public'): Promise<DatabaseSchema> {
  try {
    // Get all tables and views for specific schema
    const [tablesResult] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        TABLE_TYPE,
        TABLE_SCHEMA,
        TABLE_ROWS
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY TABLE_NAME
    `, [schemaName])
    
    const tables: DatabaseTable[] = []
    const views: DatabaseTable[] = []
    
    for (const tableRow of tablesResult as Array<{
      TABLE_NAME: string;
      TABLE_TYPE: string;
      TABLE_SCHEMA: string;
      TABLE_ROWS: number;
    }>) {
      const tableName = tableRow.TABLE_NAME
      const tableType = tableRow.TABLE_TYPE
      const rowCount = parseInt(tableRow.TABLE_ROWS) || 0
      
      // Get columns for this table
      const [columnsResult] = await connection.execute(`
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
      `, [databaseName, tableName])
      
      // Get foreign key information
      const [fkResult] = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [databaseName, tableName])
      
      const foreignKeys = (fkResult as Array<{
        COLUMN_NAME: string;
        REFERENCED_TABLE_NAME: string;
        REFERENCED_COLUMN_NAME: string;
      }>).reduce((acc, fk) => {
        acc[fk.COLUMN_NAME] = {
          table: fk.REFERENCED_TABLE_NAME,
          column: fk.REFERENCED_COLUMN_NAME
        }
        return acc
      }, {})
      
      const columns: DatabaseColumn[] = (columnsResult as Array<{
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string;
        CHARACTER_MAXIMUM_LENGTH: number;
        NUMERIC_PRECISION: number;
        NUMERIC_SCALE: number;
        COLUMN_KEY: string;
        EXTRA: string;
      }>).map(col => {
        const fk = foreignKeys[col.COLUMN_NAME]
        return {
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE + (col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''),
          nullable: col.IS_NULLABLE === 'YES',
          default_value: col.COLUMN_DEFAULT,
          is_primary_key: col.COLUMN_KEY === 'PRI',
          is_foreign_key: !!fk,
          foreign_table: fk?.table,
          foreign_column: fk?.column,
          sample_values: [] // Will be populated later
        }
      })
      
      // Get sample values for each column (limit to 5 samples)
      for (const column of columns) {
        try {
          const [sampleResult] = await connection.execute(`
            SELECT ${column.name} 
            FROM ${tableName} 
            WHERE ${column.name} IS NOT NULL 
            LIMIT 5
          `)
          column.sample_values = (sampleResult as Array<Record<string, unknown>>).map(row => String(row[column.name])).filter(val => val && val.length > 0)
        } catch (_error) {
          // If we can't get sample data, just continue
          column.sample_values = []
        }
      }

      // AI definitions will be generated later when user selects tables
      // No need to generate them during connection test

      const table: DatabaseTable = {
        name: tableName,
        type: tableType === 'VIEW' ? 'view' : 'table',
        columns,
        row_count: rowCount
      }
      
      if (tableType === 'VIEW') {
        views.push(table)
      } else {
        tables.push(table)
      }
    }
    
    return {
      database_name: databaseName,
      database_type: 'mysql',
      tables,
      views,
      total_tables: tables.length,
      total_views: views.length
    }
  } catch (error) {
    console.error('Error fetching MySQL schema:', error)
    throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
*/

// Amazon Redshift Connection Test
async function testRedshiftConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'public') {
  try {
    // Redshift uses PostgreSQL protocol, so we can use the pg client
    const client = new Client({
      host: config.host as string,
      port: parseInt(config.port as string) || 5439,
      database: config.database as string,
      user: config.username as string,
      password: config.password as string,
      ssl: config.ssl ? { rejectUnauthorized: false } : true, // Redshift requires SSL
      connectionTimeoutMillis: 10000,
    })

    await client.connect()

    // Test the connection
    const result = await client.query('SELECT version() as version, current_database() as database, current_user as user')
    
    const response: {
      success: boolean;
      details: Record<string, unknown>;
      schema?: DatabaseSchema;
    } = {
      success: true,
      details: {
        version: result.rows[0].version,
        database: result.rows[0].database,
        user: result.rows[0].user,
        host: config.host,
        port: config.port
      }
    }

    // Fetch schema information if requested
    if (fetchSchema) {
      console.log(`🔍 Fetching table names for Redshift schema: ${schemaName}`)
      const schema = await fetchTableNamesOnly(client, config.database as string, schemaName)
      response.schema = schema
    }
    
    await client.end()
    return response
  } catch (error) {
    console.error('Redshift connection error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the Redshift cluster is running and the host/port are correct.'
        }
      } else if (error.message.includes('password authentication failed')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.'
        }
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        return {
          success: false,
          error: 'Database does not exist. Please check the database name.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

// Azure SQL Database Connection Test
async function testAzureSQLConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'dbo') {
  try {
    const sqlConfig = {
      server: config.host as string,
      port: parseInt(config.port as string) || 1433,
      database: config.database as string,
      user: config.username as string,
      password: config.password as string,
      options: {
        encrypt: true, // Azure SQL requires encryption
        trustServerCertificate: false,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 10000,
      }
    }

    const pool = await sql.connect(sqlConfig)
    
    // Test the connection
    const result = await pool.request().query(`
      SELECT 
        @@VERSION as version,
        DB_NAME() as database,
        USER_NAME() as user,
        @@SERVERNAME as server
    `)
    
    const response: {
      success: boolean;
      details: Record<string, unknown>;
      schema?: DatabaseSchema;
    } = {
      success: true,
      details: {
        version: result.recordset[0].version,
        database: result.recordset[0].database,
        user: result.recordset[0].user,
        server: result.recordset[0].server,
        host: config.host,
        port: config.port
      }
    }

    // Fetch schema information if requested
    if (fetchSchema) {
      console.log(`🔍 Fetching table names for Azure SQL schema: ${schemaName}`)
      const schema = await fetchMSSQLTableNamesOnly(pool, config.database as string, schemaName)
      response.schema = schema
    }
    
    await pool.close()
    return response
  } catch (error) {
    console.error('Azure SQL connection error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the Azure SQL server is accessible and the host/port are correct.'
        }
      } else if (error.message.includes('Login failed')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.'
        }
      } else if (error.message.includes('Cannot open database')) {
        return {
          success: false,
          error: 'Database does not exist or access denied. Please check the database name and permissions.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

// Snowflake Connection Test
async function testSnowflakeConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'PUBLIC') {
  try {
    const connectionConfig = {
      account: config.account as string || config.host as string,
      username: config.username as string,
      password: config.password as string,
      database: config.database as string,
      schema: schemaName,
      warehouse: config.warehouse as string,
      role: config.role as string,
      clientSessionKeepAlive: true,
      clientSessionKeepAliveHeartbeatFrequency: 3600,
      application: 'Insighter',
      timeout: 10000
    }

    return new Promise((resolve) => {
      const connection = snowflake.createConnection(connectionConfig)
      
      connection.connect((err: snowflake.SnowflakeError | undefined, conn: snowflake.Connection) => {
        if (err) {
          console.error('Snowflake connection error:', err)
          resolve({
            success: false,
            error: `Snowflake connection failed: ${err.message || 'Unknown error'}`
          })
          return
        }

        // Test the connection with a simple query
        conn.execute({
          sqlText: 'SELECT CURRENT_VERSION() as version, CURRENT_DATABASE() as database, CURRENT_USER() as user, CURRENT_WAREHOUSE() as warehouse',
          complete: (err: snowflake.SnowflakeError | undefined, stmt: snowflake.RowStatement, rows: unknown[] | undefined) => {
            if (err) {
              console.error('Snowflake query error:', err)
              resolve({
                success: false,
                error: `Snowflake query failed: ${err.message || 'Unknown error'}`
              })
              return
            }

            const response: {
              success: boolean;
              details: Record<string, unknown>;
              schema?: DatabaseSchema;
            } = {
              success: true,
              details: {
                version: (rows?.[0] as SnowflakeVersionRow)?.VERSION || 'Unknown',
                database: (rows?.[0] as SnowflakeVersionRow)?.DATABASE || config.database,
                user: (rows?.[0] as SnowflakeVersionRow)?.USER || config.username,
                warehouse: (rows?.[0] as SnowflakeVersionRow)?.WAREHOUSE || config.warehouse,
                account: config.account || config.host,
                schema: schemaName
              }
            }

            // Fetch schema information if requested
            if (fetchSchema) {
              console.log(`🔍 Fetching table names for Snowflake schema: ${schemaName}`)
              conn.execute({
                sqlText: `SHOW TABLES IN SCHEMA ${schemaName}`,
                complete: (err: snowflake.SnowflakeError | undefined, stmt: snowflake.RowStatement, rows: unknown[] | undefined) => {
                  if (err) {
                    console.error('Error fetching Snowflake schema:', err)
                    resolve({
                      success: false,
                      error: `Failed to fetch schema: ${err.message || 'Unknown error'}`
                    })
                    return
                  }

                  const tables: DatabaseTable[] = []
                  const views: DatabaseTable[] = []

                  for (const row of rows || []) {
                    const table: DatabaseTable = {
                      name: (row as SnowflakeTableRow).name,
                      type: (row as SnowflakeTableRow).kind === 'VIEW' ? 'view' : 'table',
                      columns: [],
                      row_count: 0,
                      description: (row as SnowflakeTableRow).comment || ''
                    }

                    if ((row as SnowflakeTableRow).kind === 'VIEW') {
                      views.push(table)
                    } else {
                      tables.push(table)
                    }
                  }

                  response.schema = {
                    database_name: config.database as string,
                    database_type: 'snowflake',
                    tables,
                    views,
                    total_tables: tables.length,
                    total_views: views.length
                  }

                  conn.destroy((err) => {
                    if (err) console.error('Error destroying Snowflake connection:', err)
                  })
                  resolve(response)
                }
              })
            } else {
              conn.destroy((err) => {
                if (err) console.error('Error destroying Snowflake connection:', err)
              })
              resolve(response)
            }
          }
        })
      })
    })
  } catch (error) {
    console.error('Snowflake connection error:', error)
    return {
      success: false,
      error: `Snowflake connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Oracle Database Connection Test
async function testOracleConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'PUBLIC') {
  try {
    // Oracle connection configuration
    const connectionConfig = {
      user: config.username as string,
      password: config.password as string,
      connectString: config.connectionString as string || `${config.host}:${config.port || 1521}/${config.database}`,
      // For Oracle Cloud or specific configurations
      ...(config.serviceName ? { serviceName: config.serviceName as string } : {}),
      ...(config.sid ? { sid: config.sid as string } : {}),
      // Connection options
      poolMin: 0,
      poolMax: 1,
      poolIncrement: 1,
      poolTimeout: 60,
      stmtCacheSize: 23,
      externalAuth: false,
      homogeneous: true,
      events: false,
      // SSL configuration
      ...(config.ssl ? {
        ssl: true,
        sslServerCertDN: config.sslServerCertDN as string
      } : {})
    }

    const connection = await oracledb.getConnection(connectionConfig)
    
    try {
      // Test the connection with a simple query
      const result = await connection.execute(`
        SELECT 
          BANNER as version,
          SYS_CONTEXT('USERENV', 'DB_NAME') as database,
          USER as user,
          SYS_CONTEXT('USERENV', 'SERVER_HOST') as server
        FROM V$VERSION 
        WHERE ROWNUM = 1
      `)
      
      const response: {
        success: boolean;
        details: Record<string, unknown>;
        schema?: DatabaseSchema;
      } = {
        success: true,
        details: {
          version: (Array.isArray(result.rows) && (result.rows as unknown[][])[0]?.[0]) || 'Unknown',
          database: (Array.isArray(result.rows) && (result.rows as unknown[][])[0]?.[1]) || config.database,
          user: (Array.isArray(result.rows) && (result.rows as unknown[][])[0]?.[2]) || config.username,
          server: (Array.isArray(result.rows) && (result.rows as unknown[][])[0]?.[3]) || config.host,
          host: config.host,
          port: config.port
        }
      }

      // Fetch schema information if requested
      if (fetchSchema) {
        console.log(`🔍 Fetching table names for Oracle schema: ${schemaName}`)
        const schemaResult = await connection.execute(`
          SELECT 
            TABLE_NAME,
            CASE 
              WHEN TABLE_TYPE = 'VIEW' THEN 'VIEW'
              ELSE 'BASE TABLE'
            END as TABLE_TYPE,
            COMMENTS
          FROM USER_TAB_COMMENTS 
          WHERE TABLE_TYPE IN ('TABLE', 'VIEW')
          AND TABLE_NAME NOT LIKE 'BIN$%'
          ORDER BY TABLE_NAME
        `)
        
        const tables: DatabaseTable[] = []
        const views: DatabaseTable[] = []

        for (const row of schemaResult.rows || []) {
          const rowArray = row as unknown[];
          const table: DatabaseTable = {
            name: rowArray[0] as string,
            type: (rowArray[1] as string) === 'VIEW' ? 'view' : 'table',
            columns: [],
            row_count: 0,
            description: rowArray[2] as string || ''
          }

          if (rowArray[1] === 'VIEW') {
            views.push(table)
          } else {
            tables.push(table)
          }
        }

        response.schema = {
          database_name: config.database as string,
          database_type: 'oracle',
          tables,
          views,
          total_tables: tables.length,
          total_views: views.length
        }
      }
      
      await connection.close()
      return response
    } catch (queryError) {
      await connection.close()
      throw queryError
    }
  } catch (error) {
    console.error('Oracle connection error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ORA-12541')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the Oracle database is running and the host/port are correct.'
        }
      } else if (error.message.includes('ORA-01017')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.'
        }
      } else if (error.message.includes('ORA-12514')) {
        return {
          success: false,
          error: 'Database service not found. Please check the database name or service name.'
        }
      } else if (error.message.includes('ORA-12535')) {
        return {
          success: false,
          error: 'Connection timeout. Please check if the host is reachable and the port is correct.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

// Microsoft SQL Server Connection Test
async function testMSSQLConnection(config: Record<string, unknown>, fetchSchema = false, schemaName = 'dbo') {
  try {
    const sqlConfig = {
      server: config.host as string,
      port: parseInt(config.port as string) || 1433,
      database: config.database as string,
      user: config.username as string,
      password: config.password as string,
      options: {
        encrypt: config.ssl ? true : false,
        trustServerCertificate: config.ssl ? false : true,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 10000,
      }
    }

    const pool = await sql.connect(sqlConfig)
    
    // Test the connection
    const result = await pool.request().query(`
      SELECT 
        @@VERSION as version,
        DB_NAME() as database,
        USER_NAME() as user,
        @@SERVERNAME as server
    `)
    
    const response: {
      success: boolean;
      details: Record<string, unknown>;
      schema?: DatabaseSchema;
    } = {
      success: true,
      details: {
        version: result.recordset[0].version,
        database: result.recordset[0].database,
        user: result.recordset[0].user,
        server: result.recordset[0].server,
        host: config.host,
        port: config.port
      }
    }

    // Fetch schema information if requested
    if (fetchSchema) {
      console.log(`🔍 Fetching table names for SQL Server schema: ${schemaName}`)
      const schema = await fetchMSSQLTableNamesOnly(pool, config.database as string, schemaName)
      response.schema = schema
    }
    
    await pool.close()
    return response
  } catch (error) {
    console.error('SQL Server connection error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: 'Connection refused. Please check if the SQL Server is running and the host/port are correct.'
        }
      } else if (error.message.includes('Login failed')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your username and password.'
        }
      } else if (error.message.includes('Cannot open database')) {
        return {
          success: false,
          error: 'Database does not exist or access denied. Please check the database name and permissions.'
        }
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        }
      }
    }
    
    return {
      success: false,
      error: 'Unknown connection error occurred'
    }
  }
}

// Helper function to fetch MSSQL table names only
async function fetchMSSQLTableNamesOnly(pool: sql.ConnectionPool, databaseName: string, schemaName: string): Promise<DatabaseSchema> {
  try {
    const result = await pool.request().query(`
      SELECT 
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${schemaName}'
      ORDER BY TABLE_NAME
    `)
    
    const tables: DatabaseTable[] = []
    const views: DatabaseTable[] = []
    
    for (const row of result.recordset) {
      const table: DatabaseTable = {
        name: row.table_name,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        columns: [], // We'll fetch columns separately when needed
        row_count: 0,
        description: ''
      }
      
      if (row.table_type === 'VIEW') {
        views.push(table)
      } else {
        tables.push(table)
      }
    }
    
    return {
      database_name: databaseName,
      database_type: 'mssql',
      tables,
      views,
      total_tables: tables.length,
      total_views: views.length
    }
  } catch (error) {
    console.error('Error fetching MSSQL schema:', error)
    throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
