/**
 * Base Agent Class with Token Tracking
 * 
 * Provides common functionality for all agents including token tracking,
 * error handling, and consistent response formatting.
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary, AIResponse } from '../ai-utils';

export abstract class BaseAgentWithTokenTracking implements BaseAgent {
  abstract name: string;
  abstract description: string;
  
  protected currentTokensUsed: number = 0;
  protected startTime: number = 0;

  abstract execute(context: AgentContext): Promise<AgentResponse<unknown>>;

  /**
   * Call AI with automatic token tracking
   */
  protected async callAI(
    messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
    options: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: 'json_object' };
    } = {}
  ): Promise<AIResponse> {
    try {
      const response = await callAIWithOpenAIPrimary(messages, options);
      this.trackTokens(response.tokens_used);
      return response;
    } catch (error) {
      console.error(`AI call failed in ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Track tokens used by this agent
   */
  protected trackTokens(tokens: number): void {
    this.currentTokensUsed += tokens;
    if (tokens === 0) {
      console.warn(`⚠️ ${this.name}: Received 0 tokens - this may indicate a tracking issue`);
    }
  }

  /**
   * Get current token count for this agent
   */
  protected getTokensUsed(): number {
    return this.currentTokensUsed;
  }

  /**
   * Reset token tracking for this agent
   */
  protected resetTokenTracking(): void {
    this.currentTokensUsed = 0;
  }

  /**
   * Start timing for this agent
   */
  protected startTiming(): void {
    this.startTime = Date.now();
  }

  /**
   * Get processing time for this agent
   */
  protected getProcessingTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Create a standardized success response
   */
  protected createSuccessResponse<T>(
    data: T,
    confidence: number = 1.0,
    additionalMetadata: Record<string, unknown> = {}
  ): AgentResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        processing_time_ms: this.getProcessingTime(),
        tokens_used: this.getTokensUsed(),
        confidence_score: confidence,
        ...additionalMetadata
      }
    };
  }

  /**
   * Create a standardized error response
   */
  protected createErrorResponse<T>(
    error: Error | string,
    fallbackData?: T,
    confidence: number = 0.0
  ): AgentResponse<T> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`${this.name} error:`, errorMessage);
    
    return {
      success: false,
      data: fallbackData as T,
      metadata: {
        processing_time_ms: this.getProcessingTime(),
        tokens_used: this.getTokensUsed(),
        confidence_score: confidence
      },
      error: errorMessage
    };
  }

  /**
   * Execute agent with automatic timing and token tracking
   */
  async executeWithTracking(context: AgentContext): Promise<AgentResponse<unknown>> {
    this.startTiming();
    this.resetTokenTracking();
    
    try {
      const result = await this.execute(context);
      
      // Ensure metadata includes our tracked values
      if (result.metadata) {
        result.metadata.processing_time_ms = this.getProcessingTime();
        result.metadata.tokens_used = this.getTokensUsed();
      }
      
      return result;
    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
