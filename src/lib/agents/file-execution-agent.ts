/**
 * File Execution Agent
 * 
 * Specialized agent for processing file-based data sources (PDF, Word, Excel, etc.)
 * Prevents hallucination by focusing only on file content extraction
 */

import { BaseAgent, AgentContext, AgentResponse, DatabaseExecutionResult } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { supabaseServer as supabase } from '../server-utils';

export interface FileExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_files: number;
  failed_files: number;
  total_data_extracted: number;
  file_processing_summary: {
    files_processed: number;
    successful_extractions: number;
    failed_extractions: number;
    average_extraction_time_ms: number;
    success_rate: number;
  };
}

export class FileExecutionAgent implements BaseAgent {
  name = 'File Execution Agent';
  description = 'Specialized agent for processing file-based data sources (PDF, Word, Excel, etc.)';

  async execute(context: AgentContext & { filteredSources: Record<string, unknown>[]; optimizedQuery: string }): Promise<AgentResponse<FileExecutionAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('📁 File Execution Agent: Starting file processing...');
      
      const { filteredSources, optimizedQuery } = context;
      
      // Filter only file sources
      const fileSources = filteredSources.filter(source => source.type === 'file');
      
      if (fileSources.length === 0) {
        console.log('📁 No file sources found, skipping file processing');
        return {
          success: true,
          data: {
            execution_results: [],
            total_execution_time_ms: Date.now() - startTime,
            successful_files: 0,
            failed_files: 0,
            total_data_extracted: 0,
            file_processing_summary: {
              files_processed: 0,
              successful_extractions: 0,
              failed_extractions: 0,
              average_extraction_time_ms: 0,
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
      let totalDataExtracted = 0;
      let successfulFiles = 0;
      let failedFiles = 0;
      
      // Process each file source
      for (const fileSource of fileSources) {
        try {
          console.log(`📁 Processing file: ${fileSource.name as string} (${fileSource.connection_type})`);
          
          const fileResult = await this.processFileSource(fileSource, optimizedQuery);
          executionResults.push(fileResult);
          
          if (fileResult.success) {
            successfulFiles++;
            totalDataExtracted += fileResult.row_count || 0;
          } else {
            failedFiles++;
          }
        } catch (error) {
          console.warn(`Failed to process file ${fileSource.id as string}:`, error);
          executionResults.push({
            source_id: fileSource.id as string,
            source_name: fileSource.name as string,
            source_type: fileSource.type as string,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: 0,
            row_count: 0,
            metadata: {
              tokens_used: 0,
              estimated_credits: 0,
              processing_strategy: 'file_processing_failed'
            }
          });
          failedFiles++;
        }
      }
      
      const totalExecutionTime = Date.now() - startTime;
      const averageExtractionTime = executionResults.length > 0 
        ? executionResults.reduce((sum, r) => sum + r.execution_time_ms, 0) / executionResults.length 
        : 0;
      
      const result: FileExecutionAgentResponse = {
        execution_results: executionResults,
        total_execution_time_ms: totalExecutionTime,
        successful_files: successfulFiles,
        failed_files: failedFiles,
        total_data_extracted: totalDataExtracted,
        file_processing_summary: {
          files_processed: executionResults.length,
          successful_extractions: successfulFiles,
          failed_extractions: failedFiles,
          average_extraction_time_ms: averageExtractionTime,
          success_rate: executionResults.length > 0 ? successfulFiles / executionResults.length : 0
        }
      };
      
      console.log('📁 File Execution Result:', {
        files_processed: executionResults.length,
        successful_files: successfulFiles,
        failed_files: failedFiles,
        total_data_extracted: totalDataExtracted,
        execution_time_ms: totalExecutionTime
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: totalExecutionTime,
          tokens_used: 0, // File processing tokens will be tracked separately
          confidence_score: result.file_processing_summary.success_rate
        }
      };
      
    } catch (error) {
      console.error('File Execution Agent error:', error);
      
      return {
        success: false,
        data: {
          execution_results: [],
          total_execution_time_ms: Date.now() - startTime,
          successful_files: 0,
          failed_files: 0,
          total_data_extracted: 0,
          file_processing_summary: {
            files_processed: 0,
            successful_extractions: 0,
            failed_extractions: 0,
            average_extraction_time_ms: 0,
            success_rate: 0
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async processFileSource(fileSource: Record<string, unknown>, optimizedQuery: string): Promise<DatabaseExecutionResult> {
    const sourceStartTime = Date.now();
    
    try {
      // Get file upload details
      const { data: fileUpload } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('id', fileSource.id as string)
        .single();
      
      if (!fileUpload) {
        throw new Error(`File upload not found for source: ${fileSource.id as string}`);
      }
      
      // Get file summary
      const { data: fileSummary } = await supabase
        .from('file_summaries')
        .select('*')
        .eq('file_id', fileSource.id as string)
        .single();
      
      if (!fileSummary) {
        throw new Error(`File summary not found for source: ${fileSource.id as string}`);
      }
      
      // Extract data based on file type
      const extractionResult = await this.extractDataFromFile(fileUpload, fileSummary, optimizedQuery);
      const extractedData = extractionResult.data;
      const extractionTokens = extractionResult.tokensUsed;
      
      return {
        source_id: fileSource.id as string,
        source_name: fileSource.name as string,
        source_type: fileSource.type as string,
        success: true,
        data: extractedData,
        query_executed: `File analysis: ${optimizedQuery}`,
        execution_time_ms: Date.now() - sourceStartTime,
        row_count: extractedData.length,
        schema_info: {
          columns: this.extractColumnsFromRows(extractedData),
          table_name: fileUpload.original_filename,
          database_type: 'file'
        },
        metadata: {
          tokens_used: extractionTokens,
          estimated_credits: 0,
          processing_strategy: 'file_analysis'
        }
      };
    } catch (error) {
      return {
        source_id: fileSource.id as string,
        source_name: fileSource.name as string,
        source_type: fileSource.type as string,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - sourceStartTime,
        row_count: 0,
        metadata: {
          tokens_used: 0,
          estimated_credits: 0,
          processing_strategy: 'file_processing_failed'
        }
      };
    }
  }

  private async extractDataFromFile(fileUpload: Record<string, unknown>, fileSummary: Record<string, unknown>, optimizedQuery: string): Promise<{ data: Record<string, unknown>[]; tokensUsed: number }> {
    // Use AI to extract relevant data from file content
    const extractionPrompt = `You are a specialized file data extraction expert. Extract ONLY the data that directly answers the user's query from the file content.

CRITICAL RULES:
1. Extract ONLY factual data from the file - NO hallucination or made-up data
2. If the file doesn't contain the requested information, return an empty array
3. Base your extraction ONLY on the file summary and content provided
4. Do not infer or assume data that isn't explicitly in the file

FILE DETAILS:
- File Name: ${fileUpload.original_filename}
- File Type: ${fileUpload.file_type}
- File Summary: ${fileSummary.summary}
- Key Points: ${fileSummary.key_points ? JSON.stringify(fileSummary.key_points) : 'None'}
- Tags: ${fileSummary.tags ? JSON.stringify(fileSummary.tags) : 'None'}

USER QUERY: "${optimizedQuery}"

Extract data that directly answers the user's question. Use the file summary, key points, and tags to understand what information is available in the file. Return as JSON array of objects.

If the file contains the requested data, respond with JSON array:
[
  {"field1": "actual_value_from_file", "field2": "actual_value_from_file"},
  {"field1": "actual_value_from_file", "field2": "actual_value_from_file"}
]

If the file does NOT contain the requested data, respond with:
[]`;

    try {
      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a file data extraction expert. Extract ONLY factual data from files based on the provided summary, key points, and tags. For document-based queries (like "feedback points", "findings", "summary", "report"), use the available information to provide relevant data. Do not hallucinate or make up data. If the file contains relevant information, extract it as structured data. Even if the file has formatting issues or malformed data, work with what is available and extract the best possible information. Respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: extractionPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 1000
      });

      const extractedData = JSON.parse(response.content);
      
      // Validate that we got an array
      if (!Array.isArray(extractedData)) {
        console.warn('AI returned non-array data, returning empty array');
        return {
          data: [],
          tokensUsed: response.tokens_used
        };
      }
      
      return {
        data: extractedData,
        tokensUsed: response.tokens_used
      };
    } catch (error) {
      console.warn('AI file data extraction failed, returning empty array:', error);
      return {
        data: [], // Return empty array instead of fallback data to prevent hallucination
        tokensUsed: 0
      };
    }
  }

  private extractColumnsFromRows(rows: Record<string, unknown>[]): Array<{ name: string; type: string }> {
    if (!rows || rows.length === 0) return [];
    
    const firstRow = rows[0];
    return Object.keys(firstRow).map(key => ({
      name: key,
      type: typeof firstRow[key]
    }));
  }
}
