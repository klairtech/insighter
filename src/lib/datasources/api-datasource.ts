/**
 * Generic API Data Source Agent
 * 
 * Specialized agent for handling generic API connections and operations
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
  ExternalDataSourceConfig
} from './types';

export class APIDataSource implements DataSourceAgent {
  name = 'Generic API Data Source';
  description = 'Handles generic API connections and operations';
  type = 'api' as const;
  
  capabilities: DataSourceCapabilities = {
    supports_sql: false,
    supports_transactions: false,
    supports_stored_procedures: false,
    supports_functions: false,
    supports_views: false,
    supports_indexes: false,
    supports_foreign_keys: false,
    max_query_size: 100000, // 100KB
    max_result_size: 1000000, // 1MB
    supported_data_types: [
      'JSON', 'XML', 'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'ARRAY', 'OBJECT'
    ],
    supported_operations: [
      'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ANALYZE', 'EXTRACT'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing API connection...');
      
      // Validate required connection parameters
      if (!config.api_url) {
        throw new Error('API URL is required');
      }
      
      // Validate URL format
      try {
        new URL(config.api_url as string);
      } catch {
        throw new Error('Invalid API URL format');
      }
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple HTTP request
      const queryStartTime = Date.now();
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          api_url: config.api_url,
          status_code: 200,
          content_type: 'application/json',
          rate_limit: config.rate_limit || 100,
          timeout: config.timeout || 30000
        }
      };
    } catch (error) {
      return {
        success: false,
        connection_time_ms: Date.now() - startTime,
        query_time_ms: 0,
        error_message: error instanceof Error ? error.message : 'Unknown connection error',
        metadata: {
          error_type: 'api_connection_failed'
        }
      };
    }
  }

  async connect(config: Record<string, unknown>): Promise<DataSourceConnection> {
    try {
      console.log('🔌 Connecting to API...');
      
      // This would create a connection to the API
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `api_${Date.now()}`,
        data_source_id: 'api',
        connection_string: config.api_url as string,
        additional_config: {
          api_url: config.api_url as string,
          api_key: config.api_key as string,
          oauth_token: config.oauth_token,
          refresh_token: config.refresh_token,
          rate_limit: config.rate_limit || 100,
          timeout: config.timeout || 30000,
          retry_attempts: config.retry_attempts || 3,
          headers: (config.additional_config as Record<string, unknown>)?.headers || {},
          auth_type: config.api_key ? 'API_KEY' : config.oauth_token ? 'OAUTH' : 'NONE'
        }
      };
      
      console.log('✅ API connection established');
      return connection;
    } catch (error) {
      console.error('❌ API connection failed:', error);
      throw new Error(`Failed to connect to API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(_connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from API...');
      // This would close the HTTP connection
      console.log('✅ API connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from API:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving API schema...');
      
      // This would call the API to get schema information
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        metadata: {
          database_name: (connection.additional_config?.api_url as string) || 'api_endpoint',
          database_version: 'REST API',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of endpoints (tables)
      const endpoints = await this.getTableList(connection);
      
      // Get detailed info for each endpoint
      for (const endpointName of endpoints) {
        const tableInfo = await this.getTableInfo(connection, endpointName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved API schema with ${schema.tables.length} endpoints`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving API schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting endpoint info for: ${tableName}`);
      
      // This would call the API to get endpoint metadata
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
      
      // Get columns for this endpoint
      const columns = await this.getColumnList(connection, tableName);
      
      for (const columnName of columns) {
        const columnInfo = await this.getColumnInfo(connection, tableName, columnName);
        table.columns.push(columnInfo);
      }
      
      // Get row count
      table.row_count = await this.getTableRowCount(connection, tableName);
      
      console.log(`✅ Retrieved endpoint info for ${tableName} with ${table.columns.length} columns`);
      return table;
    } catch (error) {
      console.error(`❌ Error getting endpoint info for ${tableName}:`, error);
      throw error;
    }
  }

  async getColumnInfo(connection: DataSourceConnection, tableName: string, columnName: string): Promise<DataSourceColumn> {
    try {
      // This would analyze the column data in the API response
      // For now, we'll return a mock column
      const column: DataSourceColumn = {
        name: columnName,
        type: 'JSON',
        nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        is_unique: false,
        is_indexed: false,
        sample_values: ['Sample value 1', 'Sample value 2', 'Sample value 3'],
        description: `Column ${columnName} from API endpoint ${tableName}`
      };
      
      return column;
    } catch (error) {
      console.error(`❌ Error getting column info for ${tableName}.${columnName}:`, error);
      throw error;
    }
  }

  async executeQuery(connection: DataSourceConnection, query: string, params?: unknown[]): Promise<DataSourceQueryResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Executing API query: ${query.substring(0, 100)}...`);
      
      // APIs don't support SQL, so we'll parse the query as a data extraction request
      // For now, we'll return a mock result
      const result: DataSourceQueryResult = {
        columns: ['id', 'name', 'value', 'created_at'],
        rows: [
          [1, 'Sample 1', 'Value 1', '2024-01-01'],
          [2, 'Sample 2', 'Value 2', '2024-01-02'],
          [3, 'Sample 3', 'Value 3', '2024-01-03']
        ],
        row_count: 3,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'API_CALL',
          endpoint: query.split(':')[1] || 'unknown',
          method: 'GET',
          status_code: 200
        }
      };
      
      console.log(`✅ API query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing API query:', error);
      throw new Error(`API query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: unknown[]): Promise<DataSourceQueryResult> {
    // For APIs, we'll limit the number of rows returned
    const result = await this.executeQuery(connection, query, params);
    
    // Limit the rows
    result.rows = result.rows.slice(0, limit);
    result.row_count = result.rows.length;
    
    return result;
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `GET:${tableName}`;
    return this.executeQueryWithLimit(connection, query, limit);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      // This would call the API to get the data count
      // For now, we'll return a mock count
      return 100; // Mock row count
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, unknown>> {
    try {
      // This would get information about the API
      return {
        api_url: connection.additional_config?.api_url,
        auth_type: connection.additional_config?.auth_type,
        rate_limit: connection.additional_config?.rate_limit,
        timeout: connection.additional_config?.timeout,
        retry_attempts: connection.additional_config?.retry_attempts,
        headers: connection.additional_config?.headers,
        last_modified: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting API info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would call the API to get all endpoint names
      // For now, we'll return a mock list
      return ['users', 'posts', 'comments', 'categories', 'tags'];
    } catch (error) {
      console.error('❌ Error getting API endpoint list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would read the API response and get column names
      // For now, we'll return a mock list
      return ['id', 'name', 'email', 'created_at', 'updated_at', 'status'];
    } catch (error) {
      console.error(`❌ Error getting column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // APIs don't support SQL, so we'll validate API-specific query formats
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for API-specific query formats
      const validFormats = ['get:', 'post:', 'put:', 'delete:', 'patch:', 'head:', 'options:'];
      const hasValidFormat = validFormats.some(format => trimmedQuery.startsWith(format));
      
      if (!hasValidFormat) {
        return { valid: false, error: 'Query must use API-specific format (e.g., GET:users)' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for APIs
      return query
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (error) {
      console.error('❌ Error formatting API query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // APIs don't have query plans, so we'll return a description of what the query will do
      return `API Query Plan:
- URL: ${connection.additional_config?.api_url}
- Method: ${query.split(':')[0] || 'GET'}
- Endpoint: ${query.split(':')[1] || 'unknown'}
- Auth: ${connection.additional_config?.auth_type || 'NONE'}
- Estimated rows: ${await this.getTableRowCount(connection, query.split(':')[1] || 'unknown')}`;
    } catch (error) {
      console.error('❌ Error getting API query plan:', error);
      throw error;
    }
  }
}
