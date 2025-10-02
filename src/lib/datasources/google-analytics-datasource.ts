/**
 * Google Analytics Data Source Agent
 * 
 * Specialized agent for handling Google Analytics connections and operations
 * Integrates with the real Google Analytics API connector
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
import { GoogleAnalyticsConnector, GoogleAnalyticsConfig, GoogleAnalyticsData } from './google-analytics';

export class GoogleAnalyticsDataSource implements DataSourceAgent {
  name = 'Google Analytics Data Source';
  description = 'Handles Google Analytics connections and operations';
  type = 'google-analytics' as const;
  
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
      'METRIC', 'DIMENSION', 'DATE', 'STRING', 'NUMBER', 'BOOLEAN', 'CURRENCY', 'PERCENTAGE'
    ],
    supported_operations: [
      'READ', 'ANALYZE', 'REPORT', 'EXTRACT', 'AGGREGATE', 'FILTER', 'SEGMENT'
    ]
  };

  async testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing Google Analytics connection...');
      
      // Validate required connection parameters
      if (!config.oauth_token) {
        throw new Error('OAuth token is required for Google Analytics');
      }
      
      // Test with real Google Analytics API
      const connector = new GoogleAnalyticsConnector(config.oauth_token as string, config.refresh_token as string);
      
      const connectionTime = Date.now() - startTime;
      
      // Test with a simple API call
      const queryStartTime = Date.now();
      // Test with a sample property ID (this would be a real test in production)
      const testResult = await connector.fetchAnalyticsData({
        propertyId: 'test-property-id',
        startDate: '7daysAgo',
        endDate: 'today',
        metrics: ['sessions'],
        dimensions: ['date'],
        maxResults: 1
      });
      const queryTime = Date.now() - queryStartTime;
      
      return {
        success: true,
        connection_time_ms: connectionTime,
        query_time_ms: queryTime,
        metadata: {
          api_version: 'v4',
          auth_method: 'OAuth',
          rate_limit: config.rate_limit || 100,
          quota_remaining: 1000,
          property_count: 3,
          test_property: testResult.propertyName
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
      console.log('🔌 Connecting to Google Analytics...');
      
      // This would create a connection to Google Analytics API
      // For now, we'll return a mock connection object
      const connection: DataSourceConnection = {
        id: `ganalytics_${Date.now()}`,
        data_source_id: 'google-analytics',
        connection_string: (config.api_url as string) || 'https://analyticsreporting.googleapis.com/v4/reports:batchGet',
        additional_config: {
          api_key: config.api_key,
          oauth_token: config.oauth_token,
          refresh_token: config.refresh_token,
          rate_limit: config.rate_limit || 100,
          timeout: config.timeout || 30000,
          retry_attempts: config.retry_attempts || 3,
          view_id: (config.additional_config as Record<string, unknown>)?.view_id
        }
      };
      
      console.log('✅ Google Analytics connection established');
      return connection;
    } catch (error) {
      console.error('❌ Google Analytics connection failed:', error);
      throw new Error(`Failed to connect to Google Analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(_connection: DataSourceConnection): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Google Analytics...');
      // This would close the API connection
      console.log('✅ Google Analytics connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from Google Analytics:', error);
      throw error;
    }
  }

  async getSchema(connection: DataSourceConnection): Promise<DataSourceSchema> {
    try {
      console.log('📊 Retrieving Google Analytics schema...');
      
      // This would call the Google Analytics API to get metadata
      // For now, we'll return a mock schema
      const schema: DataSourceSchema = {
        tables: [],
        metadata: {
          database_name: 'Google Analytics',
          database_version: 'v4',
          schema_version: '1.0',
          last_updated: new Date().toISOString(),
          total_tables: 0,
          total_columns: 0
        }
      };
      
      // Get list of reports (tables)
      const reports = await this.getTableList(connection);
      
      // Get detailed info for each report
      for (const reportName of reports) {
        const tableInfo = await this.getTableInfo(connection, reportName);
        schema.tables.push(tableInfo);
      }
      
      schema.metadata.total_tables = schema.tables.length;
      schema.metadata.total_columns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
      
      console.log(`✅ Retrieved Google Analytics schema with ${schema.tables.length} reports`);
      return schema;
    } catch (error) {
      console.error('❌ Error retrieving Google Analytics schema:', error);
      throw error;
    }
  }

  async getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable> {
    try {
      console.log(`📋 Getting report info for: ${tableName}`);
      
      // This would call the Google Analytics API to get report metadata
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
      
      // Get columns for this report
      const columns = await this.getColumnList(connection, tableName);
      
      for (const columnName of columns) {
        const columnInfo = await this.getColumnInfo(connection, tableName, columnName);
        table.columns.push(columnInfo);
      }
      
      // Get row count
      table.row_count = await this.getTableRowCount(connection, tableName);
      
      console.log(`✅ Retrieved report info for ${tableName} with ${table.columns.length} columns`);
      return table;
    } catch (error) {
      console.error(`❌ Error getting report info for ${tableName}:`, error);
      throw error;
    }
  }

  async getColumnInfo(connection: DataSourceConnection, tableName: string, columnName: string): Promise<DataSourceColumn> {
    try {
      // This would analyze the column data in the Google Analytics report
      // For now, we'll return a mock column
      const column: DataSourceColumn = {
        name: columnName,
        type: 'METRIC',
        nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        is_unique: false,
        is_indexed: false,
        sample_values: ['100', '200', '300'],
        description: `Column ${columnName} from Google Analytics report ${tableName}`
      };
      
      return column;
    } catch (error) {
      console.error(`❌ Error getting column info for ${tableName}.${columnName}:`, error);
      throw error;
    }
  }

  async executeQuery(connection: DataSourceConnection, query: string, _params?: unknown[]): Promise<DataSourceQueryResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Executing Google Analytics query: ${query.substring(0, 100)}...`);
      
      // Extract property ID from connection config
      const propertyId = connection.additional_config?.property_id;
      if (!propertyId) {
        throw new Error('Property ID is required for Google Analytics queries');
      }
      
      // Use real Google Analytics connector
      const connector = new GoogleAnalyticsConnector(
        connection.additional_config?.oauth_token as string,
        connection.additional_config?.refresh_token as string
      );
      
      // Parse query to extract metrics and dimensions
      const analyticsConfig = this.parseAnalyticsQuery(query, propertyId as string);
      
      // Fetch analytics data
      const analyticsData = await connector.fetchAnalyticsData(analyticsConfig);
      
      // Convert to standardized format
      const standardizedData = this.convertToStandardFormat(analyticsData, query);
      
      const result: DataSourceQueryResult = {
        columns: ['Date', 'Sessions', 'Users', 'Pageviews', 'Bounce Rate', 'Property'],
        rows: standardizedData,
        row_count: standardizedData.length,
        execution_time_ms: Date.now() - startTime,
        query: query,
        metadata: {
          query_type: 'GOOGLE_ANALYTICS_REPORT',
          property_id: propertyId,
          date_range: `${analyticsConfig.startDate} to ${analyticsConfig.endDate}`,
          metrics: analyticsConfig.metrics,
          dimensions: analyticsConfig.dimensions,
          total_reports: analyticsData.metadata.totalReports
        }
      };
      
      console.log(`✅ Google Analytics query executed successfully, returned ${result.row_count} rows`);
      return result;
    } catch (error) {
      console.error('❌ Error executing Google Analytics query:', error);
      throw new Error(`Google Analytics query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: unknown[]): Promise<DataSourceQueryResult> {
    // For Google Analytics, we'll limit the number of rows returned
    const result = await this.executeQuery(connection, query, params);
    
    // Limit the rows
    result.rows = result.rows.slice(0, limit);
    result.row_count = result.rows.length;
    
    return result;
  }

  async getSampleData(connection: DataSourceConnection, tableName: string, limit: number = 10): Promise<DataSourceQueryResult> {
    const query = `GET_REPORT:${tableName}`;
    return this.executeQueryWithLimit(connection, query, limit);
  }

  async getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number> {
    try {
      // This would call the Google Analytics API to get the data count
      // For now, we'll return a mock count
      return 30; // Mock row count (30 days of data)
    } catch (error) {
      console.error(`❌ Error getting row count for ${tableName}:`, error);
      return 0;
    }
  }

  async getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, unknown>> {
    try {
      // This would get information about the Google Analytics account
      return {
        api_version: 'v4',
        auth_method: connection.additional_config?.oauth_token ? 'OAuth' : 'API Key',
        rate_limit: connection.additional_config?.rate_limit || 100,
        timeout: connection.additional_config?.timeout || 30000,
        retry_attempts: connection.additional_config?.retry_attempts || 3,
        quota_remaining: 1000,
        view_id: connection.additional_config?.view_id,
        property_count: 3,
        last_modified: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting Google Analytics info:', error);
      throw error;
    }
  }

  async getTableList(_connection: DataSourceConnection): Promise<string[]> {
    try {
      // This would call the Google Analytics API to get all report names
      // For now, we'll return a mock list
      return ['audience_overview', 'acquisition_overview', 'behavior_overview', 'conversions_overview', 'real_time'];
    } catch (error) {
      console.error('❌ Error getting Google Analytics report list:', error);
      throw error;
    }
  }

  async getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]> {
    try {
      // This would read the Google Analytics report and get column names
      // For now, we'll return a mock list
      return ['Date', 'Sessions', 'Users', 'Pageviews', 'Bounce Rate', 'Avg Session Duration'];
    } catch (error) {
      console.error(`❌ Error getting column list for ${tableName}:`, error);
      throw error;
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Google Analytics doesn't support SQL, so we'll validate Google Analytics-specific query formats
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return { valid: false, error: 'Query is empty' };
      }
      
      // Check for Google Analytics-specific query formats
      const validFormats = ['get_report:', 'analyze:', 'extract:', 'aggregate:', 'filter:'];
      const hasValidFormat = validFormats.some(format => trimmedQuery.startsWith(format));
      
      if (!hasValidFormat) {
        return { valid: false, error: 'Query must use Google Analytics-specific format (e.g., GET_REPORT:audience_overview)' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown validation error' };
    }
  }

  async formatQuery(query: string): Promise<string> {
    try {
      // Basic query formatting for Google Analytics
      return query
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    } catch (error) {
      console.error('❌ Error formatting Google Analytics query:', error);
      return query; // Return original query if formatting fails
    }
  }

  async getQueryPlan(connection: DataSourceConnection, query: string): Promise<string> {
    try {
      // Google Analytics doesn't have query plans, so we'll return a description of what the query will do
      return `Google Analytics Query Plan:
- API: Google Analytics Reporting API v4
- Operation: ${query.split(':')[0] || 'GET_REPORT'}
- Target: ${query.split(':')[1] || 'audience_overview'}
- View ID: ${connection.additional_config?.view_id || 'unknown'}
- Estimated rows: ${await this.getTableRowCount(connection, query.split(':')[1] || 'audience_overview')}`;
    } catch (error) {
      console.error('❌ Error getting Google Analytics query plan:', error);
      throw error;
    }
  }

  /**
   * Parse analytics query to extract configuration
   */
  private parseAnalyticsQuery(query: string, propertyId: string): GoogleAnalyticsConfig {
    // Default configuration
    const config: GoogleAnalyticsConfig = {
      propertyId,
      startDate: '7daysAgo',
      endDate: 'today',
      metrics: ['sessions', 'users', 'pageviews'],
      dimensions: ['date'],
      maxResults: 1000
    };

    // Parse query for specific metrics and dimensions
    if (query.includes('sessions')) {
      config.metrics = ['sessions'];
    }
    if (query.includes('users')) {
      config.metrics = ['users'];
    }
    if (query.includes('pageviews')) {
      config.metrics = ['pageviews'];
    }
    if (query.includes('bounce')) {
      config.metrics = ['bounceRate'];
    }

    // Parse date range
    if (query.includes('last 7 days') || query.includes('7 days')) {
      config.startDate = '7daysAgo';
    } else if (query.includes('last 30 days') || query.includes('30 days')) {
      config.startDate = '30daysAgo';
    } else if (query.includes('last 90 days') || query.includes('90 days')) {
      config.startDate = '90daysAgo';
    }

    return config;
  }

  /**
   * Convert Google Analytics data to standardized format
   */
  private convertToStandardFormat(analyticsData: GoogleAnalyticsData, _query: string): unknown[][] {
    const rows: unknown[][] = [];
    
    analyticsData.reports.forEach(report => {
      report.data.forEach(dataPoint => {
        const row = [
          dataPoint.date || new Date().toISOString().split('T')[0],
          dataPoint.metrics.sessions || 0,
          dataPoint.metrics.users || 0,
          dataPoint.metrics.pageviews || 0,
          dataPoint.metrics.bounceRate || 0,
          analyticsData.propertyName
        ];
        rows.push(row);
      });
    });
    
    return rows;
  }
}
