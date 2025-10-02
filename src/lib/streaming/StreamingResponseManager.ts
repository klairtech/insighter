/**
 * Streaming Response Manager
 * 
 * Manages real-time streaming of agent responses and progress updates
 */

import { EventEmitter } from 'events';

export interface StreamingEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_progress' | 'agent_error' | 'final_result';
  agentName: string;
  timestamp: number;
  data?: Record<string, unknown>;
  progress?: number; // 0-100
  message?: string;
}

export interface StreamingContext {
  sessionId: string;
  userId?: string;
  workspaceId: string;
  query: string;
  startTime: number;
  totalAgents: number;
  completedAgents: number;
}

export class StreamingResponseManager extends EventEmitter {
  private activeSessions: Map<string, StreamingContext> = new Map();
  private sessionSubscribers: Map<string, Set<string>> = new Map(); // sessionId -> Set of clientIds

  /**
   * Start a new streaming session
   */
  startSession(
    sessionId: string,
    userId: string | undefined,
    workspaceId: string,
    query: string,
    totalAgents: number
  ): StreamingContext {
    const context: StreamingContext = {
      sessionId,
      userId,
      workspaceId,
      query,
      startTime: Date.now(),
      totalAgents,
      completedAgents: 0
    };

    this.activeSessions.set(sessionId, context);
    this.sessionSubscribers.set(sessionId, new Set());

    // Emit session start event
    this.emit('session_start', {
      type: 'session_start',
      sessionId,
      timestamp: Date.now(),
      data: context
    });

    return context;
  }

  /**
   * Subscribe a client to a streaming session
   */
  subscribeToSession(sessionId: string, clientId: string): boolean {
    if (!this.activeSessions.has(sessionId)) {
      return false;
    }

    const subscribers = this.sessionSubscribers.get(sessionId) || new Set();
    subscribers.add(clientId);
    this.sessionSubscribers.set(sessionId, subscribers);

    // Send current session state to new subscriber
    const context = this.activeSessions.get(sessionId);
    if (context) {
      this.emit('client_subscribed', {
        type: 'client_subscribed',
        sessionId,
        clientId,
        timestamp: Date.now(),
        data: context
      });
    }

    return true;
  }

  /**
   * Unsubscribe a client from a streaming session
   */
  unsubscribeFromSession(sessionId: string, clientId: string): void {
    const subscribers = this.sessionSubscribers.get(sessionId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.sessionSubscribers.delete(sessionId);
      }
    }
  }

  /**
   * Emit agent start event
   */
  emitAgentStart(sessionId: string, agentName: string, message?: string): void {
    const event: StreamingEvent = {
      type: 'agent_start',
      agentName,
      timestamp: Date.now(),
      message: message || `${agentName} started processing...`
    };

    this.emitToSession(sessionId, event);
  }

  /**
   * Emit agent progress event
   */
  emitAgentProgress(sessionId: string, agentName: string, progress: number, message?: string): void {
    const event: StreamingEvent = {
      type: 'agent_progress',
      agentName,
      timestamp: Date.now(),
      progress: Math.min(Math.max(progress, 0), 100),
      message: message || `${agentName} progress: ${progress}%`
    };

    this.emitToSession(sessionId, event);
  }

  /**
   * Emit agent completion event
   */
  emitAgentComplete(sessionId: string, agentName: string, data?: Record<string, unknown>, message?: string): void {
    const context = this.activeSessions.get(sessionId);
    if (context) {
      context.completedAgents++;
    }

    const event: StreamingEvent = {
      type: 'agent_complete',
      agentName,
      timestamp: Date.now(),
      data,
      message: message || `${agentName} completed successfully`
    };

    this.emitToSession(sessionId, event);

    // Check if all agents are complete
    if (context && context.completedAgents >= context.totalAgents) {
      this.emitSessionComplete(sessionId);
    }
  }

  /**
   * Emit agent error event
   */
  emitAgentError(sessionId: string, agentName: string, error: string, fallbackData?: Record<string, unknown>): void {
    const event: StreamingEvent = {
      type: 'agent_error',
      agentName,
      timestamp: Date.now(),
      data: { error, fallbackData },
      message: `${agentName} encountered an error: ${error}`
    };

    this.emitToSession(sessionId, event);
  }

  /**
   * Emit final result event
   */
  emitFinalResult(sessionId: string, result: Record<string, unknown>): void {
    const context = this.activeSessions.get(sessionId);
    const processingTime = context ? Date.now() - context.startTime : 0;

    const event: StreamingEvent = {
      type: 'final_result',
      agentName: 'MultiAgentFlow',
      timestamp: Date.now(),
      data: {
        ...result,
        processing_time_ms: processingTime,
        session_id: sessionId
      },
      message: 'Processing completed successfully'
    };

    this.emitToSession(sessionId, event);
    this.endSession(sessionId);
  }

  /**
   * Emit session complete event
   */
  private emitSessionComplete(sessionId: string): void {
    const context = this.activeSessions.get(sessionId);
    if (!context) return;

    const processingTime = Date.now() - context.startTime;
    
    this.emitToSession(sessionId, {
      type: 'agent_complete',
      agentName: 'MultiAgentFlow',
      timestamp: Date.now(),
      data: {
        total_agents: context.totalAgents,
        completed_agents: context.completedAgents,
        processing_time_ms: processingTime
      },
      message: 'All agents completed processing'
    });
  }

  /**
   * End a streaming session
   */
  endSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.sessionSubscribers.delete(sessionId);

    this.emit('session_end', {
      type: 'session_end',
      sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): StreamingContext | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get session subscribers count
   */
  getSessionSubscribersCount(sessionId: string): number {
    return this.sessionSubscribers.get(sessionId)?.size || 0;
  }

  /**
   * Emit event to all subscribers of a session
   */
  private emitToSession(sessionId: string, event: StreamingEvent): void {
    const subscribers = this.sessionSubscribers.get(sessionId);
    if (subscribers && subscribers.size > 0) {
      this.emit('streaming_event', {
        sessionId,
        event,
        subscribers: Array.from(subscribers)
      });
    }
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAge: number = 300000): void { // 5 minutes default
    const now = Date.now();
    const inactiveSessions: string[] = [];

    for (const [sessionId, context] of this.activeSessions.entries()) {
      if (now - context.startTime > maxAge) {
        inactiveSessions.push(sessionId);
      }
    }

    inactiveSessions.forEach(sessionId => {
      console.log(`🧹 Cleaning up inactive session: ${sessionId}`);
      this.endSession(sessionId);
    });

    if (inactiveSessions.length > 0) {
      console.log(`🧹 Cleaned up ${inactiveSessions.length} inactive sessions`);
    }
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    activeSessions: number;
    totalSubscribers: number;
    averageSubscribersPerSession: number;
  } {
    const activeSessions = this.activeSessions.size;
    let totalSubscribers = 0;

    for (const subscribers of this.sessionSubscribers.values()) {
      totalSubscribers += subscribers.size;
    }

    return {
      activeSessions,
      totalSubscribers,
      averageSubscribersPerSession: activeSessions > 0 ? totalSubscribers / activeSessions : 0
    };
  }
}

// Export singleton instance
export const streamingManager = new StreamingResponseManager();

// Cleanup inactive sessions every 2 minutes
setInterval(() => {
  streamingManager.cleanupInactiveSessions();
}, 120000);
