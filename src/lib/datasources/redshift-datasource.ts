/**
 * Redshift Data Source Agent
 * 
 * Specialized agent for handling Amazon Redshift database connections and operations
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

export class RedshiftDataSource implements DataSourceAgent {
  name = 'Redshift Data Source';
  description = 'Handles Amazon Redshift database connections and operations';
  type = 'redshift' as const;
  
  capabilities: DataSourceCapabilities = {
    supports_sql: true,
    supports_transactions: true,
    supports_stored_procedures: true,
    supports_functions: true,
    supports_views: true,
    supports_indexes: false, // Redshift uses distribution keys instead
    supports_foreign_keys: false, // Redshift doesn't enforce foreign keys
    max_query_size: 10000000, // 10MB
    max_result_size: 100000000, // 100MB
    supported_data_types: [
      'VARCHAR', 'CHAR', 'TEXT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC',
      'REAL', 'DOUBLE PRECISION', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
      'INTERVAL', 'SUPER', 'VARBYTE'
    ],
    supported_operations: [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'COPY',
      'UNLOAD', 'VACUUM', 'ANALYZE', 'EXPLAIN', 'WITH', 'CTE'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing Redshift connection...');
      
      // Validate required connection parameters
      if (!config.host || !config.database_name || !config.username) {
        throw new Error('Host, database name, and username are required');
      }
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 200)); // Redshift connections can be slower
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple query
      const queryStartTime = Date.now();
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 100));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          database_version: 'Amazon Redshift 1.0',
          cluster_info: 'Connection successful',
          node_count: 2 // Mock value
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
      console.log('🔌 Connecting to Redshift database...');
      
      // This would create an actual Redshift connection
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `redshift_${Date.now()}`,
        data_source_id: 'redshift',
        host: config.host as string,
        port: (config.port as number) || 5439, // Default Redshift port
        database_name: config.database_name as string,
        username: config.username as string,
        connection_timeout: (config.connection_timeout as number) || 60000, // Longer timeout for Redshift
        query_timeout: (config.query_timeout as number) || 300000, // 5 minutes for large queries
        max_connections: (config.max_connections as number) || 5, // Redshift has connection limits
        additional_config: {
          ...(config.additional_config as Record<string, unknown>),
          ssl_mode: 'require',
          cluster_identifier: (config.additional_config as Record<string, unknown>)?.cluster_identifier
        }
      };
      
      console.log('✅ Redshift connection established');
      return connection;
    } catch (error) {
      console.error('❌ Redshift connection failed:', error);
      throw new Error(`Failed to connect to Redshift: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Redshift...');
      // This would close the actual connection
      console.log('✅ Redshift connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from Redshift:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving Redshift schema...');
      
      // This would query the Redshift system tables
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        views: [],
        functions: [],
        procedures: [],
        metadata: {
          database_name: connection.database_name || 'redshift',
          database_version: 'Amazon Redshift 1.0',
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
      
      console.log(`✅ Retrieved Redshift schema with ${schema.tables.length} tables`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving Redshift schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting table info for: ${tableName}`);
      
      // This would query Redshift system tables
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
      // This would query Redshift information_schema.columns
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
      console.log(`🔍 Executing Redshift query: ${query.substring(0, 100)}...`);
      
      // This would execute the actual query using a Redshift client
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
          cluster_info: 'dc2.large'
        }
      };
      
      console.log(`✅ Redshift query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing Redshift query:', error);
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
      // This would query Redshift system tables for database info
      return {
        database_name: connection.database_name,
        database_version: 'Amazon Redshift 1.0',
        cluster_identifier: connection.additional_config?.cluster_identifier,
        node_type: 'dc2.large',
        node_count: 2,
        region: 'us-east-1',
        max_connections: connection.max_connections,
        current_connections: 3
      };
    } catch (error) {
      console.error('❌ Error getting Redshift database info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would query Redshift information_schema.tables
      // For now, we'll return a mock list
      return ['users', 'orders', 'products', 'analytics_events', 'user_sessions'];
    } catch (error) {
      console.error('❌ Error getting Redshift table list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would query Redshift information_schema.columns
      // For now, we'll return a mock list
      return ['id', 'name', 'email', 'created_at', 'updated_at', 'user_id'];
    } catch (error) {
      console.error(`❌ Error getting Redshift column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic SQL validation for Redshift
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for basic SQL keywords
      const validKeywords = ['select', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'with', 'copy', 'unload'];
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
      
      // Check for Redshift-specific limitations
      if (trimmedQuery.includes('limit') && !trimmedQuery.includes('order by')) {
        return { valid: false, error: 'Redshift requires ORDER BY when using LIMIT' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for Redshift
      // This could be enhanced with a proper SQL formatter library
      return query
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*\(\s*/g, '(')
        .replace(/\s*\)\s*/g, ')')
        .trim();
    } catch (error) {
      console.error('❌ Error formatting Redshift query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // This would use Redshift's EXPLAIN command
      const explainQuery = `EXPLAIN ${query}`;
      const result = await this.executeQuery(connection, explainQuery);
      
      // Return the query plan as a formatted string
      return result.rows.map(row => row.join(' ')).join('\n');
    } catch (error) {
      console.error('❌ Error getting Redshift query plan:', error);
      throw error;
    }
  }
}
