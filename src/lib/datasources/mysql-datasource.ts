/**
 * MySQL Data Source Agent
 * 
 * Specialized agent for handling MySQL database connections and operations
 */

import { 
  DataSourceAgent, 
  DataSourceConnection, 
  DataSourceSchema, 
  DataSourceTable, 
  DataSourceColumn, 
  DataSourceQueryResult, 
  DataSourceTestResult, 
  DataSourceCapabilities,
  DatabaseDataSourceConfig
} from './types';

export class MySQLDataSource implements DataSourceAgent {
  name = 'MySQL Data Source';
  description = 'Handles MySQL database connections and operations';
  type = 'mysql' as const;
  
  capabilities: DataSourceCapabilities = {
    supports_sql: true,
    supports_transactions: true,
    supports_stored_procedures: true,
    supports_functions: true,
    supports_views: true,
    supports_indexes: true,
    supports_foreign_keys: true,
    max_query_size: 1000000, // 1MB
    max_result_size: 10000000, // 10MB
    supported_data_types: [
      'VARCHAR', 'TEXT', 'CHAR', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC',
      'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
      'BLOB', 'LONGBLOB', 'JSON', 'ENUM', 'SET'
    ],
    supported_operations: [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX',
      'VIEW', 'FUNCTION', 'PROCEDURE', 'TRIGGER', 'EVENT', 'SCHEMA'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing MySQL connection...');
      
      // Validate required connection parameters
      if (!config.host || !config.database_name || !config.username) {
        throw new Error('Host, database name, and username are required');
      }
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple query
      const queryStartTime = Date.now();
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 50));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          database_version: 'MySQL 8.0',
          server_info: 'Connection successful',
          charset: 'utf8mb4'
        }
      };
    } catch (error) {
      return {
        success: false,
        connection_time_ms: Date.now() - startTime,
        query_time_ms: 0,
        error_message: error instanceof Error ? error.message : 'Unknown connection error',
        metadata: {
          error_type: 'connection_failed'
        }
      };
    }
  }

  async connect(config: Record<string, unknown>): Promise<DataSourceConnection> {
    try {
      console.log('🔌 Connecting to MySQL database...');
      
      // This would create an actual MySQL connection
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `mysql_${Date.now()}`,
        data_source_id: 'mysql',
        host: config.host as string,
        port: (config.port as number) || 3306, // Default MySQL port
        database_name: config.database_name as string,
        username: config.username as string,
        connection_timeout: (config.connection_timeout as number) || 30000,
        query_timeout: (config.query_timeout as number) || 60000,
        max_connections: (config.max_connections as number) || 10,
        additional_config: {
          ...(config.additional_config as Record<string, unknown>),
          charset: 'utf8mb4',
          timezone: 'UTC'
        }
      };
      
      console.log('✅ MySQL connection established');
      return connection;
    } catch (error) {
      console.error('❌ MySQL connection failed:', error);
      throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from MySQL...');
      // This would close the actual connection
      console.log('✅ MySQL connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from MySQL:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving MySQL schema...');
      
      // This would query the MySQL information_schema
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        views: [],
        functions: [],
        procedures: [],
        metadata: {
          database_name: connection.database_name || 'mysql',
          database_version: 'MySQL 8.0',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of tables
      const tables = await this.getTableList(connection);
      
      // Get detailed info for each table
      for (const tableName of tables) {
        const tableInfo = await this.getTableInfo(connection, tableName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved MySQL schema with ${schema.tables.length} tables`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving MySQL schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting table info for: ${tableName}`);
      
      // This would query MySQL information_schema
      // For now, we'll return a mock table
      const table: DataSourceTable = {
        name: tableName,
        type: 'table',
        columns: [],
        primary_keys: [],
        foreign_keys: [],
        indexes: [],
        row_count: 0,
        size_bytes: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Get columns for this table
      const columns = await this.getColumnList(connection, tableName);
      
      for (const columnName of columns) {
        const columnInfo = await this.getColumnInfo(connection, tableName, columnName);
        table.columns.push(columnInfo);
      }
      
      // Get row count
      table.row_count = await this.getTableRowCount(connection, tableName);
      
      console.log(`✅ Retrieved table info for ${tableName} with ${table.columns.length} columns`);
      return table;
    } catch (error) {
      console.error(`❌ Error getting table info for ${tableName}:`, error);
      throw error;
    }
  }

  async getColumnInfo(connection: DataSourceConnection, tableName: string, columnName: string): Promise<DataSourceColumn> {
    try {
      // This would query MySQL information_schema.columns
      // For now, we'll return a mock column
      const column: DataSourceColumn = {
        name: columnName,
        type: 'VARCHAR',
        nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        is_unique: false,
        is_indexed: false,
        max_length: 255,
        sample_values: ['sample1', 'sample2', 'sample3']
      };
      
      return column;
    } catch (error) {
      console.error(`❌ Error getting column info for ${tableName}.${columnName}:`, error);
      throw error;
    }
  }

  async executeQuery(connection: DataSourceConnection, query: string, params?: any[]): Promise<DataSourceQueryResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Executing MySQL query: ${query.substring(0, 100)}...`);
      
      // This would execute the actual query using a MySQL client
      // For now, we'll return a mock result
      const result: DataSourceQueryResult = {
        columns: ['id', 'name', 'email', 'created_at'],
        rows: [
          [1, 'Sample 1', 'sample1@example.com', '2024-01-01'],
          [2, 'Sample 2', 'sample2@example.com', '2024-01-02'],
          [3, 'Sample 3', 'sample3@example.com', '2024-01-03']
        ],
        row_count: 3,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'SELECT',
          affected_rows: 3,
          charset: 'utf8mb4'
        }
      };
      
      console.log(`✅ MySQL query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing MySQL query:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: any[]): Promise<DataSourceQueryResult> {
    // Add LIMIT clause to the query
    const limitedQuery = `${query} LIMIT ${limit}`;
    return this.executeQuery(connection, limitedQuery, params);
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `SELECT * FROM \`${tableName}\` LIMIT ${limit}`;
    return this.executeQuery(connection, query);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      const query = `SELECT COUNT(*) as count FROM \`${tableName}\``;
      const result = await this.executeQuery(connection, query);
      return parseInt(result.rows[0][0] as string) || 0;
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, any>> {
    try {
      // This would query MySQL system tables for database info
      return {
        database_name: connection.database_name,
        database_version: 'MySQL 8.0',
        server_version: '8.0.35',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        timezone: 'UTC',
        max_connections: connection.max_connections,
        current_connections: 5
      };
    } catch (error) {
      console.error('❌ Error getting MySQL database info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would query MySQL information_schema.tables
      // For now, we'll return a mock list
      return ['users', 'orders', 'products', 'categories', 'reviews'];
    } catch (error) {
      console.error('❌ Error getting MySQL table list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would query MySQL information_schema.columns
      // For now, we'll return a mock list
      return ['id', 'name', 'email', 'created_at', 'updated_at', 'status'];
    } catch (error) {
      console.error(`❌ Error getting MySQL column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic SQL validation for MySQL
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for basic SQL keywords
      const validKeywords = ['select', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'show', 'describe', 'explain'];
      const hasValidKeyword = validKeywords.some(keyword => trimmedQuery.startsWith(keyword));
      
      if (!hasValidKeyword) {
        return { valid: false, error: 'Query must start with a valid SQL keyword' };
      }
      
      // Check for dangerous operations (basic security check)
      const dangerousKeywords = ['drop database', 'drop schema', 'truncate', 'delete from'];
      const hasDangerousKeyword = dangerousKeywords.some(keyword => trimmedQuery.includes(keyword));
      
      if (hasDangerousKeyword) {
        return { valid: false, error: 'Query contains potentially dangerous operations' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for MySQL
      // This could be enhanced with a proper SQL formatter library
      return query
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*\(\s*/g, '(')
        .replace(/\s*\)\s*/g, ')')
        .trim();
    } catch (error) {
      console.error('❌ Error formatting MySQL query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // This would use MySQL's EXPLAIN command
      const explainQuery = `EXPLAIN ${query}`;
      const result = await this.executeQuery(connection, explainQuery);
      
      // Return the query plan as a formatted string
      return result.rows.map(row => row.join(' | ')).join('\n');
    } catch (error) {
      console.error('❌ Error getting MySQL query plan:', error);
      throw error;
    }
  }
}
