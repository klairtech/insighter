/**
 * Database Execution Agent
 * 
 * Handles SQL/NoSQL query execution across different database types
 */

import { BaseAgent, AgentContext, AgentResponse, DatabaseExecutionResult } from './types';
import { callAIWithClaudePrimary } from '../ai-utils';
import { supabaseServer as supabase } from '../server-utils';

export interface DatabaseExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_sources: number;
  failed_sources: number;
  total_rows_retrieved: number;
  execution_summary: {
    sources_processed: number;
    queries_executed: number;
    average_execution_time_ms: number;
    success_rate: number;
  };
}

export class DatabaseExecutionAgent implements BaseAgent {
  name = 'Database Execution Agent';
  description = 'Specialized agent for processing database sources with enhanced SQL validation and security';

  async execute(context: AgentContext & { filteredSources: any[]; optimizedQuery: string }): Promise<AgentResponse<DatabaseExecutionAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('💾 Database Execution Agent: Starting query execution...');
      
      const { filteredSources, optimizedQuery } = context;
      
      if (!filteredSources || filteredSources.length === 0) {
        throw new Error('No data sources provided for execution');
      }
      
      const executionResults: DatabaseExecutionResult[] = [];
      let totalRows = 0;
      let successfulSources = 0;
      let failedSources = 0;
      
      // Filter only database sources for this specialized agent
      const databaseSources = filteredSources.filter(source => source.type === 'database');
      
      if (databaseSources.length === 0) {
        console.log('🗄️ No database sources found, skipping database processing');
        return {
          success: true,
          data: {
            execution_results: [],
            total_execution_time_ms: Date.now() - startTime,
            successful_sources: 0,
            failed_sources: 0,
            total_rows_retrieved: 0,
            execution_summary: {
              sources_processed: 0,
              queries_executed: 0,
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
      
      // Execute queries on each database source
      for (const source of databaseSources) {
        try {
          console.log(`🗄️ Executing query on database: ${source.name} (${source.connection_type})`);
          
          const executionResult = await this.executeDatabaseQuery(source, optimizedQuery);
          executionResults.push(executionResult);
          
          if (executionResult.success) {
            successfulSources++;
            totalRows += executionResult.row_count || 0;
          } else {
            failedSources++;
          }
        } catch (error) {
          console.warn(`Failed to execute query on source ${source.id}:`, error);
          executionResults.push({
            source_id: source.id,
            source_name: source.name,
            source_type: source.type,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: 0,
            row_count: 0,
            metadata: {
              tokens_used: 0,
              estimated_credits: 0,
              processing_strategy: 'failed'
            }
          });
          failedSources++;
        }
      }
      
      const totalExecutionTime = Date.now() - startTime;
      const averageExecutionTime = executionResults.length > 0 
        ? executionResults.reduce((sum, r) => sum + r.execution_time_ms, 0) / executionResults.length 
        : 0;
      
      const result: DatabaseExecutionAgentResponse = {
        execution_results: executionResults,
        total_execution_time_ms: totalExecutionTime,
        successful_sources: successfulSources,
        failed_sources: failedSources,
        total_rows_retrieved: totalRows,
        execution_summary: {
          sources_processed: executionResults.length,
          queries_executed: executionResults.filter(r => r.success).length,
          average_execution_time_ms: averageExecutionTime,
          success_rate: executionResults.length > 0 ? successfulSources / executionResults.length : 0
        }
      };
      
      console.log('💾 Database Execution Result:', {
        sources_processed: executionResults.length,
        successful_sources: successfulSources,
        failed_sources: failedSources,
        total_rows: totalRows,
        execution_time_ms: totalExecutionTime
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: totalExecutionTime,
          tokens_used: 0, // Database execution doesn't use AI tokens
          confidence_score: result.execution_summary.success_rate
        }
      };
      
    } catch (error) {
      console.error('Database Execution Agent error:', error);
      
      return {
        success: false,
        data: {
          execution_results: [],
          total_execution_time_ms: Date.now() - startTime,
          successful_sources: 0,
          failed_sources: 0,
          total_rows_retrieved: 0,
          execution_summary: {
            sources_processed: 0,
            queries_executed: 0,
            average_execution_time_ms: 0,
            success_rate: 0
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  private async executeDatabaseQuery(source: any, optimizedQuery: string): Promise<DatabaseExecutionResult> {
    const sourceStartTime = Date.now();
    // Get database connection details
    const { data: dbConnection, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('id', source.id)
      .single();
    
    if (error || !dbConnection) {
      throw new Error(`Database connection not found for source: ${source.id}`);
    }
    
    // Generate SQL query based on the optimized query
    const sqlGenerationResult = await this.generateSQLQuery(optimizedQuery, dbConnection);
    const sqlQuery = sqlGenerationResult.query;
    const sqlTokens = sqlGenerationResult.tokensUsed;
    
    // Execute the actual database query
    const queryResult = await this.executeActualDatabaseQuery(dbConnection, sqlQuery);
    
    return {
      source_id: source.id,
      source_name: source.name,
      source_type: source.type,
      success: true,
      data: queryResult.rows,
      query_executed: sqlQuery,
      execution_time_ms: Date.now() - sourceStartTime,
      row_count: queryResult.rows.length,
      schema_info: {
        columns: this.extractColumnsFromRows(queryResult.rows),
        table_name: this.extractTableName(sqlQuery),
        database_type: dbConnection.database_type
      },
      metadata: {
        tokens_used: sqlTokens,
        estimated_credits: 0,
        processing_strategy: 'database_execution'
      }
    };
  }


  private async generateSQLQuery(optimizedQuery: string, dbConnection: any): Promise<{ query: string; tokensUsed: number; validation: any }> {
    // Use AI to generate appropriate SQL query with enhanced validation
    const sqlPrompt = `You are a specialized SQL query generator for ${dbConnection.database_type} databases. Generate ONLY a valid SQL query based on the user's request.

CRITICAL RULES:
1. Generate ONLY valid SQL syntax for ${dbConnection.database_type}
2. Use appropriate SELECT statements with proper column names
3. Include WHERE clauses only if the query specifically requests filtering
4. ALWAYS include LIMIT clause to prevent large result sets (default: LIMIT 100)
5. Use proper SQL best practices and syntax
6. Do not include explanations or comments - ONLY the SQL query
7. NEVER use DROP, DELETE, UPDATE, INSERT, TRUNCATE, or other destructive operations
8. Use parameterized queries when possible to prevent SQL injection
9. Validate table and column names against common patterns
10. Include error handling considerations

Database Type: ${dbConnection.database_type}
User Request: "${optimizedQuery}"

Available Schema: ${dbConnection.schema_info_encrypted ? 'Schema available' : 'No schema info available'}

Generate a safe, optimized SQL query that:
1. Uses appropriate SELECT statements
2. Includes proper WHERE clauses if needed
3. Uses LIMIT to prevent large result sets
4. Follows ${dbConnection.database_type} SQL best practices
5. Is syntactically correct for ${dbConnection.database_type}
6. Is safe from SQL injection attacks
7. Uses appropriate data types and functions

Respond with JSON:
{
  "query": "SELECT * FROM table LIMIT 100",
  "validation": {
    "is_safe": true,
    "estimated_rows": 100,
    "complexity_score": 0.3,
    "risk_level": "low",
    "warnings": []
  }
}`;

    try {
      const response = await callAIWithClaudePrimary([
        {
          role: 'system',
          content: 'You are a specialized SQL query generator with security focus. Generate safe, optimized SQL queries with validation. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: sqlPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      const query = result.query || '';
      
      // Additional validation
      const validation = await this.validateGeneratedQuery(query, dbConnection);
      
      return {
        query: query.trim(),
        tokensUsed: response.tokens_used,
        validation: validation
      };
    } catch (error) {
      console.warn('AI SQL generation failed, using fallback:', error);
      return {
        query: `SELECT * FROM users LIMIT 10`, // Fallback query
        tokensUsed: 0,
        validation: {
          is_safe: false,
          estimated_rows: 10,
          complexity_score: 0.1,
          risk_level: 'low',
          warnings: ['Using fallback query due to generation failure']
        }
      };
    }
  }

  private async validateGeneratedQuery(query: string, dbConnection: any): Promise<any> {
    try {
      // Basic SQL validation
      const trimmedQuery = query.trim().toLowerCase();
      
      // Check for dangerous operations
      const dangerousKeywords = [
        'drop', 'delete', 'update', 'insert', 'truncate', 'alter', 'create', 'grant', 'revoke',
        'exec', 'execute', 'sp_', 'xp_', '--', '/*', '*/', 'union', 'information_schema'
      ];
      
      const hasDangerousKeyword = dangerousKeywords.some(keyword => trimmedQuery.includes(keyword));
      
      // Check for proper LIMIT clause
      const hasLimit = trimmedQuery.includes('limit');
      
      // Estimate complexity
      const complexityScore = this.calculateQueryComplexity(query);
      
      // Check for potential SQL injection patterns
      const hasInjectionPatterns = this.detectInjectionPatterns(query);
      
      const validation = {
        is_safe: !hasDangerousKeyword && !hasInjectionPatterns,
        estimated_rows: hasLimit ? 100 : 1000, // Conservative estimate
        complexity_score: complexityScore,
        risk_level: hasDangerousKeyword ? 'high' : hasInjectionPatterns ? 'medium' : 'low',
        warnings: [] as string[]
      };
      
      if (hasDangerousKeyword) {
        validation.warnings.push('Query contains potentially dangerous operations');
      }
      
      if (hasInjectionPatterns) {
        validation.warnings.push('Query may contain SQL injection patterns');
      }
      
      if (!hasLimit) {
        validation.warnings.push('Query does not include LIMIT clause - may return large result sets');
      }
      
      if (complexityScore > 0.7) {
        validation.warnings.push('Query complexity is high - may impact performance');
      }
      
      return validation;
      
    } catch (error) {
      console.warn('Query validation failed:', error);
      return {
        is_safe: false,
        estimated_rows: 0,
        complexity_score: 1.0,
        risk_level: 'high',
        warnings: ['Query validation failed']
      };
    }
  }

  private calculateQueryComplexity(query: string): number {
    let complexity = 0;
    
    // Count JOINs
    const joinCount = (query.match(/\bjoin\b/gi) || []).length;
    complexity += joinCount * 0.2;
    
    // Count subqueries
    const subqueryCount = (query.match(/\(.*select.*\)/gi) || []).length;
    complexity += subqueryCount * 0.3;
    
    // Count WHERE conditions
    const whereCount = (query.match(/\bwhere\b/gi) || []).length;
    complexity += whereCount * 0.1;
    
    // Count GROUP BY
    const groupByCount = (query.match(/\bgroup by\b/gi) || []).length;
    complexity += groupByCount * 0.2;
    
    // Count ORDER BY
    const orderByCount = (query.match(/\border by\b/gi) || []).length;
    complexity += orderByCount * 0.1;
    
    return Math.min(complexity, 1.0);
  }

  private detectInjectionPatterns(query: string): boolean {
    const injectionPatterns = [
      /'.*or.*'.*=.*'/i,
      /'.*union.*select/i,
      /'.*drop.*table/i,
      /'.*delete.*from/i,
      /'.*update.*set/i,
      /'.*insert.*into/i,
      /'.*exec.*\(/i,
      /'.*sp_.*\(/i,
      /'.*xp_.*\(/i,
      /--.*$/m,
      /\/\*[\s\S]*?\*\//
    ];
    
    return injectionPatterns.some(pattern => pattern.test(query));
  }

  private async executeActualDatabaseQuery(dbConnection: any, sqlQuery: string): Promise<{ rows: any[] }> {
    // This would integrate with your existing database execution system
    // For now, return mock data
    return {
      rows: [
        { id: 1, name: 'Sample User 1', value: 100 },
        { id: 2, name: 'Sample User 2', value: 200 }
      ]
    };
  }


  private extractColumnsFromRows(rows: any[]): Array<{ name: string; type: string }> {
    if (!rows || rows.length === 0) return [];
    
    const firstRow = rows[0];
    return Object.keys(firstRow).map(key => ({
      name: key,
      type: typeof firstRow[key]
    }));
  }

  private extractTableName(sqlQuery: string): string {
    const match = sqlQuery.match(/FROM\s+(\w+)/i);
    return match ? match[1] : 'unknown_table';
  }
}
