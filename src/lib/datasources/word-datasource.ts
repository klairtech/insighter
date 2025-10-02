/**
 * Word Data Source Agent
 * 
 * Specialized agent for handling Microsoft Word document connections and operations
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

export class WordDataSource implements DataSourceAgent {
  name = 'Word Data Source';
  description = 'Handles Microsoft Word document connections and operations';
  type = 'word' as const;
  
  capabilities: DataSourceCapabilities = {
    supports_sql: false,
    supports_transactions: false,
    supports_stored_procedures: false,
    supports_functions: false,
    supports_views: false,
    supports_indexes: false,
    supports_foreign_keys: false,
    max_query_size: 50000, // 50KB
    max_result_size: 500000, // 500KB
    supported_data_types: [
      'TEXT', 'HEADING', 'PARAGRAPH', 'TABLE', 'IMAGE', 'HYPERLINK', 'LIST', 'FORM_FIELD'
    ],
    supported_operations: [
      'READ', 'EXTRACT_TEXT', 'EXTRACT_TABLES', 'EXTRACT_IMAGES', 'ANALYZE', 'SEARCH'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing Word document connection...');
      
      // Validate file exists and is readable
      if (!config.file_path || !config.file_name) {
        throw new Error('File path and name are required');
      }
      
      // Check file extension
      const fileName = config.file_name as string;
      if (!fileName.toLowerCase().endsWith('.docx') && 
          !fileName.toLowerCase().endsWith('.doc')) {
        throw new Error('File must be a Word document (.docx or .doc)');
      }
      
      // Simulate file validation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple read operation
      const queryStartTime = Date.now();
      // Simulate reading document structure
      await new Promise(resolve => setTimeout(resolve, 50));
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          file_type: 'Word Document',
          file_size: config.file_size,
          pages_available: 5, // Mock value
          has_tables: true,
          has_images: true,
          word_count: 1000 // Mock value
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

  async connect(config: Record<string, unknown>): Promise<DataSourceConnection> {
    try {
      console.log('🔌 Connecting to Word document...');
      
      // This would create a connection to the Word document
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `word_${Date.now()}`,
        data_source_id: 'word',
        connection_string: config.file_path as string,
        additional_config: {
          file_name: config.file_name as string,
          file_type: config.file_type as string,
          file_size: config.file_size,
          encoding: config.encoding || 'utf-8'
        }
      };
      
      console.log('✅ Word document connection established');
      return connection;
    } catch (error) {
      console.error('❌ Word document connection failed:', error);
      throw new Error(`Failed to connect to Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Word document...');
      // This would close the file handle
      console.log('✅ Word document connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from Word document:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving Word document schema...');
      
      // This would analyze the Word document and extract schema information
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        metadata: {
          database_name: (connection.additional_config?.file_name as string) || 'word_document',
          database_version: 'Word 2021',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of sections/pages (tables)
      const sections = await this.getTableList(connection);
      
      // Get detailed info for each section
      for (const sectionName of sections) {
        const tableInfo = await this.getTableInfo(connection, sectionName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved Word document schema with ${schema.tables.length} sections`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving Word document schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting section info for: ${tableName}`);
      
      // This would analyze the specific section/page and extract table information
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
      // This would analyze the column data in the Word document section
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
        description: `Column ${columnName} from Word document section ${tableName}`
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
      console.log(`🔍 Executing Word document query: ${query.substring(0, 100)}...`);
      
      // Word doesn't support SQL, so we'll parse the query as a data extraction request
      // For now, we'll return a mock result
      const result: DataSourceQueryResult = {
        columns: ['Content', 'Type', 'Page', 'Style'],
        rows: [
          ['Sample paragraph content 1', 'PARAGRAPH', 1, 'Normal'],
          ['Sample heading content 1', 'HEADING', 1, 'Heading 1'],
          ['Sample table content 1', 'TABLE', 2, 'Table']
        ],
        row_count: 3,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'WORD_EXTRACT',
          extraction_method: 'TEXT',
          document_type: 'Word Document'
        }
      };
      
      console.log(`✅ Word document query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing Word document query:', error);
      throw new Error(`Word document query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: any[]): Promise<DataSourceQueryResult> {
    // For Word, we'll limit the number of rows returned
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
      // This would count the text blocks/rows in the Word document section
      // For now, we'll return a mock count
      return 25; // Mock row count
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, any>> {
    try {
      // This would get information about the Word document
      return {
        file_name: connection.additional_config?.file_name,
        file_type: connection.additional_config?.file_type,
        file_size: connection.additional_config?.file_size,
        encoding: connection.additional_config?.encoding,
        pages_count: 5, // Mock value
        word_count: 1000, // Mock value
        has_tables: true,
        has_images: true,
        has_hyperlinks: true,
        last_modified: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting Word document info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would read the Word document and get all page/section names
      // For now, we'll return a mock list
      return ['Page_1', 'Page_2', 'Table_1', 'Summary', 'Appendix'];
    } catch (error) {
      console.error('❌ Error getting Word document section list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would read the Word document section and get column names
      // For now, we'll return a mock list
      return ['Content', 'Type', 'Page_Number', 'Style', 'Format'];
    } catch (error) {
      console.error(`❌ Error getting column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Word doesn't support SQL, so we'll validate Word-specific query formats
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for Word-specific query formats
      const validFormats = ['extract_text:', 'extract_tables:', 'search:', 'analyze:', 'get_page:'];
      const hasValidFormat = validFormats.some(format => trimmedQuery.startsWith(format));
      
      if (!hasValidFormat) {
        return { valid: false, error: 'Query must use Word-specific format (e.g., EXTRACT_TEXT:Page_1)' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for Word
      return query
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (error) {
      console.error('❌ Error formatting Word query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // Word doesn't have query plans, so we'll return a description of what the query will do
      return `Word Document Query Plan:
- File: ${connection.additional_config?.file_name}
- Operation: ${query.split(':')[0] || 'EXTRACT_TEXT'}
- Target: ${query.split(':')[1] || 'All pages'}
- Estimated content blocks: ${await this.getTableRowCount(connection, query.split(':')[1] || 'Page_1')}`;
    } catch (error) {
      console.error('❌ Error getting Word query plan:', error);
      throw error;
    }
  }
}
