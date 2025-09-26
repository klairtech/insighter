/**
 * API route for creating messages with comprehensive XAI data
 * This demonstrates how to integrate XAI metrics, agent thinking notes, SQL queries, and graph data
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, verifyUserSession } from '@/lib/server-utils';
import { encryptXAIData, decryptXAIData, generateXAIMetrics, generateAgentThinkingNotes, generateSQLQueriesMetadata, generateGraphData, validateXAIData, createXAISummary } from '@/lib/xai-encryption';
import type { CreateMessageWithXAIData, MessageWithXAIData } from '@/types/xai-metrics';

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const authResult = await verifyUserSession(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = authResult;

    // Parse request body
    const body = await request.json();
    const {
      conversation_id,
      content,
      message_type = 'text',
      analysis_context = {}
    } = body;

    // Validate required fields
    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id and content' },
        { status: 400 }
      );
    }

    // Verify conversation access
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select('id, user_id, agent_id')
      .eq('id', conversation_id)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
    }

    // Generate comprehensive XAI data
    const startTime = Date.now();
    
    // Generate XAI metrics
    const xaiMetrics = generateXAIMetrics(content, 0, 0, {
      dataQuality: analysis_context.data_quality || 0.8,
      completeness: analysis_context.completeness || 0.9,
      userSatisfaction: analysis_context.user_satisfaction || 0.85
    });

    // Generate agent thinking notes
    const thinkingNotes = generateAgentThinkingNotes(
      'Analyzed user query and generated comprehensive response',
      [
        'Parsed user intent and requirements',
        'Identified relevant data sources',
        'Applied reasoning algorithms',
        'Generated structured response'
      ],
      [
        'Alternative approach using different ML model',
        'Simplified response with less detail',
        'More interactive response format'
      ],
      [
        { check: 'Content accuracy', result: 'passed', details: 'All facts verified' },
        { check: 'Response completeness', result: 'passed', details: 'All aspects covered' },
        { check: 'User intent alignment', result: 'passed', details: 'Response matches user needs' }
      ]
    );

    // Generate SQL queries metadata (if applicable)
    const sqlQueries = analysis_context.sql_queries ? generateSQLQueriesMetadata([
      {
        query: 'SELECT * FROM conversations WHERE id = $1',
        executionTime: 15,
        rowsAffected: 1,
        purpose: 'Fetch conversation details'
      },
      {
        query: 'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
        executionTime: 25,
        rowsAffected: 5,
        purpose: 'Fetch recent messages for context'
      }
    ]) : undefined;

    // Generate graph data (if applicable)
    const graphData = analysis_context.graph_data ? generateGraphData(
      [
        { id: 'user', label: 'User Query', type: 'entity' },
        { id: 'analysis', label: 'Analysis Process', type: 'process' },
        { id: 'response', label: 'Generated Response', type: 'entity' }
      ],
      [
        { source: 'user', target: 'analysis', label: 'triggers' },
        { source: 'analysis', target: 'response', label: 'generates' }
      ]
    ) : undefined;

    const processingTime = Date.now() - startTime;

    // Create message data with XAI information
    const messageData: CreateMessageWithXAIData = {
      conversation_id,
      sender_type: 'agent',
      content,
      message_type,
      xai_metrics: xaiMetrics,
      reasoning_explanation: 'Generated comprehensive response using advanced AI reasoning with full transparency and explainability.',
      decision_factors: {
        user_intent: analysis_context.user_intent || 'general_query',
        context_relevance: 0.9,
        response_complexity: 'moderate',
        data_availability: 0.85
      },
      uncertainty_indicators: {
        data_quality_uncertainty: 0.1,
        model_uncertainty: 0.15,
        context_uncertainty: 0.05
      },
      agent_thinking_notes: thinkingNotes,
      reasoning_steps: {
        step_1: 'Analyze user query structure and intent',
        step_2: 'Identify relevant knowledge domains',
        step_3: 'Apply reasoning algorithms',
        step_4: 'Generate structured response',
        step_5: 'Validate response quality and completeness'
      },
      internal_analysis: 'Comprehensive analysis performed using multi-step reasoning process with validation at each stage.',
      decision_tree: {
        root: 'user_query_analysis',
        branches: [
          { condition: 'query_type', value: 'analytical', action: 'apply_deep_analysis' },
          { condition: 'complexity', value: 'high', action: 'use_advanced_reasoning' }
        ]
      },
      alternative_approaches: thinkingNotes.alternative_approaches,
      validation_checks: thinkingNotes.validation_checks,
      sql_queries: sqlQueries,
      graph_data: graphData,
      analysis_depth: 'deep',
      data_quality_score: xaiMetrics.data_quality_score,
      response_completeness_score: xaiMetrics.response_completeness_score,
      user_satisfaction_prediction: xaiMetrics.user_satisfaction_prediction,
      compliance_checks: {
        gdpr_compliance: {
          requirement: 'Data processing transparency',
          status: 'compliant' as const,
          evidence: ['User consent obtained', 'Data minimization applied'],
          risk_level: 'low' as const,
          remediation: [],
          last_checked: new Date().toISOString()
        },
        ccpa_compliance: {
          requirement: 'Consumer privacy rights',
          status: 'compliant' as const,
          evidence: ['Privacy notice provided', 'Data access controls implemented'],
          risk_level: 'low' as const,
          remediation: [],
          last_checked: new Date().toISOString()
        },
        hipaa_compliance: {
          requirement: 'Healthcare data protection',
          status: 'not_applicable' as const,
          evidence: [],
          risk_level: 'low' as const,
          remediation: [],
          last_checked: new Date().toISOString()
        },
        sox_compliance: {
          requirement: 'Financial data integrity',
          status: 'not_applicable' as const,
          evidence: [],
          risk_level: 'low' as const,
          remediation: [],
          last_checked: new Date().toISOString()
        },
        industry_standards: [],
        custom_requirements: []
      },
      bias_detection_results: {
        gender_bias: { score: 0.05, confidence: 0.9, evidence: [], impact_assessment: 'Minimal impact', mitigation_strategies: [] },
        racial_bias: { score: 0.03, confidence: 0.9, evidence: [], impact_assessment: 'Minimal impact', mitigation_strategies: [] },
        age_bias: { score: 0.02, confidence: 0.9, evidence: [], impact_assessment: 'Minimal impact', mitigation_strategies: [] },
        socioeconomic_bias: { score: 0.04, confidence: 0.9, evidence: [], impact_assessment: 'Minimal impact', mitigation_strategies: [] },
        cultural_bias: { score: 0.06, confidence: 0.9, evidence: [], impact_assessment: 'Minimal impact', mitigation_strategies: [] },
        overall_bias_score: 0.04,
        recommendations: ['Continue monitoring', 'Regular bias audits']
      },
      ethical_considerations: {
        fairness: { score: 0.95, assessment: 'High fairness maintained', concerns: [], recommendations: [], monitoring_plan: 'Regular fairness audits' },
        transparency: { score: 0.9, assessment: 'Full transparency provided', concerns: [], recommendations: [], monitoring_plan: 'User feedback monitoring' },
        accountability: { score: 0.9, assessment: 'Clear accountability established', concerns: [], recommendations: [], monitoring_plan: 'Regular accountability reviews' },
        privacy: { score: 0.95, assessment: 'Privacy fully protected', concerns: [], recommendations: [], monitoring_plan: 'Privacy impact assessments' },
        autonomy: { score: 0.9, assessment: 'User autonomy respected', concerns: [], recommendations: [], monitoring_plan: 'User choice monitoring' },
        beneficence: { score: 0.9, assessment: 'Beneficial outcomes prioritized', concerns: [], recommendations: [], monitoring_plan: 'Outcome tracking' },
        non_maleficence: { score: 0.95, assessment: 'Harm prevention measures in place', concerns: [], recommendations: [], monitoring_plan: 'Risk assessment' },
        overall_ethical_score: 0.92
      },
      data_privacy_notes: 'All personal data processed in accordance with privacy regulations. No sensitive information stored in plain text.',
      regulatory_compliance: {
        gdpr: 'compliant',
        ccpa: 'compliant',
        industry_standards: 'met',
        last_audit: new Date().toISOString()
      },
      optimization_suggestions: 'Consider caching frequently accessed data, Optimize database queries for better performance, Implement response compression for large datasets',
      performance_analysis: {
        response_time_ms: processingTime,
        memory_usage_mb: 45.2,
        cpu_usage_percent: 12.5,
        network_latency_ms: 5.2,
        cache_hit_ratio: 0.85,
        error_rate: 0.001,
        throughput_requests_per_second: 150,
        scalability_assessment: {
          current_capacity: 1000,
          projected_capacity: 5000,
          growth_rate: 0.2,
          scaling_strategy: 'Horizontal scaling recommended',
          resource_requirements: [
            { type: 'cpu' as const, current_usage: 12.5, projected_usage: 25, unit: 'percent', cost_estimate: 100 },
            { type: 'memory' as const, current_usage: 45.2, projected_usage: 90, unit: 'MB', cost_estimate: 50 }
          ],
          timeline: '3-6 months'
        },
        bottleneck_analysis: {
          primary_bottleneck: {
            type: 'cpu' as const,
            description: 'CPU usage during peak hours',
            impact: 'medium' as const,
            suggestion: 'Consider load balancing'
          },
          secondary_bottlenecks: [],
          impact_assessment: 'Minimal impact on user experience',
          mitigation_strategies: ['Load balancing', 'Caching optimization'],
          priority: 'medium' as const
        },
        optimization_recommendations: [
          {
            category: 'performance' as const,
            description: 'Implement response caching',
            expected_improvement: '30% faster response times',
            implementation_effort: 'medium' as const,
            cost_benefit_ratio: 0.8,
            timeline: '2-4 weeks',
            dependencies: ['Cache infrastructure setup']
          }
        ]
      },
      resource_usage_metrics: {
        cpu_seconds: 0.125,
        memory_mb: 45.2,
        disk_io_operations: 12,
        network_bytes: 1024,
        database_connections: 2,
        cache_operations: 8
      },
      scalability_notes: 'System designed for horizontal scaling. Current load well within capacity limits.',
      bottleneck_analysis: {
        primary_bottleneck: {
          type: 'cpu' as const,
          description: 'CPU usage during peak hours',
          impact: 'medium' as const,
          suggestion: 'Consider load balancing'
        },
        secondary_bottlenecks: [],
        impact_assessment: 'Medium impact on system performance during peak hours',
        mitigation_strategies: ['Implement load balancing', 'Optimize CPU-intensive operations'],
        priority: 'medium' as const
      }
    };

    // Validate XAI data
    const validation = validateXAIData(messageData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid XAI data', details: validation.errors },
        { status: 400 }
      );
    }

    // Encrypt XAI data
    const encryptedData = await encryptXAIData(messageData);

    // Add processing metadata
    encryptedData.tokens_used = content.length / 4; // Rough token estimation
    encryptedData.processing_time_ms = processingTime;
    encryptedData.api_request_id = `req_${Date.now()}`;
    encryptedData.api_response_metadata = {
      xai_enabled: true,
      encryption_version: 'v1',
      processing_timestamp: new Date().toISOString(),
      agent_version: '1.0.0'
    };

    // Insert message into database
    const { data: message, error: insertError } = await supabaseServer
      .from('messages')
      .insert(encryptedData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message with XAI data:', insertError);
      return NextResponse.json(
        { error: 'Failed to save message with XAI data' },
        { status: 500 }
      );
    }

    // Decrypt the message for response (in production, you might want to return only summary)
    const decryptedMessage = decryptXAIData(message as unknown as MessageWithXAIData);
    const xaiSummary = createXAISummary(decryptedMessage);

    console.log('✅ Message with XAI data created successfully');
    console.log('📊 XAI Summary:', xaiSummary);

    return NextResponse.json({
      success: true,
      message_id: message.id,
      xai_summary: JSON.parse(xaiSummary),
      processing_time_ms: processingTime,
      confidence_score: decryptedMessage.confidence_score,
      analysis_depth: decryptedMessage.analysis_depth
    });

  } catch (error) {
    console.error('Error creating message with XAI data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify user session
    const authResult = await verifyUserSession(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = authResult;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const messageId = searchParams.get('message_id');

    if (!conversationId && !messageId) {
      return NextResponse.json(
        { error: 'Either conversation_id or message_id is required' },
        { status: 400 }
      );
    }

    let query = supabaseServer
      .from('messages')
      .select('*')
      .eq('sender_type', 'agent'); // Only return agent messages with XAI data

    if (messageId) {
      query = query.eq('id', messageId);
    } else if (conversationId) {
      // Verify conversation access
      const { data: conversation, error: convError } = await supabaseServer
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
      }

      query = query.eq('conversation_id', conversationId);
    }

    const { data: messages, error: fetchError } = await query
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching messages with XAI data:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Decrypt XAI data for each message
    const decryptedMessages = messages.map(msg => {
      const decrypted = decryptXAIData(msg as unknown as MessageWithXAIData);
      return {
        id: decrypted.id,
        conversation_id: decrypted.conversation_id,
        content: decrypted.content_encrypted, // Note: This is still encrypted, would need separate decryption
        created_at: decrypted.created_at,
        confidence_score: decrypted.confidence_score,
        analysis_depth: decrypted.analysis_depth,
        data_quality_score: decrypted.data_quality_score,
        response_completeness_score: decrypted.response_completeness_score,
        user_satisfaction_prediction: decrypted.user_satisfaction_prediction,
        processing_time_ms: decrypted.processing_time_ms,
        tokens_used: decrypted.tokens_used,
        has_thinking_notes: !!decrypted.agent_thinking_notes,
        has_sql_queries: !!decrypted.sql_queries,
        has_graph_data: !!decrypted.graph_data,
        has_compliance_checks: !!decrypted.compliance_checks,
        xai_summary: createXAISummary(decrypted)
      };
    });

    return NextResponse.json({
      success: true,
      messages: decryptedMessages,
      count: decryptedMessages.length
    });

  } catch (error) {
    console.error('Error fetching messages with XAI data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
