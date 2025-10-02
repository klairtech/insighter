/**
 * Streaming WebSocket Handler
 * 
 * Handles WebSocket connections for real-time streaming of agent responses
 */

import { WebSocket } from 'ws';
import { streamingManager, StreamingEvent } from './StreamingResponseManager';
import { streamingMultiAgentFlow } from './StreamingMultiAgentFlow';

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
  type: 'streaming_event' | 'query_response' | 'error' | 'pong' | 'subscription_confirmed' | 'connection_established';
  sessionId?: string;
  event?: StreamingEvent;
  response?: Record<string, unknown>;
  error?: string;
  timestamp: number;
}

export class StreamingWebSocketHandler {
  private clients: Map<string, WebSocket> = new Map();
  private clientSessions: Map<string, string> = new Map(); // clientId -> sessionId
  private sessionClients: Map<string, Set<string>> = new Map(); // sessionId -> Set of clientIds

  constructor() {
    this.setupStreamingListeners();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, clientId: string): void {
    console.log(`🔌 WebSocket client connected: ${clientId}`);
    
    this.clients.set(clientId, ws);

    // Set up message handlers
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
        this.sendError(clientId, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket client disconnected: ${clientId}`);
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Send connection confirmation
    this.sendMessage(clientId, {
      type: 'subscription_confirmed',
      timestamp: Date.now()
    });
  }

  /**
   * Handle WebSocket message
   */
  private async handleMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message);
          break;
        case 'query':
          await this.handleQuery(clientId, message);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message for client ${clientId}:`, error);
      this.sendError(clientId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle subscription to streaming session
   */
  private async handleSubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    if (!message.sessionId) {
      this.sendError(clientId, 'Session ID required for subscription');
      return;
    }

    const success = streamingManager.subscribeToSession(message.sessionId, clientId);
    
    if (success) {
      this.clientSessions.set(clientId, message.sessionId);
      
      // Add client to session clients map
      if (!this.sessionClients.has(message.sessionId)) {
        this.sessionClients.set(message.sessionId, new Set());
      }
      this.sessionClients.get(message.sessionId)!.add(clientId);

      this.sendMessage(clientId, {
        type: 'subscription_confirmed',
        sessionId: message.sessionId,
        timestamp: Date.now()
      });

      console.log(`📡 Client ${clientId} subscribed to session ${message.sessionId}`);
    } else {
      this.sendError(clientId, 'Failed to subscribe to session');
    }
  }

  /**
   * Handle unsubscription from streaming session
   */
  private async handleUnsubscribe(clientId: string, _message: WebSocketMessage): Promise<void> {
    const sessionId = this.clientSessions.get(clientId);
    
    if (sessionId) {
      streamingManager.unsubscribeFromSession(sessionId, clientId);
      this.clientSessions.delete(clientId);
      
      // Remove client from session clients map
      const sessionClients = this.sessionClients.get(sessionId);
      if (sessionClients) {
        sessionClients.delete(clientId);
        if (sessionClients.size === 0) {
          this.sessionClients.delete(sessionId);
        }
      }

      console.log(`📡 Client ${clientId} unsubscribed from session ${sessionId}`);
    }
  }

  /**
   * Handle query processing with streaming
   */
  private async handleQuery(clientId: string, message: WebSocketMessage): Promise<void> {
    if (!message.query || !message.workspaceId || !message.agentId) {
      this.sendError(clientId, 'Query, workspaceId, and agentId are required');
      return;
    }

    const sessionId = message.sessionId || `session_${Date.now()}_${clientId}`;
    
    try {
      // Subscribe client to the session
      await this.handleSubscribe(clientId, { ...message, sessionId });

      // Process query with streaming
      const result = await streamingMultiAgentFlow.processQueryWithStreaming(
        message.query,
        message.workspaceId,
        message.conversationHistory || [],
        message.userId,
        message.selectedDataSources
      );

      // Send final response
      this.sendMessage(clientId, {
        type: 'query_response',
        sessionId,
        response: result as unknown as Record<string, unknown>,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`Query processing error for client ${clientId}:`, error);
      this.sendError(clientId, error instanceof Error ? error.message : 'Query processing failed');
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(clientId: string): void {
    this.sendMessage(clientId, {
      type: 'pong',
      timestamp: Date.now()
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const sessionId = this.clientSessions.get(clientId);
    
    if (sessionId) {
      streamingManager.unsubscribeFromSession(sessionId, clientId);
      
      // Remove client from session clients map
      const sessionClients = this.sessionClients.get(sessionId);
      if (sessionClients) {
        sessionClients.delete(clientId);
        if (sessionClients.size === 0) {
          this.sessionClients.delete(sessionId);
        }
      }
    }

    this.clients.delete(clientId);
    this.clientSessions.delete(clientId);
  }

  /**
   * Send message to client
   */
  private sendMessage(clientId: string, response: WebSocketResponse): void {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(response));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        this.handleDisconnection(clientId);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  /**
   * Setup streaming event listeners
   */
  private setupStreamingListeners(): void {
    streamingManager.on('streaming_event', (data: { sessionId: string; event: StreamingEvent; subscribers: string[] }) => {
      // Send event to all subscribers
      data.subscribers.forEach(clientId => {
        this.sendMessage(clientId, {
          type: 'streaming_event',
          sessionId: data.sessionId,
          event: data.event,
          timestamp: Date.now()
        });
      });
    });

    streamingManager.on('session_start', (data: Record<string, unknown>) => {
      console.log(`🚀 Streaming session started: ${data.sessionId}`);
    });

    streamingManager.on('session_end', (data: Record<string, unknown>) => {
      console.log(`🏁 Streaming session ended: ${data.sessionId}`);
      
      // Clean up session clients
      const sessionClients = this.sessionClients.get(data.sessionId as string);
      if (sessionClients) {
        sessionClients.forEach(clientId => {
          this.clientSessions.delete(clientId);
        });
        this.sessionClients.delete(data.sessionId as string);
      }
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    activeSessions: number;
    clientsPerSession: Record<string, number>;
  } {
    const clientsPerSession: Record<string, number> = {};
    
    for (const [sessionId, clients] of this.sessionClients.entries()) {
      clientsPerSession[sessionId] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      activeSessions: this.sessionClients.size,
      clientsPerSession
    };
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketResponse): void {
    for (const clientId of this.clients.keys()) {
      this.sendMessage(clientId, message);
    }
  }

  /**
   * Broadcast message to session subscribers
   */
  broadcastToSession(sessionId: string, message: WebSocketResponse): void {
    const sessionClients = this.sessionClients.get(sessionId);
    if (sessionClients) {
      sessionClients.forEach(clientId => {
        this.sendMessage(clientId, message);
      });
    }
  }
}

// Export singleton instance
export const streamingWebSocketHandler = new StreamingWebSocketHandler();
