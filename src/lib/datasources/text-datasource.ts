/**
 * Text File Data Source Agent
 * 
 * Specialized agent for handling plain text file connections and operations
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

export class TextDataSource implements DataSourceAgent {
  name = 'Text File Data Source';
  description = 'Handles plain text file connections and operations';
  type = 'text' as const;
  
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
      'TEXT', 'LINE', 'PARAGRAPH', 'WORD', 'CHARACTER'
    ],
    supported_operations: [
      'READ', 'EXTRACT_TEXT', 'ANALYZE', 'SEARCH', 'PARSE', 'FILTER'
    ]
  };

  async testConnection(config: FileDataSourceConfig): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing text file connection...');
      
      // Validate file exists and is readable
      if (!config.file_path || !config.file_name) {
        throw new Error('File path and name are required');
      }
      
      // Check file extension
      if (!config.file_name.toLowerCase().endsWith('.txt') && 
          !config.file_name.toLowerCase().endsWith('.log') &&
          !config.file_name.toLowerCase().endsWith('.md') &&
          !config.file_name.toLowerCase().endsWith('.json') &&
          !config.file_name.toLowerCase().endsWith('.xml')) {
        throw new Error('File must be a text file (.txt, .log, .md, .json, .xml)');
      }
      
      // Simulate file validation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple read operation
      const queryStartTime = Date.now();
      // Simulate reading first few lines
      await new Promise(resolve => setTimeout(resolve, 25));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          file_type: 'Text File',
          file_size: config.file_size,
          encoding: config.encoding || 'utf-8',
          estimated_lines: 100, // Mock value
          estimated_words: 1000 // Mock value
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
      console.log('🔌 Connecting to text file...');
      
      // This would create a connection to the text file
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `text_${Date.now()}`,
        data_source_id: 'text',
        connection_string: config.file_path,
        additional_config: {
          file_name: config.file_name,
          file_type: config.file_type,
          file_size: config.file_size,
          encoding: config.encoding || 'utf-8'
        }
      };
      
      console.log('✅ Text file connection established');
      return connection;
    } catch (error) {
      console.error('❌ Text file connection failed:', error);
      throw new Error(`Failed to connect to text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from text file...');
      // This would close the file handle
      console.log('✅ Text file connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from text file:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving text file schema...');
      
      // This would analyze the text file and extract schema information
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        metadata: {
          database_name: connection.additional_config?.file_name || 'text_file',
          database_version: 'Text 1.0',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of sections (tables) - text files typically have one section
      const sections = await this.getTableList(connection);
      
      // Get detailed info for each section
      for (const sectionName of sections) {
        const tableInfo = await this.getTableInfo(connection, sectionName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved text file schema with ${schema.tables.length} sections`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving text file schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting section info for: ${tableName}`);
      
      // This would analyze the specific section and extract table information
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
      
      // Get columns for this section
      const columns = await this.getColumnList(connection, tableName);
      
      for (const columnName of columns) {
        const columnInfo = await this.getColumnInfo(connection, tableName, columnName);
        table.columns.push(columnInfo);
      }
      
      // Get row count
      table.row_count = await this.getTableRowCount(connection, tableName);
      
      console.log(`✅ Retrieved section info for ${tableName} with ${table.columns.length} columns`);
      return table;
    } catch (error) {
      console.error(`❌ Error getting section info for ${tableName}:`, error);
      throw error;
    }
  }

  async getColumnInfo(connection: DataSourceConnection, tableName: string, columnName: string): Promise<DataSourceColumn> {
    try {
      // This would analyze the column data in the text file section
      // For now, we'll return a mock column
      const column: DataSourceColumn = {
        name: columnName,
        type: 'TEXT',
        nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        is_unique: false,
        is_indexed: false,
        sample_values: ['Sample text 1', 'Sample text 2', 'Sample text 3'],
        description: `Column ${columnName} from text file section ${tableName}`
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
      console.log(`🔍 Executing text file query: ${query.substring(0, 100)}...`);
      
      // Text files don't support SQL, so we'll parse the query as a data extraction request
      // For now, we'll return a mock result
      const result: DataSourceQueryResult = {
        columns: ['Content', 'Line_Number', 'Type', 'Length'],
        rows: [
          ['Sample line 1 content', 1, 'LINE', 20],
          ['Sample line 2 content', 2, 'LINE', 21],
          ['Sample line 3 content', 3, 'LINE', 22]
        ],
        row_count: 3,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'TEXT_EXTRACT',
          extraction_method: 'LINE_BY_LINE',
          file_type: 'Text File'
        }
      };
      
      console.log(`✅ Text file query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing text file query:', error);
      throw new Error(`Text file query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: any[]): Promise<DataSourceQueryResult> {
    // For text files, we'll limit the number of rows returned
    const result = await this.executeQuery(connection, query, params);
    
    // Limit the rows
    result.rows = result.rows.slice(0, limit);
    result.row_count = result.rows.length;
    
    return result;
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `EXTRACT_TEXT:${tableName}`;
    return this.executeQueryWithLimit(connection, query, limit);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      // This would count the lines/rows in the text file section
      // For now, we'll return a mock count
      return 100; // Mock row count
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, any>> {
    try {
      // This would get information about the text file
      return {
        file_name: connection.additional_config?.file_name,
        file_type: connection.additional_config?.file_type,
        file_size: connection.additional_config?.file_size,
        encoding: connection.additional_config?.encoding,
        estimated_lines: 100, // Mock value
        estimated_words: 1000, // Mock value
        estimated_characters: 5000, // Mock value
        last_modified: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting text file info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // Text files typically have one section (the file itself)
      // For now, we'll return a mock list
      return ['content']; // Single table representing the text content
    } catch (error) {
      console.error('❌ Error getting text file section list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would read the text file and get column names
      // For now, we'll return a mock list
      return ['Content', 'Line_Number', 'Type', 'Length', 'Position'];
    } catch (error) {
      console.error(`❌ Error getting column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Text files don't support SQL, so we'll validate text-specific query formats
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for text-specific query formats
      const validFormats = ['extract_text:', 'get_lines:', 'search:', 'analyze:', 'parse:'];
      const hasValidFormat = validFormats.some(format => trimmedQuery.startsWith(format));
      
      if (!hasValidFormat) {
        return { valid: false, error: 'Query must use text-specific format (e.g., EXTRACT_TEXT:content)' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for text files
      return query
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (error) {
      console.error('❌ Error formatting text file query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // Text files don't have query plans, so we'll return a description of what the query will do
      return `Text File Query Plan:
- File: ${connection.additional_config?.file_name}
- Operation: ${query.split(':')[0] || 'EXTRACT_TEXT'}
- Target: ${query.split(':')[1] || 'content'}
- Estimated lines: ${await this.getTableRowCount(connection, query.split(':')[1] || 'content')}`;
    } catch (error) {
      console.error('❌ Error getting text file query plan:', error);
      throw error;
    }
  }
}
