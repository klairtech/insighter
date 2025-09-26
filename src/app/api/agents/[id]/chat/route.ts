import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/server-utils';
import { verifyAgentApiToken, extractTokenFromHeader } from '@/lib/jwt-utils';
import { getOrCreateApiConversation, saveApiInteraction } from '@/lib/api-conversations';

// Rate limiting: 100 requests per minute
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

interface ChatRequest {
  conversation_id: string;
  message: string;
}

interface ChatResponse {
  response_text: string;
  response_image_url?: string;
  conversation_id: string;
  tokens_used: number;
  processing_time_ms: number;
}

/**
 * Check rate limit for API token
 */
async function checkRateLimit(apiToken: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MS);
  
  // Get current request count for this window
  const { data: rateLimitData, error } = await supabaseServer
    .from('api_rate_limits')
    .select('request_count')
    .eq('api_token', apiToken)
    .gte('window_start', windowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Rate limit check error:', error);
    return false;
  }

  const currentCount = rateLimitData?.request_count || 0;
  
  if (currentCount >= RATE_LIMIT) {
    return false;
  }

  // Update or create rate limit record
  const { error: upsertError } = await supabaseServer
    .from('api_rate_limits')
    .upsert({
      api_token: apiToken,
      window_start: windowStart.toISOString(),
      request_count: currentCount + 1,
      updated_at: now.toISOString(),
    }, {
      onConflict: 'api_token,window_start'
    });

  if (upsertError) {
    console.error('Rate limit update error:', upsertError);
  }

  return true;
}

/**
 * Log API usage
 */
async function logApiUsage(
  agentId: string,
  apiToken: string,
  conversationId: string,
  requestMessage: string,
  responseText: string,
  responseImageUrl: string | null,
  tokensUsed: number,
  processingTimeMs: number,
  status: 'success' | 'error' | 'rate_limited',
  errorMessage: string | null = null,
  request: NextRequest
) {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await supabaseServer
    .from('api_usage_logs')
    .insert({
      agent_id: agentId,
      api_token: apiToken,
      conversation_id: conversationId,
      request_message: requestMessage,
      response_text: responseText,
      response_image_url: responseImageUrl,
      tokens_used: tokensUsed,
      processing_time_ms: processingTimeMs,
      status,
      error_message: errorMessage,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let agentId: string | undefined;
  let apiToken: string | undefined;

  try {
    const { id: paramAgentId } = await params;
    agentId = paramAgentId;

    // Extract and verify API token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header. Use: Bearer <token>' },
        { status: 401 }
      );
    }

    apiToken = token;
    const tokenPayload = verifyAgentApiToken(token);
    
    if (!tokenPayload || tokenPayload.agentId !== agentId) {
      await logApiUsage(
        agentId,
        apiToken,
        '',
        '',
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Invalid or expired API token',
        request
      );
      
      return NextResponse.json(
        { error: 'Invalid or expired API token' },
        { status: 401 }
      );
    }

    // Check rate limit
    const isWithinRateLimit = await checkRateLimit(apiToken);
    if (!isWithinRateLimit) {
      await logApiUsage(
        agentId,
        apiToken,
        '',
        '',
        '',
        null,
        0,
        Date.now() - startTime,
        'rate_limited',
        'Rate limit exceeded',
        request
      );
      
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 100 requests per minute.' },
        { status: 429 }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select('id, name, status, api_enabled, workspace_id, api_usage_count')
      .eq('id', agentId)
      .eq('api_token', apiToken)
      .single();

    console.log('🔍 Agent Debug:', {
      agentId,
      agentFound: !!agent,
      agentError: agentError?.message,
      agentDetails: agent ? {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        api_enabled: agent.api_enabled,
        workspace_id: agent.workspace_id
      } : null
    });

    if (agentError || !agent) {
      await logApiUsage(
        agentId,
        apiToken,
        '',
        '',
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Agent not found or API disabled',
        request
      );
      
      return NextResponse.json(
        { error: 'Agent not found or API access disabled' },
        { status: 404 }
      );
    }

    if (agent.status !== 'active' || !agent.api_enabled) {
      await logApiUsage(
        agentId,
        apiToken,
        '',
        '',
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Agent is not active or API is disabled',
        request
      );
      
      return NextResponse.json(
        { error: 'Agent is not active or API access is disabled' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { conversation_id, message } = body;

    if (!conversation_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id and message' },
        { status: 400 }
      );
    }

    // Note: User-scoped conversation ID is handled in the conversation creation

        // Step 3: Get or create conversation for user + agent
        console.log('🔍 Step 3: Getting or creating conversation...');
        const conversation = await getOrCreateApiConversation({
          userId: tokenPayload.userId,
          agentId: agentId,
          externalConversationId: conversation_id,
          requestContent: message
        });

        if (!conversation) {
          console.error('❌ Step 3: Failed to get or create conversation');
          return NextResponse.json(
            { error: 'Failed to create conversation' },
            { status: 500 }
          );
        }

        console.log('✅ Step 3: Conversation ready:', conversation.id);

    // Get workspace data sources for context
    const { data: dataSources, error: dataSourcesError } = await supabaseServer
      .from('workspace_data_sources')
      .select('source_type, source_name')
      .eq('workspace_id', agent.workspace_id);

    if (dataSourcesError) {
      console.error('Error fetching data sources:', dataSourcesError);
    }

    // Debug: Check if there are files in the workspace
    const { data: files, error: filesError } = await supabaseServer
      .from('file_uploads')
      .select('id, filename, original_name, processing_status')
      .eq('workspace_id', agent.workspace_id);

    if (filesError) {
      console.error('Error fetching files:', filesError);
    }

    console.log('🔍 Agent Chat Debug:', {
      workspace_id: agent.workspace_id,
      data_sources: dataSources?.length || 0,
      files: files?.length || 0,
      files_with_completed_status: files?.filter(f => f.processing_status === 'completed').length || 0,
      data_sources_details: dataSources,
      files_details: files
    });

        // Step 4: Generate AI response with all metrics
        console.log('🔍 Step 4: Generating AI response...');
        let responseText = '';
        const responseImageUrl: string | null = null;
        let tokensUsed = 0;
        let agentResponse: { content: string; tokens_used: number; processing_time_ms: number; metadata?: Record<string, unknown> } | null = null;

        try {
          // Use the actual AI agent processing
          const { processWithAgent } = await import('@/lib/ai-agents');
          
          // Get conversation history for context
          const { data: conversationHistory, error: historyError } = await supabaseServer
            .from('messages')
            .select('sender_type, content, created_at')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true })
            .limit(10); // Get last 10 messages for context

          if (historyError) {
            console.error('Error fetching conversation history:', historyError);
          }

          // Create conversation context for the agent
          const conversationContext = {
            conversation_id: conversation.id,
            agent_id: agentId,
            workspace_id: agent.workspace_id,
            messages: conversationHistory || [
              {
                sender_type: 'user' as const,
                content: message,
                created_at: new Date().toISOString()
              }
            ]
          };

          // Process with the AI agent
          agentResponse = await processWithAgent(
            conversationContext,
            message
          );

          responseText = agentResponse.content;
          tokensUsed = agentResponse.tokens_used;
          
          console.log('✅ Step 4: AI response generated successfully');

    } catch (aiError) {
      console.error('AI response generation error:', aiError);
      
      // Save failed interaction with encryption
      await saveApiInteraction({
        agentId,
        userId: tokenPayload.userId,
        conversationId: conversation.id,
        externalConversationId: conversation.externalConversationId,
        request: message,
        response: '',
        contextData: { dataSources: dataSources?.map(ds => ds.source_name) || [] },
        dataSourcesUsed: dataSources?.map(ds => ds.source_name) || [],
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        status: 'error',
        errorMessage: 'AI response generation failed',
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        apiToken: apiToken
      });
      
      return NextResponse.json(
        { error: 'Failed to generate AI response' },
        { status: 500 }
      );
    }

    // Update agent usage count
    await supabaseServer
      .from('ai_agents')
      .update({
        api_usage_count: agent.api_usage_count + 1,
        last_api_used_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    const processingTime = Date.now() - startTime;

    // Step 5: Save to messages table with all metrics
    console.log('🔍 Step 5: Saving to messages table...');
    await saveApiInteraction({
      agentId,
      userId: tokenPayload.userId,
      conversationId: conversation.id,
      externalConversationId: conversation.externalConversationId,
      request: message,
      response: responseText,
      responseImageUrl: responseImageUrl || undefined,
      contextData: { dataSources: dataSources?.map(ds => ds.source_name) || [] },
      dataSourcesUsed: dataSources?.map(ds => ds.source_name) || [],
      tokensUsed: tokensUsed,
      processingTimeMs: processingTime,
      status: 'success',
      ipAddress: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      apiToken: apiToken
    });

    console.log('✅ Step 5: Successfully saved to messages table');

    const response: ChatResponse = {
      response_text: responseText,
      response_image_url: responseImageUrl || undefined,
      conversation_id, // Return original conversation_id to client
      tokens_used: tokensUsed,
      processing_time_ms: processingTime,
      // Include agent metadata if available
      ...(agentResponse && {
        sql_query: agentResponse.metadata?.sql_query,
        data_sources: Array.isArray(agentResponse.metadata?.files_referenced) 
          ? agentResponse.metadata.files_referenced.map(fileId => ({
              file_id: fileId,
              file_name: `File ${fileId}`, // This could be enhanced to get actual file names
              relevance_score: agentResponse.metadata?.confidence_score || 0.8,
              sections_used: []
            }))
          : [],
        rag_context: {
          retrieved_chunks: Array.isArray(agentResponse.metadata?.files_referenced) 
            ? agentResponse.metadata.files_referenced.length 
            : 0,
          similarity_scores: Array.isArray(agentResponse.metadata?.files_referenced)
            ? agentResponse.metadata.files_referenced.map(() => 
                agentResponse.metadata?.confidence_score || 0.8
              )
            : [],
          source_documents: Array.isArray(agentResponse.metadata?.files_referenced)
            ? agentResponse.metadata.files_referenced.map(fileId => 
                `File ${fileId}`
              )
            : []
        },
        explainability: {
          reasoning_steps: [`Processed ${Array.isArray(agentResponse.metadata?.files_referenced) ? agentResponse.metadata.files_referenced.length : 0} files`],
          confidence_score: agentResponse.metadata?.confidence_score || 0.8,
          uncertainty_factors: (typeof agentResponse.metadata?.confidence_score === 'number' && agentResponse.metadata.confidence_score < 0.7)
            ? ['Low confidence in analysis'] 
            : []
        }
      })
    };

    console.log('✅ Step 6: Response sent successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('API chat error:', error);
    
    if (agentId && apiToken) {
      await logApiUsage(
        agentId,
        apiToken,
        '',
        '',
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Internal server error',
        request
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Agent API endpoint - Conversation IDs are automatically scoped to your user',
      usage: 'POST /api/agents/[id]/chat',
      required_headers: {
        'Authorization': 'Bearer <your_api_token>',
        'Content-Type': 'application/json'
      },
      request_body: {
        conversation_id: 'string (external conversation ID - will be scoped to your user)',
        message: 'string (user message)'
      },
      response_format: {
        response_text: 'string (AI response)',
        response_image_url: 'string (optional image URL)',
        conversation_id: 'string',
        tokens_used: 'number',
        processing_time_ms: 'number'
      }
    },
    { status: 200 }
  );
}
