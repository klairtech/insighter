export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_table?: string;
  foreign_column?: string;
  sample_values?: string[];
  description?: string;
  ai_definition?: {
    description: string;
    business_purpose: string;
    data_insights: string[];
    common_queries: string[];
    relationships: string[];
    data_quality_notes: string[];
  };
}

export interface DatabaseTable {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  columns: DatabaseColumn[];
  row_count?: number;
  description?: string;
  ai_definition?: {
    description: string;
    business_purpose: string;
    key_entities: string[];
    common_use_cases: string[];
    data_relationships: string[];
    column_summary: string;
    primary_key_analysis: string;
    foreign_key_relationships: string[];
  };
}

// Updated to include ai_definition for unified structure - force TypeScript recompile
export interface DatabaseSchema {
  database_name: string;
  database_type: string;
  tables: DatabaseTable[];
  views: DatabaseTable[];
  total_tables: number;
  total_views: number;
  ai_definition?: {
    description: string;
    business_purpose: string;
    key_entities: string[];
    common_use_cases: string[];
    data_relationships: string[];
    table_summary: string;
    overall_architecture: string;
    data_flow_analysis: string;
  };
}

export interface DatabaseConnectionConfig {
  type: string;
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionString?: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password_encrypted: string;
  workspace_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  schema_name?: string;
  schema_info_encrypted?: string;
  selected_tables_encrypted?: string;
}

export interface SelectedTable {
  table_name: string;
  schema_name?: string;
  selected_columns: string[];
  include_sample_data: boolean;
  sample_size: number;
}

export interface DatabaseSchemaInfo {
  connection_id: string;
  schema: DatabaseSchema;
  selected_tables: SelectedTable[];
  last_updated: string;
}
