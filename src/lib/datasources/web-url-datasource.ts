/**
 * Web URL Data Source Agent
 * 
 * Specialized agent for handling web URL connections and operations
 * Integrates with the real web scraper connector
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
import { WebScraperConnector, WebScrapingConfig, WebScrapedData } from './web-scraper';

export class WebURLDataSource implements DataSourceAgent {
  name = 'Web URL Data Source';
  description = 'Handles web URL connections and operations';
  type = 'web-url' as const;
  
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
      'TEXT', 'HTML', 'JSON', 'XML', 'CSV', 'IMAGE', 'LINK', 'METADATA'
    ],
    supported_operations: [
      'READ', 'SCRAPE', 'EXTRACT', 'ANALYZE', 'SEARCH', 'PARSE', 'CACHE'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing web URL connection...');
      
      // Validate required connection parameters
      if (!config.api_url) {
        throw new Error('URL is required');
      }
      
      // Validate URL format
      try {
        new URL(config.api_url as string);
      } catch {
        throw new Error('Invalid URL format');
      }
      
      // Test with real web scraper
      const scraper = new WebScraperConnector({
        url: config.api_url as string,
        maxContentLength: 1000, // Small test
        timeout: 10000
      });
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple scrape
      const queryStartTime = Date.now();
      const testResult = await scraper.scrapeUrl();
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          url: config.api_url,
          status_code: 200,
          content_type: 'text/html',
          content_length: testResult.metadata.contentLength,
          last_modified: testResult.metadata.scrapedAt,
          title: testResult.title,
          word_count: testResult.metadata.wordCount
        }
      };
    } catch (error) {
      return {
        success: false,
        connection_time_ms: Date.now() - startTime,
        query_time_ms: 0,
        error_message: error instanceof Error ? error.message : 'Unknown connection error',
        metadata: {
          error_type: 'http_connection_failed'
        }
      };
    }
  }

  async connect(config: Record<string, unknown>): Promise<DataSourceConnection> {
    try {
      console.log('🔌 Connecting to web URL...');
      
      // This would create a connection to the web URL
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `weburl_${Date.now()}`,
        data_source_id: 'web-url',
        connection_string: config.api_url as string,
        additional_config: {
          url: config.api_url as string,
          timeout: (config.timeout as number) || 30000,
          retry_attempts: config.retry_attempts || 3,
          user_agent: 'InsighterBot/1.0',
          headers: (config.additional_config as Record<string, unknown>)?.headers || {},
          rate_limit: config.rate_limit || 10
        }
      };
      
      console.log('✅ Web URL connection established');
      return connection;
    } catch (error) {
      console.error('❌ Web URL connection failed:', error);
      throw new Error(`Failed to connect to web URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from web URL...');
      // This would close the HTTP connection
      console.log('✅ Web URL connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from web URL:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving web URL schema...');
      
      // This would analyze the web page and extract schema information
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        metadata: {
          database_name: (connection.additional_config?.url as string) || 'web_page',
          database_version: 'HTTP/1.1',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of sections (tables)
      const sections = await this.getTableList(connection);
      
      // Get detailed info for each section
      for (const sectionName of sections) {
        const tableInfo = await this.getTableInfo(connection, sectionName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved web URL schema with ${schema.tables.length} sections`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving web URL schema:', error);
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
      // This would analyze the column data in the web page section
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
        description: `Column ${columnName} from web page section ${tableName}`
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
      console.log(`🔍 Executing web URL query: ${query.substring(0, 100)}...`);
      
      // Extract URL from connection config
      const url = connection.additional_config?.url || connection.additional_config?.api_url;
      if (!url) {
        throw new Error('URL is required for web scraping');
      }
      
      // Use real web scraper
      const scraper = new WebScraperConnector({
        url: url as string,
        maxContentLength: 50000,
        includeImages: false,
        includeLinks: true,
        respectRobotsTxt: true,
        timeout: 30000
      });
      
      // Scrape the URL
      const scrapedData = await scraper.scrapeUrl();
      
      // Convert to standardized format
      const standardizedData = this.convertToStandardFormat(scrapedData, query);
      
      const result: DataSourceQueryResult = {
        columns: ['Content', 'Type', 'Selector', 'Position', 'URL'],
        rows: standardizedData,
        row_count: standardizedData.length,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'WEB_SCRAPE',
          url: url,
          extraction_method: 'CSS_SELECTOR',
          title: scrapedData.title,
          content_length: scrapedData.metadata.contentLength,
          word_count: scrapedData.metadata.wordCount,
          has_images: scrapedData.metadata.hasImages,
          has_links: scrapedData.metadata.hasLinks
        }
      };
      
      console.log(`✅ Web URL query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing web URL query:', error);
      throw new Error(`Web URL query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: any[]): Promise<DataSourceQueryResult> {
    // For web URLs, we'll limit the number of rows returned
    const result = await this.executeQuery(connection, query, params);
    
    // Limit the rows
    result.rows = result.rows.slice(0, limit);
    result.row_count = result.rows.length;
    
    return result;
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `SCRAPE:${tableName}`;
    return this.executeQueryWithLimit(connection, query, limit);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      // This would count the elements/rows in the web page section
      // For now, we'll return a mock count
      return 20; // Mock row count
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, any>> {
    try {
      // This would get information about the web page
      return {
        url: connection.additional_config?.url,
        status_code: 200,
        content_type: 'text/html',
        content_length: 50000,
        last_modified: new Date().toISOString(),
        user_agent: connection.additional_config?.user_agent,
        timeout: connection.additional_config?.timeout,
        retry_attempts: connection.additional_config?.retry_attempts
      };
    } catch (error) {
      console.error('❌ Error getting web URL info:', error);
      throw error;
    }
  }

  async getTableList(connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would analyze the web page and get all section names
      // For now, we'll return a mock list
      return ['content', 'navigation', 'sidebar', 'footer', 'header'];
    } catch (error) {
      console.error('❌ Error getting web URL section list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would read the web page section and get column names
      // For now, we'll return a mock list
      return ['Content', 'Type', 'Selector', 'Position', 'Attributes'];
    } catch (error) {
      console.error(`❌ Error getting column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Web URLs don't support SQL, so we'll validate web-specific query formats
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for web-specific query formats
      const validFormats = ['scrape:', 'extract:', 'get_content:', 'search:', 'analyze:'];
      const hasValidFormat = validFormats.some(format => trimmedQuery.startsWith(format));
      
      if (!hasValidFormat) {
        return { valid: false, error: 'Query must use web-specific format (e.g., SCRAPE:content)' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for web URLs
      return query
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (error) {
      console.error('❌ Error formatting web URL query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // Web URLs don't have query plans, so we'll return a description of what the query will do
      return `Web URL Query Plan:
- URL: ${connection.additional_config?.url}
- Operation: ${query.split(':')[0] || 'SCRAPE'}
- Target: ${query.split(':')[1] || 'content'}
- Method: HTTP GET
- Estimated elements: ${await this.getTableRowCount(connection, query.split(':')[1] || 'content')}`;
    } catch (error) {
      console.error('❌ Error getting web URL query plan:', error);
      throw error;
    }
  }

  /**
   * Convert web scraped data to standardized format
   */
  private convertToStandardFormat(scrapedData: WebScrapedData, query: string): any[][] {
    const rows: any[][] = [];
    
    // Add main content
    rows.push([
      scrapedData.content,
      'CONTENT',
      'body',
      1,
      scrapedData.url
    ]);
    
    // Add structured data if available
    if (scrapedData.structuredData) {
      // Add headings
      scrapedData.structuredData.headings.forEach((heading, index) => {
        rows.push([
          heading.text,
          'HEADING',
          `h${heading.level}`,
          index + 1,
          scrapedData.url
        ]);
      });
      
      // Add links
      scrapedData.structuredData.links.forEach((link, index) => {
        rows.push([
          link.text,
          'LINK',
          'a',
          index + 1,
          link.url
        ]);
      });
      
      // Add table data
      scrapedData.structuredData.tables.forEach((table, tableIndex) => {
        table.rows.forEach((row, rowIndex) => {
          row.forEach((cell, cellIndex) => {
            rows.push([
              cell,
              'TABLE_CELL',
              `table-${tableIndex}-cell-${cellIndex}`,
              rowIndex + 1,
              scrapedData.url
            ]);
          });
        });
      });
    }
    
    return rows;
  }
}
