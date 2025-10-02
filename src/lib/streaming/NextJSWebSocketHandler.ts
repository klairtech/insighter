/**
 * Next.js Compatible WebSocket Handler
 * 
 * Simplified WebSocket handler that works with Next.js API routes
 */

import { streamingManager, StreamingEvent } from './StreamingResponseManager';
import { StreamingMultiAgentFlow } from './StreamingMultiAgentFlow';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'query' | 'ping' | 'pong';
  sessionId?: string;
  clientId?: string;
  query?: string;
  workspaceId?: string;
  agentId?: string;
  conversationHistory?: Array<{sender_type: string, content: string, created_at: string}>;
  selectedDataSources?: string[];
  userId?: string;
  timestamp?: number;
}

export interface WebSocketResponse {
  type: 'streaming_event' | 'query_response' | 'error' | 'pong' | 'subscription_confirmed';
  sessionId?: string;
  event?: StreamingEvent;
  response?: Record<string, unknown>;
  error?: string;
  timestamp: number;
}

export class NextJSWebSocketHandler {
  private clients: Map<string, { write: (data: string) => void; send?: (data: string) => void }> = new Map(); // clientId -> response stream
  private clientSessions: Map<string, string> = new Map(); // clientId -> sessionId
  private sessionClients: Map<string, Set<string>> = new Map(); // sessionId -> Set of clientIds

  constructor() {
    this.setupStreamingListeners();
  }

  /**
   * Handle subscription to a streaming session
   */
  subscribeToSession(sessionId: string, clientId: string): void {
    console.log(`📡 Subscribing client ${clientId} to session ${sessionId}`);
    
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    
    this.sessionClients.get(sessionId)!.add(clientId);
    this.clientSessions.set(clientId, sessionId);
    
    // Send confirmation
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * Handle unsubscription from a streaming session
   */
  unsubscribeFromSession(sessionId: string, clientId: string): void {
    console.log(`📡 Unsubscribing client ${clientId} from session ${sessionId}`);
    
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.sessionClients.delete(sessionId);
      }
    }
    
    this.clientSessions.delete(clientId);
  }

  /**
   * Process a streaming query
   */
  async processStreamingQuery(
    query: string,
    workspaceId: string,
    agentId: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    selectedDataSources: string[],
    userId: string,
    sessionId: string,
    clientId: string
  ): Promise<void> {
    try {
      console.log(`🚀 Starting streaming query for session ${sessionId}`);
      
      const streamingFlow = new StreamingMultiAgentFlow();
      
      // Process query with streaming
      const response = await streamingFlow.processQueryWithStreaming(
        query,
        workspaceId,
        conversationHistory,
        userId,
        selectedDataSources
      );

      // Send final response
      this.sendToClient(clientId, {
        type: 'query_response',
        sessionId,
        response: response as unknown as Record<string, unknown>,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Streaming query error:', error);
      this.sendToClient(clientId, {
        type: 'error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(clientId: string, message: WebSocketResponse): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        // For Server-Sent Events (SSE) approach
        if (client.write) {
          client.write(`data: ${JSON.stringify(message)}\n\n`);
        }
        // For WebSocket approach
        else if (client.send) {
          client.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Broadcast message to all clients in a session
   */
  private broadcastToSession(sessionId: string, message: WebSocketResponse): void {
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  /**
   * Broadcast message to all active sessions
   */
  private broadcastToAllSessions(message: WebSocketResponse): void {
    this.sessionClients.forEach((clients, sessionId) => {
      clients.forEach(clientId => {
        this.sendToClient(clientId, {
          ...message,
          sessionId
        });
      });
    });
  }

  /**
   * Remove a client
   */
  private removeClient(clientId: string): void {
    const sessionId = this.clientSessions.get(clientId);
    if (sessionId) {
      this.unsubscribeFromSession(sessionId, clientId);
    }
    this.clients.delete(clientId);
  }

  /**
   * Setup streaming event listeners
   */
  private setupStreamingListeners(): void {
    streamingManager.on('agent_start', (event: StreamingEvent) => {
      console.log(`🟢 Agent started: ${event.agentName}`);
      // Broadcast to all active sessions since we don't have sessionId in the event
      this.broadcastToAllSessions({
        type: 'streaming_event',
        event,
        timestamp: Date.now()
      });
    });

    streamingManager.on('agent_complete', (event: StreamingEvent) => {
      console.log(`✅ Agent completed: ${event.agentName}`);
      // Broadcast to all active sessions since we don't have sessionId in the event
      this.broadcastToAllSessions({
        type: 'streaming_event',
        event,
        timestamp: Date.now()
      });
    });

    streamingManager.on('agent_progress', (event: StreamingEvent) => {
      // Broadcast to all active sessions since we don't have sessionId in the event
      this.broadcastToAllSessions({
        type: 'streaming_event',
        event,
        timestamp: Date.now()
      });
    });

    streamingManager.on('agent_error', (event: StreamingEvent) => {
      console.log(`❌ Agent error: ${event.agentName}`, event.data);
      // Broadcast to all active sessions since we don't have sessionId in the event
      this.broadcastToAllSessions({
        type: 'streaming_event',
        event,
        timestamp: Date.now()
      });
    });

    streamingManager.on('final_result', (event: StreamingEvent) => {
      console.log(`🎉 Final result ready`);
      // Broadcast to all active sessions since we don't have sessionId in the event
      this.broadcastToAllSessions({
        type: 'streaming_event',
        event,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get session statistics
   */
  getSessionStats(): { activeSessions: number; totalClients: number } {
    return {
      activeSessions: this.sessionClients.size,
      totalClients: this.clients.size
    };
  }
}

// Export singleton instance
export const nextJSWebSocketHandler = new NextJSWebSocketHandler();
