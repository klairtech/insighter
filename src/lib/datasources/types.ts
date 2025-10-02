/**
 * Data Source Types and Interfaces
 * 
 * Common interfaces for all data source implementations
 */

export interface BaseDataSource {
  id: string;
  name: string;
  type: DataSourceType;
  workspace_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  connection_config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type DataSourceType = 
  | 'postgresql'
  | 'mysql'
  | 'redshift'
  | 'sqlite'
  | 'excel'
  | 'csv'
  | 'pdf'
  | 'word'
  | 'powerpoint'
  | 'text'
  | 'google-sheets'
  | 'google-docs'
  | 'web-url'
  | 'google-analytics'
  | 'api';

export interface DataSourceConnection {
  id: string;
  data_source_id: string;
  connection_string?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_enabled?: boolean;
  connection_timeout?: number;
  query_timeout?: number;
  max_connections?: number;
  additional_config?: Record<string, unknown>;
}

export interface DataSourceSchema {
  tables: DataSourceTable[];
  views?: DataSourceTable[];
  functions?: DataSourceFunction[];
  procedures?: DataSourceProcedure[];
  metadata: {
    database_name: string;
    database_version: string;
    schema_version: string;
    last_updated: string;
    total_tables: number;
    total_columns: number;
  };
}

export interface DataSourceTable {
  name: string;
  type: 'table' | 'view' | 'materialized_view';
  schema_name?: string;
  columns: DataSourceColumn[];
  primary_keys: string[];
  foreign_keys: DataSourceForeignKey[];
  indexes: DataSourceIndex[];
  row_count?: number;
  size_bytes?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceColumn {
  name: string;
  type: string;
  nullable: boolean;
  default_value?: unknown;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_unique: boolean;
  is_indexed: boolean;
  max_length?: number;
  precision?: number;
  scale?: number;
  sample_values?: unknown[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceForeignKey {
  column_name: string;
  referenced_table: string;
  referenced_column: string;
  constraint_name?: string;
  on_delete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  on_update?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface DataSourceIndex {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceFunction {
  name: string;
  schema_name?: string;
  parameters: DataSourceParameter[];
  return_type: string;
  language?: string;
  definition?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceProcedure {
  name: string;
  schema_name?: string;
  parameters: DataSourceParameter[];
  language?: string;
  definition?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceParameter {
  name: string;
  type: string;
  direction: 'IN' | 'OUT' | 'INOUT';
  default_value?: unknown;
}

export interface DataSourceQueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  execution_time_ms: number;
  query: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceTestResult {
  success: boolean;
  connection_time_ms: number;
  query_time_ms: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSourceCapabilities {
  supports_sql: boolean;
  supports_transactions: boolean;
  supports_stored_procedures: boolean;
  supports_functions: boolean;
  supports_views: boolean;
  supports_indexes: boolean;
  supports_foreign_keys: boolean;
  max_query_size?: number;
  max_result_size?: number;
  supported_data_types: string[];
  supported_operations: string[];
}

export interface DataSourceAgent {
  name: string;
  description: string;
  type: DataSourceType;
  capabilities: DataSourceCapabilities;
  
  // Connection management
  testConnection(config: Record<string, unknown>): Promise<DataSourceTestResult>;
  connect(config: Record<string, unknown>): Promise<DataSourceConnection>;
  disconnect(connection: DataSourceConnection): Promise<void>;
  
  // Schema operations
  getSchema(connection: DataSourceConnection): Promise<DataSourceSchema>;
  getTableInfo(connection: DataSourceConnection, tableName: string): Promise<DataSourceTable>;
  getColumnInfo(connection: DataSourceConnection, tableName: string, columnName: string): Promise<DataSourceColumn>;
  
  // Query operations
  executeQuery(connection: DataSourceConnection, query: string, params?: unknown[]): Promise<DataSourceQueryResult>;
  executeQueryWithLimit(connection: DataSourceConnection, query: string, limit: number, params?: unknown[]): Promise<DataSourceQueryResult>;
  
  // Data operations
  getSampleData(connection: DataSourceConnection, tableName: string, limit?: number): Promise<DataSourceQueryResult>;
  getTableRowCount(connection: DataSourceConnection, tableName: string): Promise<number>;
  
  // Metadata operations
  getDatabaseInfo(connection: DataSourceConnection): Promise<Record<string, unknown>>;
  getTableList(connection: DataSourceConnection): Promise<string[]>;
  getColumnList(connection: DataSourceConnection, tableName: string): Promise<string[]>;
  
  // Utility operations
  validateQuery(query: string): Promise<{ valid: boolean; error?: string }>;
  formatQuery(query: string): Promise<string>;
  getQueryPlan(connection: DataSourceConnection, query: string): Promise<string>;
}

export interface FileDataSourceConfig {
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  encoding?: string;
  delimiter?: string; // For CSV files
  has_header?: boolean; // For CSV files
  sheet_name?: string; // For Excel files
  page_range?: string; // For PDF files
  metadata?: Record<string, unknown>;
}

export interface DatabaseDataSourceConfig {
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl_enabled?: boolean;
  connection_timeout?: number;
  query_timeout?: number;
  max_connections?: number;
  schema_name?: string;
  additional_config?: Record<string, unknown>;
}

export interface ExternalDataSourceConfig {
  api_url?: string;
  api_key?: string;
  oauth_token?: string;
  refresh_token?: string;
  webhook_url?: string;
  rate_limit?: number;
  timeout?: number;
  retry_attempts?: number;
  additional_config?: Record<string, unknown>;
}

export interface DataSourceRegistry {
  [key: string]: DataSourceAgent;
}

// Export all types
export * from './types';
