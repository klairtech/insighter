import { NextRequest } from 'next/server';
import { nextJSWebSocketHandler } from '@/lib/streaming/NextJSWebSocketHandler';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const clientId = searchParams.get('clientId');

  if (!sessionId || !clientId) {
    return new Response('Missing sessionId or clientId', { status: 400 });
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Set up SSE headers
      const encoder = new TextEncoder();
      
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connection_established',
        sessionId,
        clientId,
        timestamp: Date.now()
      })}\n\n`;
      
      controller.enqueue(encoder.encode(initialMessage));

      // Store the controller for this client
      nextJSWebSocketHandler['clients'].set(clientId, {
        write: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.error('Error writing to SSE stream:', error);
          }
        }
      });

      // Subscribe to the session
      nextJSWebSocketHandler.subscribeToSession(sessionId, clientId);

      // Handle client disconnect
      request.signal.addEventListener('abort', (_event) => {
        console.log(`🔌 SSE client disconnected: ${clientId}`);
        nextJSWebSocketHandler.unsubscribeFromSession(sessionId, clientId);
        nextJSWebSocketHandler['clients'].delete(clientId);
        controller.close();
      });

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          const pingMessage = `data: ${JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          })}\n\n`;
          controller.enqueue(encoder.encode(pingMessage));
        } catch (_error) {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds

      // Clean up on close
      const cleanup = () => {
        clearInterval(pingInterval);
        nextJSWebSocketHandler.unsubscribeFromSession(sessionId, clientId);
        nextJSWebSocketHandler['clients'].delete(clientId);
      };

      // Handle stream close
      const originalClose = controller.close.bind(controller);
      controller.close = () => {
        cleanup();
        originalClose();
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      sessionId, 
      clientId, 
      query, 
      workspaceId, 
      agentId, 
      conversationHistory, 
      selectedDataSources, 
      userId 
    } = body;

    console.log('🔌 SSE API: Received request:', { type, sessionId, clientId });

    switch (type) {
      case 'subscribe':
        nextJSWebSocketHandler.subscribeToSession(sessionId, clientId);
        return Response.json({ success: true, message: 'Subscribed to session' });

      case 'unsubscribe':
        nextJSWebSocketHandler.unsubscribeFromSession(sessionId, clientId);
        return Response.json({ success: true, message: 'Unsubscribed from session' });

      case 'query':
        if (!query || !workspaceId || !agentId) {
          return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Process query with streaming
        const newSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Start streaming processing
        nextJSWebSocketHandler.processStreamingQuery(
          query,
          workspaceId,
          agentId,
          conversationHistory || [],
          selectedDataSources || [],
          userId || 'anonymous',
          newSessionId,
          clientId
        ).catch(error => {
          console.error('Streaming query error:', error);
        });

        return Response.json({ 
          success: true, 
          sessionId: newSessionId,
          message: 'Streaming query started' 
        });

      default:
        return Response.json({ error: 'Unknown request type' }, { status: 400 });
    }
  } catch (error) {
    console.error('SSE API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
