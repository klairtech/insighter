/**
 * Data Sources Index
 * 
 * Central registry for all data source implementations
 */

import { DataSourceAgent, DataSourceRegistry } from './types';
import { PostgreSQLDataSource } from './postgresql-datasource';
import { MySQLDataSource } from './mysql-datasource';
import { SQLiteDataSource } from './sqlite-datasource';
import { RedshiftDataSource } from './redshift-datasource';
import { ExcelDataSource } from './excel-datasource';
import { CSVDataSource } from './csv-datasource';
import { PDFDataSource } from './pdf-datasource';
import { WordDataSource } from './word-datasource';
import { PowerPointDataSource } from './powerpoint-datasource';
import { TextDataSource } from './text-datasource';
import { GoogleSheetsDataSource } from './google-sheets-datasource';
import { GoogleDocsDataSource } from './google-docs-datasource';
import { WebURLDataSource } from './web-url-datasource';
import { GoogleAnalyticsDataSource } from './google-analytics-datasource';
import { APIDataSource } from './api-datasource';

// Create data source registry
const dataSourceRegistry: DataSourceRegistry = {
  // Database sources
  'postgresql': new PostgreSQLDataSource(),
  'mysql': new MySQLDataSource(),
  'redshift': new RedshiftDataSource(),
  'sqlite': new SQLiteDataSource(),
  
  // File sources
  'excel': new ExcelDataSource(),
  'csv': new CSVDataSource(),
  'pdf': new PDFDataSource(),
  'word': new WordDataSource(),
  'powerpoint': new PowerPointDataSource(),
  'text': new TextDataSource(),
  
  // External sources
  'google-sheets': new GoogleSheetsDataSource(),
  'google-docs': new GoogleDocsDataSource(),
  'web-url': new WebURLDataSource(),
  'google-analytics': new GoogleAnalyticsDataSource(),
  'api': new APIDataSource()
};

/**
 * Get a data source agent by type
 */
export function getDataSourceAgent(type: string): DataSourceAgent | null {
  return dataSourceRegistry[type] || null;
}

/**
 * Get all available data source types
 */
export function getAvailableDataSourceTypes(): string[] {
  return Object.keys(dataSourceRegistry);
}

/**
 * Get data source capabilities by type
 */
export function getDataSourceCapabilities(type: string) {
  const agent = getDataSourceAgent(type);
  return agent ? agent.capabilities : null;
}

/**
 * Check if a data source type is supported
 */
export function isDataSourceTypeSupported(type: string): boolean {
  return type in dataSourceRegistry;
}

/**
 * Get all data source agents
 */
export function getAllDataSourceAgents(): DataSourceRegistry {
  return dataSourceRegistry;
}

// Export individual data source classes
export { PostgreSQLDataSource } from './postgresql-datasource';
export { MySQLDataSource } from './mysql-datasource';
export { SQLiteDataSource } from './sqlite-datasource';
export { RedshiftDataSource } from './redshift-datasource';
export { ExcelDataSource } from './excel-datasource';
export { CSVDataSource } from './csv-datasource';
export { PDFDataSource } from './pdf-datasource';
export { WordDataSource } from './word-datasource';
export { PowerPointDataSource } from './powerpoint-datasource';
export { TextDataSource } from './text-datasource';
export { GoogleSheetsDataSource } from './google-sheets-datasource';
export { GoogleDocsDataSource } from './google-docs-datasource';
export { WebURLDataSource } from './web-url-datasource';
export { GoogleAnalyticsDataSource } from './google-analytics-datasource';
export { APIDataSource } from './api-datasource';

// Export types
export * from './types';
