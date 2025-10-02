import { NextRequest } from 'next/server';
import { StreamingWebSocketHandler } from '@/lib/streaming/StreamingWebSocketHandler';
import { streamingManager } from '@/lib/streaming/StreamingResponseManager';

// Global WebSocket handler instance
const _wsHandler = new StreamingWebSocketHandler();

export async function GET(_request: NextRequest) {
  // For Next.js API routes, WebSocket upgrade is complex
  // Redirect to SSE endpoint for streaming
  return new Response('Use /api/streaming/sse for streaming connections', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

// Alternative approach using a simpler WebSocket handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, sessionId, clientId, query, workspaceId, agentId, conversationHistory, selectedDataSources, userId } = body;

    console.log('🔌 Streaming API: Received request:', { type, sessionId, clientId });

    switch (type) {
      case 'subscribe':
        // Handle subscription to streaming session
        if (!sessionId || !clientId) {
          return Response.json({ error: 'Missing sessionId or clientId' }, { status: 400 });
        }
        streamingManager.subscribeToSession(sessionId, clientId);
        return Response.json({ success: true, message: 'Subscribed to session' });

      case 'unsubscribe':
        // Handle unsubscription from streaming session
        if (!sessionId || !clientId) {
          return Response.json({ error: 'Missing sessionId or clientId' }, { status: 400 });
        }
        streamingManager.unsubscribeFromSession(sessionId, clientId);
        return Response.json({ success: true, message: 'Unsubscribed from session' });

      case 'query':
        // Handle streaming query
        if (!query || !workspaceId || !agentId) {
          return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Process query with streaming
        const streamingFlow = new (await import('@/lib/streaming/StreamingMultiAgentFlow')).StreamingMultiAgentFlow();
        const querySessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start streaming processing
        streamingFlow.processQueryWithStreaming(
          query,
          workspaceId,
          conversationHistory || [],
          userId,
          selectedDataSources
        ).catch(error => {
          console.error('Streaming query error:', error);
        });

        return Response.json({ 
          success: true, 
          sessionId: querySessionId,
          message: 'Streaming query started' 
        });

      default:
        return Response.json({ error: 'Unknown request type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Streaming API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
