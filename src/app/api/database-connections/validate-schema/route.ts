import { NextRequest, NextResponse } from 'next/server'
import { verifyUserSession } from '@/lib/server-utils'
import { Client } from 'pg'
import mysql from 'mysql2/promise'

/**
 * API endpoint to validate if a schema exists in the database
 * This is called after successful connection test but before fetching tables
 * 
 * Workflow Step 5: Validate if schema exists or not
 * - If fails, show error to user and allow to re-enter or cancel
 * - If success, allow them to fetch tables
 */
export async function POST(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { config, schemaName = 'public' } = await request.json()


    if (!config) {
      return NextResponse.json({ error: 'Config is required' }, { status: 400 })
    }

    // Validate required fields
    const requiredFields = ['type', 'name', 'database']
    for (const field of requiredFields) {
      if (!config[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    // For non-SQLite databases, validate additional fields
    if (config.type !== 'sqlite') {
      const additionalRequired = ['host', 'username', 'password']
      for (const field of additionalRequired) {
        if (!config[field]) {
          return NextResponse.json({ error: `${field} is required for ${config.type}` }, { status: 400 })
        }
      }
    }

    // Validate schema existence
    const validationResult = await validateSchemaExists(config, schemaName)

    if (validationResult.success) {
      return NextResponse.json({
        success: true,
        message: `Schema '${schemaName}' exists and is accessible`,
        schemaName,
        details: validationResult.details
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'error' in validationResult ? validationResult.error : 'Schema validation failed',
        schemaName
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Schema validation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error during schema validation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Validates if a schema exists in the database
 * @param config Database connection configuration
 * @param schemaName Name of the schema to validate
 * @returns Validation result with success status and details
 */
async function validateSchemaExists(config: Record<string, unknown>, schemaName: string) {
  try {
    switch (config.type) {
      case 'postgresql':
        return await validatePostgreSQLSchema(config, schemaName)
      case 'mysql':
        return await validateMySQLSchema(config, schemaName)
      case 'mongodb':
        // MongoDB doesn't have schemas in the traditional sense
        return { success: true, details: { message: 'MongoDB collections are schema-less' } }
      case 'redis':
        // Redis doesn't have schemas
        return { success: true, details: { message: 'Redis is schema-less' } }
      case 'sqlite':
        // SQLite doesn't have schemas
        return { success: true, details: { message: 'SQLite is schema-less' } }
      case 'bigquery':
        // BigQuery uses datasets instead of schemas
        return { success: true, details: { message: 'BigQuery uses datasets instead of schemas' } }
      case 'redshift':
        // Redshift uses PostgreSQL-compatible schemas but with different SSL requirements
        return await validateRedshiftSchema(config, schemaName)
      case 'azure-sql':
        // Azure SQL uses SQL Server schemas
        return { success: true, details: { message: 'Azure SQL schema validation - using default schema' } }
      case 'snowflake':
        // Snowflake uses schemas
        return { success: true, details: { message: 'Snowflake schema validation - using default schema' } }
      case 'oracle':
        // Oracle uses schemas
        return { success: true, details: { message: 'Oracle schema validation - using default schema' } }
      case 'mssql':
        // SQL Server uses schemas
        return { success: true, details: { message: 'SQL Server schema validation - using default schema' } }
      default:
        return {
          success: false,
          error: `Schema validation not supported for database type: ${config.type}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Validates PostgreSQL schema existence
 */
async function validatePostgreSQLSchema(config: Record<string, unknown>, schemaName: string) {
  const client = new Client({
    host: config.host as string,
    port: parseInt(config.port as string) || 5432,
    database: config.database as string,
    user: config.username as string,
    password: config.password as string,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    
    // Check if schema exists and user has access to it
    const schemaQuery = `
      SELECT schema_name, schema_owner
      FROM information_schema.schemata 
      WHERE schema_name = $1
    `
    
    const result = await client.query(schemaQuery, [schemaName])
    
    if (result.rows.length === 0) {
      return {
        success: false,
        error: `Schema '${schemaName}' does not exist in the database`
      }
    }

    await client.end()
    
    return {
      success: true,
      details: {
        schema_name: schemaName,
        schema_owner: result.rows[0].schema_owner,
        message: `Schema '${schemaName}' exists and is accessible`
      }
    }
    
  } catch (error) {
    await client.end()
    throw error
  }
}

/**
 * Validates Redshift schema existence
 */
async function validateRedshiftSchema(config: Record<string, unknown>, schemaName: string) {
  const client = new Client({
    host: config.host as string,
    port: parseInt(config.port as string) || 5439, // Redshift default port
    database: config.database as string,
    user: config.username as string,
    password: config.password as string,
    ssl: config.ssl ? { rejectUnauthorized: false } : true, // Redshift requires SSL
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    
    // For Redshift, try multiple approaches to validate schema existence
    let schemaExists = false;
    let schemaOwner = null;
    let errorMessage = '';

    try {
      // Approach 1: Standard information_schema query
      const schemaQuery = `
        SELECT schema_name, schema_owner
        FROM information_schema.schemata 
        WHERE schema_name = $1
      `
      
      const result = await client.query(schemaQuery, [schemaName])
      
      if (result.rows.length > 0) {
        schemaExists = true;
        schemaOwner = result.rows[0].schema_owner;
      }
    } catch (err) {
      console.log('Standard schema query failed, trying alternative approach:', err);
    }

    // Approach 2: If standard query fails, try to list tables in the schema
    if (!schemaExists) {
      try {
        const tablesQuery = `
          SELECT table_name
          FROM information_schema.tables 
          WHERE table_schema = $1
          LIMIT 1
        `
        
        const tablesResult = await client.query(tablesQuery, [schemaName])
        
        if (tablesResult.rows.length > 0) {
          schemaExists = true;
          schemaOwner = 'unknown'; // We can't get owner info this way
        }
      } catch (err) {
        console.log('Tables query failed:', err);
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // Approach 3: Try Redshift-specific query
    if (!schemaExists) {
      try {
        const redshiftQuery = `
          SELECT nspname as schema_name, u.usename as schema_owner
          FROM pg_namespace n
          LEFT JOIN pg_user u ON n.nspowner = u.usesysid
          WHERE n.nspname = $1
        `
        
        const redshiftResult = await client.query(redshiftQuery, [schemaName])
        
        if (redshiftResult.rows.length > 0) {
          schemaExists = true;
          schemaOwner = redshiftResult.rows[0].schema_owner;
        }
      } catch (err) {
        console.log('Redshift-specific query failed:', err);
        if (!errorMessage) {
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        }
      }
    }

    await client.end()
    
    if (schemaExists) {
      return {
        success: true,
        details: {
          schema_name: schemaName,
          schema_owner: schemaOwner,
          message: `Schema '${schemaName}' exists and is accessible`
        }
      }
    } else {
      return {
        success: false,
        error: `Schema '${schemaName}' does not exist in the database. ${errorMessage ? `Error: ${errorMessage}` : ''}`
      }
    }
    
  } catch (error) {
    await client.end()
    throw error
  }
}

/**
 * Validates MySQL schema existence
 */
async function validateMySQLSchema(config: Record<string, unknown>, schemaName: string) {
  const connection = await mysql.createConnection({
    host: config.host as string,
    port: parseInt(config.port as string) || 3306,
    database: config.database as string,
    user: config.username as string,
    password: config.password as string,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  })

  try {
    // Check if schema exists and user has access to it
    const [schemaResult] = await connection.execute(`
      SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME
      FROM information_schema.SCHEMATA 
      WHERE SCHEMA_NAME = ?
    `, [schemaName])
    
    const schemaRows = schemaResult as Array<{ SCHEMA_NAME: string; DEFAULT_CHARACTER_SET_NAME: string }>
    
    if (schemaRows.length === 0) {
      return {
        success: false,
        error: `Schema '${schemaName}' does not exist in the database`
      }
    }

    await connection.end()
    
    return {
      success: true,
      details: {
        schema_name: schemaName,
        character_set: schemaRows[0].DEFAULT_CHARACTER_SET_NAME,
        message: `Schema '${schemaName}' exists and is accessible`
      }
    }
    
  } catch (error) {
    await connection.end()
    throw error
  }
}
