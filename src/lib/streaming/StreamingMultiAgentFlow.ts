/**
 * Streaming Multi-Agent Flow
 * 
 * Enhanced multi-agent flow with real-time streaming capabilities
 */

import { MultiAgentFlow } from '../multi-agent-flow';
import { streamingManager } from './StreamingResponseManager';
import { EnhancedAgentResponse } from '../agents/types';

export interface StreamingOptions {
  enableStreaming: boolean;
  sessionId: string;
  clientId?: string;
}

export class StreamingMultiAgentFlow extends MultiAgentFlow {
  private streamingEnabled: boolean = false;
  private currentSessionId: string | null = null;
  private currentClientId: string | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize streaming capabilities
   */
  public initializeStreaming(options: StreamingOptions): void {
    this.streamingEnabled = options.enableStreaming;
    this.currentSessionId = options.sessionId;
    this.currentClientId = options.clientId || null;
  }

  /**
   * Execute streaming query with enhanced multi-agent flow
   */
  public async executeStreamingQuery(
    query: string,
    _workspaceId: string,
    _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    _userId?: string,
    _selectedDataSources?: string[]
  ): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();

    if (this.streamingEnabled && this.currentSessionId) {
      await this.streamAgentStart('Streaming Multi-Agent Flow');
    }

    try {
      // Mock implementation for now - this would call the actual multi-agent flow
      const mockResponse = await this.createMockResponse(query, startTime);

      if (this.streamingEnabled && this.currentSessionId) {
        await this.streamAgentComplete('Streaming Multi-Agent Flow', {
          total_agents: 5,
          processing_time: Date.now() - startTime,
          sources_processed: 3
        });
      }

      return mockResponse;

    } catch (error) {
      if (this.streamingEnabled && this.currentSessionId) {
        // Use console.log instead of non-existent emitError method
        console.error('Streaming error:', error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    }
  }

  /**
   * Create mock response for testing
   */
  private async createMockResponse(query: string, startTime: number): Promise<EnhancedAgentResponse> {
    return {
      content: `Mock response for query: ${query}`,
      success: true,
      data_sources_used: ['mock-database', 'mock-files'],
      processing_time_ms: Date.now() - startTime,
      tokens_used: 150,
      estimated_credits: 0.1,
      confidence_score: 0.85,
      follow_up_suggestions: ['Follow up question 1', 'Follow up question 2'],
      metadata: {
        agents_executed: ['StreamingMultiAgentFlow'],
        fallback_used: false,
        context_analysis: { 
          response_type: 'streaming',
          query_optimized: true
        },
        processing_strategy: 'streaming_responses'
      }
    };
  }

  /**
   * Stream agent start event
   */
  private async streamAgentStart(agentName: string): Promise<void> {
    if (this.streamingEnabled && this.currentSessionId) {
      streamingManager.emitAgentStart(this.currentSessionId, agentName);
    }
  }

  /**
   * Stream agent complete event
   */
  private async streamAgentComplete(agentName: string, data?: Record<string, unknown>): Promise<void> {
    if (this.streamingEnabled && this.currentSessionId) {
      streamingManager.emitAgentComplete(this.currentSessionId, agentName, data);
    }
  }

  /**
   * Process query with streaming (alias for executeStreamingQuery)
   */
  public async processQueryWithStreaming(
    query: string,
    workspaceId: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    userId?: string,
    selectedDataSources?: string[]
  ): Promise<EnhancedAgentResponse> {
    return this.executeStreamingQuery(query, workspaceId, conversationHistory, userId, selectedDataSources);
  }
}

// Export a singleton instance
export const streamingMultiAgentFlow = new StreamingMultiAgentFlow();