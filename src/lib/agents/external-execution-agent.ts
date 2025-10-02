/**
 * External Execution Agent
 * 
 * Specialized agent for processing external data sources (Google Sheets, Google Docs, Web URLs, etc.)
 * Uses real datasource agents to fetch actual data from external APIs and services.
 * Prevents hallucination by focusing only on real external data retrieval.
 */

import { BaseAgent, AgentContext, AgentResponse, DatabaseExecutionResult } from './types';
import { supabaseServer as supabase } from '../server-utils';
import { getDataSourceAgent } from '../datasources';

export interface ExternalExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_connections: number;
  failed_connections: number;
  total_data_retrieved: number;
  external_processing_summary: {
    connections_processed: number;
    successful_api_calls: number;
    failed_api_calls: number;
    average_execution_time_ms: number;
    success_rate: number;
  };
}

export class ExternalExecutionAgent implements BaseAgent {
  name = 'External Execution Agent';
  description = 'Uses real datasource agents to fetch actual data from external APIs and services (Google Sheets, Google Docs, Web URLs, etc.)';

  async execute(context: AgentContext & { filteredSources: Record<string, unknown>[]; optimizedQuery: string }): Promise<AgentResponse<ExternalExecutionAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🌐 External Execution Agent: Starting external data retrieval...');
      
      const { filteredSources, optimizedQuery } = context;
      
      // Filter only external sources
      const externalSources = filteredSources.filter(source => source.type === 'external');
      
      if (externalSources.length === 0) {
        console.log('🌐 No external sources found, skipping external processing');
        return {
          success: true,
          data: {
            execution_results: [],
            total_execution_time_ms: Date.now() - startTime,
            successful_connections: 0,
            failed_connections: 0,
            total_data_retrieved: 0,
            external_processing_summary: {
              connections_processed: 0,
              successful_api_calls: 0,
              failed_api_calls: 0,
              average_execution_time_ms: 0,
              success_rate: 0
            }
          },
          metadata: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: 0,
            confidence_score: 1.0
          }
        };
      }
      
      const executionResults: DatabaseExecutionResult[] = [];
      let totalDataRetrieved = 0;
      let successfulConnections = 0;
      let failedConnections = 0;
      
      // Process each external source
      for (const externalSource of externalSources) {
        try {
          console.log(`🌐 Processing external connection: ${externalSource.name} (${externalSource.connection_type})`);
          
          const externalResult = await this.executeExternalConnection(externalSource, optimizedQuery);
          executionResults.push(externalResult);
          
          if (externalResult.success) {
            successfulConnections++;
            totalDataRetrieved += externalResult.row_count || 0;
          } else {
            failedConnections++;
          }
        } catch (error) {
          console.warn(`Failed to process external connection ${externalSource.id as string}:`, error);
          executionResults.push({
            source_id: externalSource.id as string,
            source_name: externalSource.name as string,
            source_type: externalSource.type as string,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: 0,
            row_count: 0,
            metadata: {
              tokens_used: 0,
              estimated_credits: 0,
              processing_strategy: 'external_connection_failed'
            }
          });
          failedConnections++;
        }
      }
      
      const totalExecutionTime = Date.now() - startTime;
      const averageExecutionTime = executionResults.length > 0 
        ? executionResults.reduce((sum, r) => sum + r.execution_time_ms, 0) / executionResults.length 
        : 0;
      
      const result: ExternalExecutionAgentResponse = {
        execution_results: executionResults,
        total_execution_time_ms: totalExecutionTime,
        successful_connections: successfulConnections,
        failed_connections: failedConnections,
        total_data_retrieved: totalDataRetrieved,
        external_processing_summary: {
          connections_processed: executionResults.length,
          successful_api_calls: successfulConnections,
          failed_api_calls: failedConnections,
          average_execution_time_ms: averageExecutionTime,
          success_rate: executionResults.length > 0 ? successfulConnections / executionResults.length : 0
        }
      };
      
      console.log('🌐 External Execution Result:', {
        connections_processed: executionResults.length,
        successful_connections: successfulConnections,
        failed_connections: failedConnections,
        total_data_retrieved: totalDataRetrieved,
        execution_time_ms: totalExecutionTime
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: totalExecutionTime,
          tokens_used: 0, // External execution doesn't use AI tokens directly
          confidence_score: result.external_processing_summary.success_rate
        }
      };
      
    } catch (error) {
      console.error('External Execution Agent error:', error);
      
      return {
        success: false,
        data: {
          execution_results: [],
          total_execution_time_ms: Date.now() - startTime,
          successful_connections: 0,
          failed_connections: 0,
          total_data_retrieved: 0,
          external_processing_summary: {
            connections_processed: 0,
            successful_api_calls: 0,
            failed_api_calls: 0,
            average_execution_time_ms: 0,
            success_rate: 0
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeExternalConnection(externalSource: Record<string, unknown>, optimizedQuery: string): Promise<DatabaseExecutionResult> {
    const sourceStartTime = Date.now();
    
    try {
      // Get external connection details
      const { data: externalConnection } = await supabase
        .from('external_connections')
        .select('*')
        .eq('id', externalSource.id)
        .single();
      
      if (!externalConnection) {
        throw new Error(`External connection not found for source: ${externalSource.id as string}`);
      }
      
      // Execute external API call based on connection type
      const externalData = await this.executeExternalAPICall(externalConnection, optimizedQuery);
      
      return {
        source_id: externalSource.id as string,
        source_name: externalSource.name as string,
        source_type: externalSource.type as string,
        success: true,
        data: externalData,
        query_executed: `External API: ${optimizedQuery}`,
        execution_time_ms: Date.now() - sourceStartTime,
        row_count: externalData.length,
        schema_info: {
          columns: this.extractColumnsFromRows(externalData),
          table_name: externalConnection.name,
          database_type: 'external'
        },
        metadata: {
          tokens_used: 0,
          estimated_credits: 0,
          processing_strategy: 'external_api'
        }
      };
    } catch (error) {
      return {
        source_id: externalSource.id as string,
        source_name: externalSource.name as string,
        source_type: externalSource.type as string,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - sourceStartTime,
        row_count: 0,
        metadata: {
          tokens_used: 0,
          estimated_credits: 0,
          processing_strategy: 'external_connection_failed'
        }
      };
    }
  }

  private async executeExternalAPICall(externalConnection: Record<string, unknown>, optimizedQuery: string): Promise<Record<string, unknown>[]> {
    try {
      console.log(`🌐 Executing external API call for ${externalConnection.type as string}...`);
      
      // Get the appropriate datasource agent
      const dataSourceAgent = getDataSourceAgent(externalConnection.type as string);
      
      if (!dataSourceAgent) {
        throw new Error(`No datasource agent found for type: ${externalConnection.type as string}`);
      }
      
      // Get the connection configuration
      const connectionConfig = {
        id: externalConnection.id as string,
        data_source_id: externalConnection.id as string,
        connection_string: externalConnection.connection_string as string,
        host: externalConnection.host as string,
        port: externalConnection.port as number,
        database_name: externalConnection.database_name as string,
        username: externalConnection.username as string,
        password: externalConnection.password as string,
        ssl_enabled: externalConnection.ssl_enabled as boolean,
        connection_timeout: externalConnection.connection_timeout as number,
        query_timeout: externalConnection.query_timeout as number,
        max_connections: externalConnection.max_connections as number,
        additional_config: externalConnection.additional_config as Record<string, unknown> || {}
      };
      
      // Execute the query using the datasource agent
      const queryResult = await dataSourceAgent.executeQuery(connectionConfig, optimizedQuery);
      
      // Convert rows array to objects for consistency with other agents
      const data = queryResult.rows.map((row: unknown[], index: number) => {
        const obj: Record<string, unknown> = { id: index + 1 };
        queryResult.columns.forEach((column: string, colIndex: number) => {
          obj[column] = row[colIndex];
        });
        return obj;
      });
      
      console.log(`✅ Successfully retrieved ${queryResult.row_count} rows from ${externalConnection.type}`);
      
      return data;
      
    } catch (error) {
      console.error(`Failed to execute external API call for ${externalConnection.type}:`, error);
      throw error;
    }
  }

  // Note: All external data fetching is now handled by the real datasource agents
  // through the executeExternalAPICall method above. This ensures we use the
  // actual Google Sheets, Google Docs, Web URL, and Google Analytics connectors
  // instead of mock data.

  private extractColumnsFromRows(rows: Record<string, unknown>[]): Array<{ name: string; type: string }> {
    if (!rows || rows.length === 0) return [];
    
    const firstRow = rows[0];
    return Object.keys(firstRow).map(key => ({
      name: key,
      type: typeof firstRow[key]
    }));
  }
}
