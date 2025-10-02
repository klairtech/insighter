import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/server-utils';
import { verifyAgentApiToken, extractTokenFromHeader } from '@/lib/jwt-utils';
import { getOrCreateApiConversation, saveApiInteraction } from '@/lib/api-conversations';
import { TokenTrackingData } from '@/lib/token-utils';
// import { checkUserCredits, deductCredits } from '@/lib/credit-utils';

// Rate limiting: 100 requests per minute
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

interface ChatRequest {
  conversation_id: string;
  message: string;
}

interface XAIMetrics {
  confidence_score: number;
  reasoning_steps: string[];
  uncertainty_factors: string[];
  data_quality_score: number;
  response_completeness_score: number;
  user_satisfaction_prediction: number;
}

interface RAGContext {
  retrieved_chunks: number;
  similarity_scores: unknown[];
  source_documents: string[];
}

interface Explainability {
  reasoning_steps: string[];
  confidence_score: unknown;
  uncertainty_factors: string[];
}

interface DataSource {
  source_id?: string;
  source_name?: string;
  relevance_score: unknown;
  sections_used?: string[];
}

interface ChatResponse {
  response_text: string;
  response_image_url?: string;
  conversation_id: string;
  credits_used: number;
  credits_remaining?: number;
  processing_time_ms: number;
  // XAI and detailed metadata fields
  xai_metrics?: XAIMetrics;
  agent_thinking_notes?: string[];
  sql_queries?: string[];
  graph_data?: Record<string, unknown>;
  reasoning_explanation?: string;
  analysis_depth?: string;
  data_quality_score?: number;
  response_completeness_score?: number;
  user_satisfaction_prediction?: number;
  token_tracking?: TokenTrackingData;
  rag_context?: RAGContext;
  explainability?: Explainability;
  data_sources?: DataSource[];
  sql_query?: unknown;
}

/**
 * Check rate limit for API token
 */
async function checkRateLimit(apiToken: string): Promise<boolean> {
  if (!supabaseServer) {
    console.error('Database not configured for rate limiting');
    return false;
  }

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
  if (!supabaseServer) {
    console.error('Database not configured for API usage logging');
    return;
  }

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

    // Get agent details (don't validate against stored token since we use user-specific tokens)
    const { data: agent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select('id, name, status, api_enabled, workspace_id, api_usage_count')
      .eq('id', agentId)
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

    // Verify user has access to this agent using the token payload
    // The tokenPayload.userId should match the user making the request
    console.log('🔍 User Access Check:', {
      tokenUserId: tokenPayload.userId,
      agentWorkspaceId: agent.workspace_id
    });

    // Check if user has access to the workspace that owns this agent
    const { data: workspaceAccess } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', agent.workspace_id)
      .single();

    if (!workspaceAccess) {
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
        'Workspace not found for agent',
        request
      );
      
      return NextResponse.json(
        { error: 'Agent workspace not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the organization or workspace
    const { data: orgMembership } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', tokenPayload.userId)
      .eq('organization_id', workspaceAccess.organization_id)
      .eq('status', 'active')
      .single();

    const { data: workspaceMembership } = await supabaseServer
      .from('workspace_members')
      .select('role')
      .eq('user_id', tokenPayload.userId)
      .eq('workspace_id', agent.workspace_id)
      .eq('status', 'active')
      .single();

    const hasAccess = orgMembership || workspaceMembership;

    if (!hasAccess) {
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
        'User does not have access to this agent',
        request
      );
      
      return NextResponse.json(
        { error: 'Access denied to this agent' },
        { status: 403 }
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

    // Check user credits before processing (estimate 50 credits for a typical request)
    // First check if user has minimum credits (10 credits minimum)
    const { checkUserCredits } = await import('@/lib/credit-service-server');
    const minimumCreditsCheck = await checkUserCredits(tokenPayload.userId, 10);
    
    if (!minimumCreditsCheck.hasCredits) {
      await logApiUsage(
        agentId,
        apiToken,
        conversation_id,
        message,
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Insufficient credits for chat',
        request
      );
      
      return NextResponse.json(
        { 
          error: 'Insufficient credits to use chat functionality',
          current_balance: minimumCreditsCheck.currentCredits,
          required_credits: 10,
          message: 'You need at least 10 credits to use the chat feature. Please purchase more credits to continue.'
        },
        { status: 402 } // Payment Required
      );
    }

    const estimatedCredits = 50;
    const creditCheck = await checkUserCredits(tokenPayload.userId, estimatedCredits);
    
    if (!creditCheck.hasCredits) {
      await logApiUsage(
        agentId,
        apiToken,
        conversation_id,
        message,
        '',
        null,
        0,
        Date.now() - startTime,
        'error',
        'Insufficient credits',
        request
      );
      
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          current_balance: creditCheck.currentCredits,
          required_credits: estimatedCredits,
          message: 'You need more credits to use this agent. Please purchase credits to continue.'
        },
        { status: 402 } // Payment Required
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
        let agentResponse: {
          content: string;
          tokens_used: number;
          processing_time_ms: number;
          metadata?: Record<string, unknown>;
          xai_metrics?: XAIMetrics;
          agent_thinking_notes?: string[];
          sql_queries?: string[];
          graph_data?: Record<string, unknown>;
          reasoning_explanation?: string;
          analysis_depth?: string;
          data_quality_score?: number;
          response_completeness_score?: number;
          user_satisfaction_prediction?: number;
          token_tracking?: TokenTrackingData;
          rag_context?: {
            retrieved_chunks: number;
            similarity_scores: unknown[];
            source_documents: string[];
          };
          explainability?: Explainability;
          data_sources?: DataSource[];
          sql_query?: unknown;
          error_details?: string;
        } | null = null;

        try {
          // Use the new multi-agent flow processing
          const { multiAgentFlow } = await import('@/lib/multi-agent-flow');
          
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

          // Create conversation context for the agent (unused but kept for future use)
          // const conversationContext = {
          //   conversation_id: conversation.id,
          //   agent_id: agentId,
          //   workspace_id: agent.workspace_id,
          //   messages: conversationHistory || [
          //     {
          //       sender_type: 'user' as const,
          //       content: message,
          //       created_at: new Date().toISOString()
          //     }
          //   ]
          // };

          // Process with the new multi-agent flow
          agentResponse = await multiAgentFlow.processQuery(
            message,
            agent.workspace_id,
            agentId,
            conversationHistory || [],
            tokenPayload.userId
          );

          responseText = agentResponse.content;
          tokensUsed = agentResponse.tokens_used;
          
          // Debug: Log what we received from the multi-agent flow
          console.log('🔍 Debug: Agent response keys:', Object.keys(agentResponse));
          console.log('🔍 Debug: Has xai_metrics:', !!agentResponse.xai_metrics);
          console.log('🔍 Debug: Has sql_queries:', !!agentResponse.sql_queries);
          console.log('🔍 Debug: Has graph_data:', !!agentResponse.graph_data);
          console.log('🔍 Debug: Has agent_thinking_notes:', !!agentResponse.agent_thinking_notes);
          console.log('🔍 Debug: xai_metrics value:', agentResponse.xai_metrics);
          console.log('🔍 Debug: sql_queries value:', agentResponse.sql_queries);
          
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
        { 
          error: 'Failed to generate AI response',
          error_details: aiError instanceof Error ? aiError.message : 'Unknown error',
          conversation_id: conversation.id
        },
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
    
    // Save API interaction (for API tracking)
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

    // Also save to messages table for chat interface compatibility
    console.log('🔍 Step 5b: Saving messages to messages table...');
    
    const { encryptText, encryptObject } = await import('@/lib/encryption');
    
    // Save user message first
    const userMessageEncrypted = encryptText(message);
    const crypto = await import('crypto');
    const userMessageHash = crypto.createHash('sha256').update(message).digest('hex');
    
    const { data: userMessage, error: userMsgError } = await supabaseServer
      .rpc('insert_message_safe', {
        p_conversation_id: conversation.id,
        p_content_encrypted: userMessageEncrypted,
        p_content_hash: userMessageHash,
        p_sender_type: 'user',
        p_message_type: 'text',
        p_metadata_encrypted: encryptObject({
          input_tokens: tokensUsed,
          message_length: message.length
        }),
        p_tokens_used: tokensUsed,
        p_processing_time_ms: 0,
        p_encryption_version: 'v1'
      });

    if (userMsgError) {
      console.error('❌ Failed to save user message to messages table:', userMsgError);
    } else {
      const userMessageResult = Array.isArray(userMessage) ? userMessage[0] : userMessage;
      console.log('✅ Step 5b: Successfully saved user message to messages table:', userMessageResult?.id);
    }
    
    // Save agent response
    if (agentResponse) {
      console.log('🔍 Step 5c: Saving agent response to messages table...');
      
      // Encrypt agent response content
      const agentMessageEncrypted = encryptText(agentResponse.content);
      const crypto = await import('crypto');
      const agentMessageHash = crypto.createHash('sha256').update(agentResponse.content).digest('hex');
      
      // Note: XAI data encryption variables removed as they were not being used

      // Save agent message to messages table using safe function
      const { data: agentMessage, error: agentMsgError } = await supabaseServer
        .rpc('insert_message_safe', {
          p_conversation_id: conversation.id,
          p_content_encrypted: agentMessageEncrypted,
          p_content_hash: agentMessageHash,
          p_sender_type: 'agent',
          p_message_type: 'text',
          p_metadata_encrypted: encryptObject({
            tokens_used: agentResponse.tokens_used,
            processing_time_ms: agentResponse.processing_time_ms,
            confidence_score: agentResponse.metadata?.confidence_score,
            files_referenced: agentResponse.metadata?.files_referenced,
            sql_query: (agentResponse.metadata as Record<string, unknown>)?.sql_query,
            sql_queries: agentResponse.sql_queries,
            graph_data: agentResponse.graph_data,
            xai_metrics: agentResponse.xai_metrics,
            agent_thinking_notes: agentResponse.agent_thinking_notes,
            reasoning_explanation: agentResponse.reasoning_explanation,
            start_time: (agentResponse.metadata as Record<string, unknown>)?.start_time,
            end_time: (agentResponse.metadata as Record<string, unknown>)?.end_time,
            token_tracking: agentResponse.token_tracking
          }),
          p_tokens_used: agentResponse.tokens_used || 0,
          p_processing_time_ms: agentResponse.processing_time_ms || 0,
          p_encryption_version: 'v1'
        });

      if (agentMsgError) {
        console.error('❌ Failed to save agent message to messages table:', agentMsgError);
      } else {
        const agentMessageResult = Array.isArray(agentMessage) ? agentMessage[0] : agentMessage;
        console.log('✅ Step 5c: Successfully saved agent message to messages table:', agentMessageResult?.id);
      }
    }

    // Update conversation last_message_at
    await supabaseServer
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

    // Deduct credits for the AI processing
    const { calculateCreditsForTokens, deductCredits, logCreditUsage } = await import('@/lib/credit-utils')
    const creditsUsed = calculateCreditsForTokens(agentResponse?.tokens_used || 0)
    let creditResult: { success: boolean; error?: string; remainingCredits?: number } | null = null
    
    if (creditsUsed > 0) {
      console.log(`💳 Step 6: Deducting ${creditsUsed} credits for ${agentResponse?.tokens_used} tokens used`)
      
      creditResult = await deductCredits(
        tokenPayload.userId, 
        creditsUsed, 
        `API Agent Usage - Agent ${agentId}`
      )
      
      if (!creditResult.success) {
        console.error('❌ Step 6: Credit deduction failed:', creditResult.error)
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ Step 6: Successfully deducted ${creditsUsed} credits. Remaining: ${creditResult.remainingCredits}`)
        
        // Log credit usage for analytics
        await logCreditUsage(
          tokenPayload.userId,
          agentId,
          conversation.id,
          agentResponse?.tokens_used || 0,
          creditsUsed,
          `API Agent Usage - Agent ${agentId}`
        )
      }
    }

    console.log('✅ Step 5: Successfully saved to messages table');

    const response: ChatResponse = {
      response_text: responseText,
      response_image_url: responseImageUrl || undefined,
      conversation_id, // Return original conversation_id to client
      credits_used: creditsUsed,
      credits_remaining: creditResult?.remainingCredits,
      processing_time_ms: processingTime,
      // Include all agent metadata if available
      ...(agentResponse && {
        // Basic metadata
        sql_query: agentResponse.metadata?.sql_query,
        
        // Data sources (use enhanced data if available, fallback to basic)
        data_sources: agentResponse.data_sources || 
          (Array.isArray(agentResponse.metadata?.files_referenced) 
            ? agentResponse.metadata.files_referenced.map(fileId => ({
                file_id: fileId,
                file_name: `File ${fileId}`,
                relevance_score: agentResponse.metadata?.confidence_score || 0.8,
                sections_used: []
              }))
            : []),
        
        // RAG context (use enhanced data if available, fallback to basic)
        rag_context: agentResponse.rag_context ? {
          retrieved_chunks: agentResponse.rag_context.retrieved_chunks,
          similarity_scores: Array.isArray(agentResponse.rag_context.similarity_scores) 
            ? agentResponse.rag_context.similarity_scores.map((score: unknown) => typeof score === 'number' ? score : 0)
            : [],
          source_documents: agentResponse.rag_context.source_documents
        } : {
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
        
        // Explainability (use enhanced data if available, fallback to basic)
        explainability: agentResponse.explainability || {
          reasoning_steps: [`Processed ${Array.isArray(agentResponse.metadata?.files_referenced) ? agentResponse.metadata.files_referenced.length : 0} files`],
          confidence_score: agentResponse.metadata?.confidence_score || 0.8,
          uncertainty_factors: (typeof agentResponse.metadata?.confidence_score === 'number' && agentResponse.metadata.confidence_score < 0.7)
            ? ['Low confidence in analysis'] 
            : []
        },
        
        // XAI Metrics (only include if available)
        ...(agentResponse.xai_metrics && { xai_metrics: agentResponse.xai_metrics }),
        
        // Agent Thinking Notes (only include if available)
        ...(agentResponse.agent_thinking_notes && { agent_thinking_notes: agentResponse.agent_thinking_notes }),
        
        // SQL Queries (only include if available)
        ...(agentResponse.sql_queries && { sql_queries: agentResponse.sql_queries }),
        
        // Graph Data (only include if available)
        ...(agentResponse.graph_data && { graph_data: agentResponse.graph_data }),
        
        // Error Details (only include if available)
        ...(agentResponse.error_details && { error_details: agentResponse.error_details }),
        
        // Reasoning Explanation
        reasoning_explanation: agentResponse.reasoning_explanation,
        
        // Analysis Depth
        analysis_depth: agentResponse.analysis_depth,
        
        // Data Quality Scores
        data_quality_score: agentResponse.data_quality_score,
        response_completeness_score: agentResponse.response_completeness_score,
        user_satisfaction_prediction: agentResponse.user_satisfaction_prediction,
        
        // Token Tracking
        token_tracking: agentResponse.token_tracking
      })
    };

    // Step 6: Deduct credits after successful processing
    console.log('🔍 Step 6: Deducting credits...');
    const creditsToDeduct = Math.ceil(tokensUsed / 1000) * 10; // 10 credits per 1000 tokens
    const deductResult = await deductCredits(
      tokenPayload.userId, 
      creditsToDeduct, 
      `Agent API usage - ${agent.name}`
    );
    
    if (!deductResult.success) {
      console.error('❌ Failed to deduct credits:', deductResult.error);
      // Don't fail the request, just log the error
    } else {
      console.log(`✅ Successfully deducted ${creditsToDeduct} credits. Remaining: ${deductResult.remainingCredits}`);
      // Update the response with remaining credits
      response.credits_remaining = deductResult.remainingCredits;
    }

    console.log('✅ Step 7: Response sent successfully');
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
        credits_used: 'number',
        credits_remaining: 'number (optional)',
        processing_time_ms: 'number'
      }
    },
    { status: 200 }
  );
}
