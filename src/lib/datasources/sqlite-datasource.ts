/**
 * SQLite Data Source Agent
 * 
 * Specialized agent for handling SQLite database connections and operations
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
  FileDataSourceConfig
} from './types';

export class SQLiteDataSource implements DataSourceAgent {
  name = 'SQLite Data Source';
  description = 'Handles SQLite database connections and operations';
  type = 'sqlite' as const;
  
  capabilities: DataSourceCapabilities = {
    supports_sql: true,
    supports_transactions: true,
    supports_stored_procedures: false, // SQLite doesn't have stored procedures
    supports_functions: true,
    supports_views: true,
    supports_indexes: true,
    supports_foreign_keys: true,
    max_query_size: 1000000, // 1MB
    max_result_size: 10000000, // 10MB
    supported_data_types: [
      'TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC', 'VARCHAR', 'CHAR', 'INT', 'BIGINT',
      'SMALLINT', 'TINYINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'DATETIME'
    ],
    supported_operations: [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX',
      'VIEW', 'TRIGGER', 'ATTACH', 'DETACH', 'VACUUM', 'ANALYZE'
    ]
  };

  async testConnection(config: FileDataSourceConfig): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing SQLite connection...');
      
      // Validate file path
      if (!config.file_path || !config.file_name) {
        throw new Error('File path and name are required');
      }
      
      // Check file extension
      if (!config.file_name.toLowerCase().endsWith('.db') && 
          !config.file_name.toLowerCase().endsWith('.sqlite') &&
          !config.file_name.toLowerCase().endsWith('.sqlite3')) {
        throw new Error('File must be a SQLite database file (.db, .sqlite, or .sqlite3)');
      }
      
      // Simulate file validation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple query
      const queryStartTime = Date.now();
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 25));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          database_version: 'SQLite 3.45',
          file_size: config.file_size,
          is_readonly: false
        }
      };
    } catch (error) {
      return {
        success: false,
        connection_time_ms: Date.now() - startTime,
        query_time_ms: 0,
        error_message: error instanceof Error ? error.message : 'Unknown connection error',
        metadata: {
          error_type: 'file_access_failed'
        }
      };
    }
  }

  async connect(config: FileDataSourceConfig): Promise<DataSourceConnection> {
    try {
      console.log('🔌 Connecting to SQLite database...');
      
      // This would create a connection to the SQLite file
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `sqlite_${Date.now()}`,
        data_source_id: 'sqlite',
        connection_string: config.file_path,
        additional_config: {
          file_name: config.file_name,
          file_type: config.file_type,
          file_size: config.file_size,
          encoding: config.encoding || 'utf-8',
          is_readonly: false
        }
      };
      
      console.log('✅ SQLite connection established');
      return connection;
    } catch (error) {
      console.error('❌ SQLite connection failed:', error);
      throw new Error(`Failed to connect to SQLite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from SQLite...');
      // This would close the file handle
      console.log('✅ SQLite connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from SQLite:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving SQLite schema...');
      
      // This would query the SQLite sqlite_master table
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        views: [],
        functions: [],
        procedures: [],
        metadata: {
          database_name: connection.additional_config?.file_name || 'sqlite_db',
          database_version: 'SQLite 3.45',
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
      
      console.log(`✅ Retrieved SQLite schema with ${schema.tables.length} tables`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving SQLite schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting table info for: ${tableName}`);
      
      // This would query SQLite pragma table_info
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
      // This would query SQLite pragma table_info
      // For now, we'll return a mock column
      const column: DataSourceColumn = {
        name: columnName,
        type: 'TEXT',
        nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        is_unique: false,
        is_indexed: false,
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
      console.log(`🔍 Executing SQLite query: ${query.substring(0, 100)}...`);
      
      // This would execute the actual query using a SQLite client
      // For now, we'll return a mock result
      const result: DataSourceQueryResult = {
        columns: ['id', 'name', 'value', 'created_at'],
        rows: [
          [1, 'Sample 1', 100, '2024-01-01'],
          [2, 'Sample 2', 200, '2024-01-02'],
          [3, 'Sample 3', 300, '2024-01-03']
        ],
        row_count: 3,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'SELECT',
          affected_rows: 3,
          database_file: connection.additional_config?.file_name
        }
      };
      
      console.log(`✅ SQLite query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing SQLite query:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: any[]): Promise<DataSourceQueryResult> {
    // Add LIMIT clause to the query
    const limitedQuery = `${query} LIMIT ${limit}`;
    return this.executeQuery(connection, limitedQuery, params);
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
    return this.executeQuery(connection, query);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      const query = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const result = await this.executeQuery(connection, query);
      return parseInt(result.rows[0][0] as string) || 0;
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, any>> {
    try {
      // This would get information about the SQLite database
      return {
        database_name: connection.additional_config?.file_name,
        database_version: 'SQLite 3.45',
        file_size: connection.additional_config?.file_size,
        encoding: connection.additional_config?.encoding || 'utf-8',
        is_readonly: connection.additional_config?.is_readonly || false,
        page_size: 4096,
        page_count: 1000,
        last_modified: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting SQLite database info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would query SQLite sqlite_master table
      // For now, we'll return a mock list
      return ['users', 'posts', 'comments', 'categories', 'tags'];
    } catch (error) {
      console.error('❌ Error getting SQLite table list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would query SQLite pragma table_info
      // For now, we'll return a mock list
      return ['id', 'title', 'content', 'created_at', 'updated_at', 'author_id'];
    } catch (error) {
      console.error(`❌ Error getting SQLite column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic SQL validation for SQLite
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for basic SQL keywords
      const validKeywords = ['select', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'pragma', 'attach', 'detach', 'vacuum', 'analyze'];
      const hasValidKeyword = validKeywords.some(keyword => trimmedQuery.startsWith(keyword));
      
      if (!hasValidKeyword) {
        return { valid: false, error: 'Query must start with a valid SQL keyword' };
      }
      
      // Check for dangerous operations (basic security check)
      const dangerousKeywords = ['drop database', 'drop schema', 'truncate'];
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
      // Basic query formatting for SQLite
      // This could be enhanced with a proper SQL formatter library
      return query
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*\(\s*/g, '(')
        .replace(/\s*\)\s*/g, ')')
        .trim();
    } catch (error) {
      console.error('❌ Error formatting SQLite query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // This would use SQLite's EXPLAIN QUERY PLAN command
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const result = await this.executeQuery(connection, explainQuery);
      
      // Return the query plan as a formatted string
      return result.rows.map(row => row.join(' | ')).join('\n');
    } catch (error) {
      console.error('❌ Error getting SQLite query plan:', error);
      throw error;
    }
  }
}
