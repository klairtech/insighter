/**
 * Agent Utilities
 * 
 * Common utilities and helper functions for all agents to eliminate code duplication
 */

import { AgentResponse, AgentContext } from './types';

export class AgentUtils {
  /**
   * Create a standardized success response
   */
  static createSuccessResponse<T>(
    data: T,
    startTime: number,
    tokensUsed: number = 0,
    confidence: number = 1.0,
    additionalMetadata: Record<string, any> = {}
  ): AgentResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        tokens_used: tokensUsed,
        confidence_score: confidence,
        ...additionalMetadata
      }
    };
  }

  /**
   * Create a standardized error response with fallback data
   */
  static createErrorResponse<T>(
    error: Error | string,
    startTime: number,
    fallbackData: T,
    tokensUsed: number = 0,
    confidence: number = 0.0,
    agentName: string = 'Agent'
  ): AgentResponse<T> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`${agentName} error:`, errorMessage);
    
    return {
      success: false,
      data: fallbackData,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        tokens_used: tokensUsed,
        confidence_score: confidence
      },
      error: errorMessage
    };
  }

  /**
   * Create a fallback response for when agent processing fails
   */
  static createFallbackResponse<T>(
    fallbackData: T,
    startTime: number,
    agentName: string,
    reason: string = 'Processing failed, using fallback'
  ): AgentResponse<T> {
    console.warn(`${agentName}: ${reason}`);
    
    return {
      success: true,
      data: fallbackData,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        tokens_used: 0,
        confidence_score: 0.5
      }
    };
  }

  /**
   * Extract recent conversation context
   */
  static getRecentConversationContext(
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    limit: number = 3
  ): string {
    return conversationHistory
      .slice(-limit)
      .map(msg => `${msg.sender_type}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Check if query is a follow-up question
   */
  static isFollowUpQuery(
    userQuery: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
  ): boolean {
    if (conversationHistory.length === 0) return false;
    
    const followUpIndicators = [
      'what about', 'how about', 'also', 'additionally', 'furthermore',
      'can you also', 'what else', 'show me more', 'tell me more',
      'what if', 'how would', 'compare', 'versus', 'vs'
    ];
    
    const lowerQuery = userQuery.toLowerCase();
    return followUpIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  /**
   * Generate follow-up suggestions based on query type
   */
  static generateFollowUpSuggestions(queryType: string, _dataSummary?: any): string[] {
    const suggestions: Record<string, string[]> = {
      'data_query': [
        'Show me more detailed breakdown',
        'Compare with previous period',
        'What are the trends?',
        'Can you create a visualization?'
      ],
      'analytical': [
        'What are the key insights?',
        'Show me the underlying data',
        'What factors contribute to this?',
        'How can we improve this?'
      ],
      'comparative': [
        'Show me the differences',
        'What are the similarities?',
        'Which performs better?',
        'What are the implications?'
      ],
      'temporal': [
        'Show me the trend over time',
        'What caused the changes?',
        'Predict future performance',
        'Compare different time periods'
      ]
    };

    return suggestions[queryType] || suggestions['data_query'];
  }

  /**
   * Calculate confidence score based on multiple factors
   */
  static calculateConfidenceScore(
    factors: {
      dataQuality?: number;
      sourceReliability?: number;
      queryClarity?: number;
      processingSuccess?: boolean;
    }
  ): number {
    const { dataQuality = 1.0, sourceReliability = 1.0, queryClarity = 1.0, processingSuccess = true } = factors;
    
    if (!processingSuccess) return 0.3;
    
    const baseScore = (dataQuality + sourceReliability + queryClarity) / 3;
    return Math.min(Math.max(baseScore, 0.1), 1.0);
  }

  /**
   * Format processing time for logging
   */
  static formatProcessingTime(processingTimeMs: number): string {
    if (processingTimeMs < 1000) {
      return `${processingTimeMs}ms`;
    } else if (processingTimeMs < 60000) {
      return `${(processingTimeMs / 1000).toFixed(1)}s`;
    } else {
      return `${(processingTimeMs / 60000).toFixed(1)}m`;
    }
  }

  /**
   * Log agent execution summary
   */
  static logExecutionSummary(
    agentName: string,
    result: {
      success: boolean;
      confidence: number;
      processingTime: number;
      tokensUsed: number;
    }
  ): void {
    const status = result.success ? '✅' : '❌';
    const time = this.formatProcessingTime(result.processingTime);
    
    console.log(`${status} ${agentName} Summary:`, {
      success: result.success,
      confidence: result.confidence.toFixed(2),
      processing_time: time,
      tokens_used: result.tokensUsed
    });
  }

  /**
   * Validate agent context
   */
  static validateContext(context: AgentContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!context.userQuery || context.userQuery.trim().length === 0) {
      errors.push('User query is required');
    }
    
    if (!context.workspaceId || context.workspaceId.trim().length === 0) {
      errors.push('Workspace ID is required');
    }
    
    if (!Array.isArray(context.conversationHistory)) {
      errors.push('Conversation history must be an array');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create default fallback data for common agent types
   */
  static getDefaultFallbackData(agentType: string): any {
    const fallbacks: Record<string, any> = {
      'ValidationAgent': {
        is_valid: true,
        query_type: 'data_query',
        confidence: 0.5,
        intent_analysis: {
          primary_intent: 'Data analysis',
          secondary_intents: [],
          entities: [],
          time_references: [],
          data_requirements: []
        },
        requires_follow_up: false,
        reasoning: 'Validation failed, defaulting to data query'
      },
      'GuardrailsAgent': {
        allowed: true,
        reason: 'Guardrails analysis failed - allowing with caution',
        confidence: 0.3,
        risk_level: 'high',
        suggested_alternatives: []
      },
      'PromptEngineeringAgent': {
        optimized_query: '',
        query_type: 'analytical',
        intent_analysis: {
          primary_intent: 'Data analysis',
          secondary_intents: [],
          entities: [],
          time_references: [],
          data_requirements: []
        },
        optimization_notes: 'Fallback processing due to error',
        confidence: 0.5
      },
      'MultiSourceQAAgent': {
        answer: 'I encountered an error while processing your request. Please try again or rephrase your question.',
        confidence: 0,
        sources_used: [],
        reasoning: 'Error occurred during processing',
        follow_up_suggestions: [],
        data_summary: {
          total_records: 0,
          sources_analyzed: 0,
          key_insights: []
        }
      }
    };

    return fallbacks[agentType] || {};
  }

  /**
   * Create standardized logging prefix
   */
  static createLogPrefix(agentName: string, action: string): string {
    return `${agentName}: ${action}`;
  }

  /**
   * Safe JSON parsing with fallback
   */
  static safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON, using fallback:', error);
      return fallback;
    }
  }

  /**
   * Truncate text for logging
   */
  static truncateForLogging(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
