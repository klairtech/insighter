import { useState, useCallback, useRef, useEffect } from 'react';

export interface StreamingEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_progress' | 'agent_error' | 'final_result' | 'connection_established' | 'ping';
  agentName?: string;
  timestamp: number;
  data?: any;
  progress?: number; // 0-100
  message?: string;
  sessionId?: string;
}

export interface StreamingResponse {
  type: 'streaming_event' | 'query_response' | 'error' | 'pong' | 'subscription_confirmed' | 'connection_established' | 'ping';
  sessionId?: string;
  event?: StreamingEvent;
  response?: any;
  error?: string;
  timestamp: number;
}

export interface StreamingChatOptions {
  onProgress?: (progress: number, message: string) => void;
  onAgentStart?: (agentName: string) => void;
  onAgentComplete?: (agentName: string) => void;
  onError?: (error: string) => void;
  onComplete?: (response: any) => void;
}

export function useStreamingChat(options: StreamingChatOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { status: string; progress: number; message: string }>>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
    setCurrentSessionId(null);
    sessionIdRef.current = null;
  }, []);

  // Handle streaming events
  const handleStreamingEvent = useCallback((event: StreamingEvent) => {
    switch (event.type) {
      case 'agent_start':
        if (event.agentName) {
          setAgentStatuses(prev => ({
            ...prev,
            [event.agentName!]: {
              status: 'running',
              progress: 0,
              message: 'Starting...'
            }
          }));
          options.onAgentStart?.(event.agentName);
        }
        break;

      case 'agent_progress':
        if (event.agentName && event.progress !== undefined) {
          setAgentStatuses(prev => ({
            ...prev,
            [event.agentName!]: {
              status: 'running',
              progress: event.progress!,
              message: event.message || 'Processing...'
            }
          }));
          setOverallProgress(event.progress);
          setCurrentMessage(event.message || '');
          options.onProgress?.(event.progress, event.message || '');
        }
        break;

      case 'agent_complete':
        if (event.agentName) {
          setAgentStatuses(prev => ({
            ...prev,
            [event.agentName!]: {
              status: 'completed',
              progress: 100,
              message: 'Completed'
            }
          }));
          options.onAgentComplete?.(event.agentName);
        }
        break;

      case 'agent_error':
        if (event.agentName) {
          setAgentStatuses(prev => ({
            ...prev,
            [event.agentName!]: {
              status: 'error',
              progress: 0,
              message: 'Error occurred'
            }
          }));
          options.onError?.(`Agent ${event.agentName} failed`);
        }
        break;

      case 'final_result':
        setIsStreaming(false);
        setOverallProgress(100);
        setCurrentMessage('Processing complete');
        break;
    }
  }, [options]);

  // Connect to streaming session
  const connect = useCallback((sessionId: string, clientId: string) => {
    if (eventSourceRef.current) {
      cleanup();
    }

    const eventSource = new EventSource(`/api/streaming/sse?sessionId=${sessionId}&clientId=${clientId}`);
    eventSourceRef.current = eventSource;
    sessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamingResponse = JSON.parse(event.data);

        switch (data.type) {
          case 'connection_established':
            break;

          case 'streaming_event':
            if (data.event) {
              handleStreamingEvent(data.event);
            }
            break;

          case 'query_response':
            setIsStreaming(false);
            options.onComplete?.(data.response);
            break;

          case 'error':
            setIsStreaming(false);
            options.onError?.(data.error || 'Unknown error');
            break;

          case 'ping':
            // Keep connection alive
            break;

          default:
        }
      } catch (_error) {
      }
    };

    eventSource.onerror = (_error) => {
      setIsConnected(false);
      setIsStreaming(false);
      options.onError?.('Connection lost');
    };

    return eventSource;
  }, [cleanup, options, handleStreamingEvent]);

  // Send streaming query
  const sendStreamingQuery = useCallback(async (
    query: string,
    workspaceId: string,
    agentId: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    selectedDataSources: string[],
    userId: string
  ) => {
    if (!sessionIdRef.current) {
      throw new Error('Not connected to streaming session');
    }

    setIsStreaming(true);
    setOverallProgress(0);
    setCurrentMessage('Starting query...');
    setAgentStatuses({});

    try {
      const response = await fetch('/api/streaming/sse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'query',
          sessionId: sessionIdRef.current,
          clientId: `client-${userId}-${Date.now()}`,
          query,
          workspaceId,
          agentId,
          conversationHistory,
          selectedDataSources,
          userId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const _data = await response.json();
      
    } catch (_error) {
      setIsStreaming(false);
      options.onError?.(_error instanceof Error ? _error.message : 'Failed to start streaming query');
    }
  }, [options]);

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isConnected,
    isStreaming,
    currentSessionId,
    agentStatuses,
    overallProgress,
    currentMessage,
    connect,
    sendStreamingQuery,
    disconnect
  };
}
