/**
 * Multi-Source Q&A Agent
 * 
 * Combines results from all data sources to provide comprehensive answers
 */

import { BaseAgent, AgentContext, AgentResponse, MultiSourceQAResponse, DatabaseExecutionResult } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export class MultiSourceQAAgent implements BaseAgent {
  name = 'Multi-Source Q&A Agent';
  description = 'Combines results from all data sources to provide comprehensive answers';

  async execute(context: AgentContext & { sourceResults: DatabaseExecutionResult[] }): Promise<AgentResponse<MultiSourceQAResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🤖 Multi-Source Q&A Agent: Combining results from all sources...');
      
      const { userQuery, conversationHistory, sourceResults } = context;
      
      // Check if we have any data
      const hasAnyData = sourceResults.some(result => result.success && result.data && result.data.length > 0);
      
      if (!hasAnyData) {
        throw new Error('All data sources returned empty results - no data available to answer the query');
      }
      
      // Analyze conversation context
      const isFollowUp = this.detectFollowUp(userQuery, conversationHistory);
      const isClarificationResponse = await this.detectClarificationResponse(userQuery, conversationHistory);
      
      console.log('🤖 Multi-Source Q&A Agent: Context analysis:', {
        is_follow_up: isFollowUp,
        is_clarification: isClarificationResponse
      });
      
      // Prepare source data for AI processing
      const sourceData = sourceResults.map((result, _index) => {
        const isDatabase = 'query_executed' in result;
        const baseData = {
          source_id: result.source_id,
          source_name: result.source_name,
          source_type: result.source_type,
          success: result.success,
          row_count: result.row_count,
          execution_time_ms: result.execution_time_ms
        };
        
        if (result.success && result.data) {
          return {
            ...baseData,
            data_preview: result.data.slice(0, 5), // First 5 rows
            total_rows: result.data.length,
            columns: result.schema_info?.columns || [],
            query_used: isDatabase ? result.query_executed : 'File processing',
            data_summary: this.summarizeData(result.data)
          };
        } else {
          return {
            ...baseData,
            error: 'error' in result ? result.error : undefined,
            data_preview: [],
            total_rows: 0,
            columns: [],
            query_used: 'Failed',
            data_summary: 'No data available'
          };
        }
      });
      
      // Get recent conversation context
      const recentConversation = conversationHistory
        .slice(-6)
        .map(msg => `${msg.sender_type}: ${msg.content}`)
        .join('\n');
      
      // Determine context hint based on analysis
      const contextHint = isClarificationResponse 
        ? "This is a clarification response - the user is providing additional context to a previous question. Use this new information to refine your answer."
        : isFollowUp
        ? "This is a follow-up question - build on the previous conversation context but focus on the new specific question asked. Do not repeat previous answers."
        : recentConversation ? 
        "Consider the conversation flow to understand the user's intent and provide a contextual answer. This is a CONTINUATION of an existing conversation about data analysis." : 
        "This is a new conversation - provide a direct answer based on the available data.";
      
      const qaPrompt = `You are a Q&A Agent. Answer the user's question using ONLY the provided data and conversation context.

User Query: "${userQuery}"

${recentConversation ? `Recent Conversation Context:\n${recentConversation}\n` : ''}
${contextHint}

IMPORTANT: ${isFollowUp ? 'This is a FOLLOW-UP question. Build on previous context but focus on the NEW question asked. Do not repeat previous answers.' : 'This is a NEW question. Provide a direct, comprehensive answer.'}

Available Data Sources:
${sourceData.map(source => `
Source: ${source.source_name} (${source.source_type})
Status: ${source.success ? 'Success' : 'Failed'}
Rows: ${source.total_rows}
${source.success ? `
Data Preview:
${JSON.stringify(source.data_preview, null, 2)}

Data Summary: ${source.data_summary}
Query Used: ${source.query_used}
` : `
Error: ${'error' in source ? source.error : 'Unknown error'}
`}
`).join('\n')}

Instructions:
1. Provide a comprehensive answer based on the available data
2. If multiple sources have data, synthesize insights across sources
3. Be specific and cite data when possible
4. If data is limited, acknowledge limitations
5. Provide actionable insights and recommendations
6. Suggest relevant follow-up questions

Respond with JSON:
{
  "answer": "Comprehensive answer to the user's question",
  "confidence": 0.0-1.0,
  "sources_used": ["source_ids_that_contributed"],
  "reasoning": "How you arrived at this answer",
  "follow_up_suggestions": ["Relevant follow-up questions"],
  "data_summary": {
    "total_records": 0,
    "sources_analyzed": 0,
    "key_insights": ["Key insights from the data"]
  }
}`;

      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a data analysis expert. Provide comprehensive answers based on available data. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: qaPrompt
        }
      ], {
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      
      const processingTime = Date.now() - startTime;
      const totalRecords = sourceResults.reduce((sum, r) => sum + (r.row_count || 0), 0);
      const sourcesAnalyzed = sourceResults.filter(r => r.success).length;
      
      const qaResponse: MultiSourceQAResponse = {
        answer: result.answer || 'Unable to provide a comprehensive answer',
        confidence: result.confidence || 0.7,
        sources_used: result.sources_used || sourceResults.filter(r => r.success).map(r => r.source_id),
        reasoning: result.reasoning || 'Analysis completed',
        follow_up_suggestions: result.follow_up_suggestions || [],
        data_summary: {
          total_records: totalRecords,
          sources_analyzed: sourcesAnalyzed,
          key_insights: result.data_summary?.key_insights || []
        },
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: response.tokens_used || 0,
          estimated_credits: 0 // Will be calculated by the main flow
        }
      };
      
      console.log('🤖 Multi-Source Q&A Result:', {
        answer_length: qaResponse.answer.length,
        confidence: qaResponse.confidence,
        sources_used: qaResponse.sources_used.length,
        total_records: qaResponse.data_summary.total_records
      });
      
      return {
        success: true,
        data: qaResponse,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: response.tokens_used || 0,
          confidence_score: qaResponse.confidence
        }
      };
      
    } catch (error) {
      console.error('Multi-Source Q&A Agent error:', error);
      
      return {
        success: false,
        data: {
          answer: 'I encountered an error while processing your request. Please try again or rephrase your question.',
          confidence: 0,
          sources_used: [],
          reasoning: 'Error occurred during processing',
          follow_up_suggestions: [],
          data_summary: {
            total_records: 0,
            sources_analyzed: 0,
            key_insights: []
          },
          metadata: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: 0,
            estimated_credits: 0
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private detectFollowUp(userQuery: string, conversationHistory: Array<{sender_type: string, content: string, created_at: string}>): boolean {
    if (conversationHistory.length === 0) return false;
    
    const followUpIndicators = [
      'also', 'and', 'what about', 'how about', 'show me',
      'trends', 'compare', 'top', 'bottom', 'more',
      'further', 'additionally', 'besides', 'other'
    ];
    
    const query = userQuery.toLowerCase();
    return followUpIndicators.some(indicator => query.includes(indicator));
  }

  private async detectClarificationResponse(userQuery: string, conversationHistory: Array<{sender_type: string, content: string, created_at: string}>): Promise<boolean> {
    if (conversationHistory.length === 0) return false;
    
    const clarificationIndicators = [
      'i mean', 'actually', 'specifically', 'more precisely',
      'to clarify', 'let me rephrase', 'what i meant'
    ];
    
    const query = userQuery.toLowerCase();
    return clarificationIndicators.some(indicator => query.includes(indicator));
  }

  private summarizeData(data: Record<string, unknown>[]): string {
    if (!data || data.length === 0) return 'No data';
    
    const sample = data.slice(0, 3);
    const columns = Object.keys(sample[0] || {});
    
    return `${data.length} records with columns: ${columns.join(', ')}`;
  }
}
