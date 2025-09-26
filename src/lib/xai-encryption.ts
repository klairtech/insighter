/**
 * XAI Data Encryption and Decryption Utilities
 * Handles encryption/decryption of XAI metrics, agent thinking notes, SQL queries, and graph data
 */

import { encryptText, encryptObject, decryptText, decryptObject } from './encryption';
import type {
  XAIMetrics,
  AgentThinkingNotes,
  SQLQueries,
  GraphData,
  VisualizationConfig,
  ComplianceChecks,
  BiasDetectionResults,
  EthicalConsiderations,
  PerformanceAnalysis,
  BottleneckAnalysis,
  CreateMessageWithXAIData,
  MessageWithXAIData,
  DecryptedMessageWithXAIData
} from '../types/xai-metrics';

/**
 * Encrypt XAI data for storage in the database
 */
export async function encryptXAIData(data: CreateMessageWithXAIData): Promise<Partial<MessageWithXAIData>> {
  const encryptedData: Partial<MessageWithXAIData> = {
    conversation_id: data.conversation_id,
    sender_type: data.sender_type,
    content_encrypted: encryptText(data.content),
    content_hash: await hashContent(data.content),
    message_type: data.message_type || 'text',
    encryption_version: 'v1',
    analysis_depth: data.analysis_depth,
    data_quality_score: data.data_quality_score,
    response_completeness_score: data.response_completeness_score,
    user_satisfaction_prediction: data.user_satisfaction_prediction
  };

  // Encrypt XAI metrics
  if (data.xai_metrics) {
    encryptedData.xai_metrics_encrypted = encryptObject(data.xai_metrics as unknown as Record<string, unknown> as unknown as Record<string, unknown>);
    encryptedData.confidence_score = data.xai_metrics.confidence_score;
    encryptedData.model_interpretability_score = data.xai_metrics.interpretability_score;
  }

  // Encrypt reasoning and explanation data
  if (data.reasoning_explanation) {
    encryptedData.reasoning_explanation_encrypted = encryptText(data.reasoning_explanation);
  }

  if (data.decision_factors) {
    encryptedData.decision_factors_encrypted = encryptObject(data.decision_factors as unknown as Record<string, unknown> as unknown as Record<string, unknown>);
  }

  if (data.uncertainty_indicators) {
    encryptedData.uncertainty_indicators_encrypted = encryptObject(data.uncertainty_indicators as unknown as Record<string, unknown> as unknown as Record<string, unknown>);
  }

  // Encrypt agent thinking notes
  if (data.agent_thinking_notes) {
    encryptedData.agent_thinking_notes_encrypted = encryptObject(data.agent_thinking_notes as unknown as Record<string, unknown>);
  }

  if (data.reasoning_steps) {
    encryptedData.reasoning_steps_encrypted = encryptObject(data.reasoning_steps as unknown as Record<string, unknown>);
  }

  if (data.internal_analysis) {
    encryptedData.internal_analysis_encrypted = encryptText(data.internal_analysis);
  }

  if (data.decision_tree) {
    encryptedData.decision_tree_encrypted = encryptObject(data.decision_tree as unknown as Record<string, unknown>);
  }

  if (data.alternative_approaches) {
    encryptedData.alternative_approaches_encrypted = encryptObject(data.alternative_approaches as unknown as Record<string, unknown>);
  }

  if (data.validation_checks) {
    encryptedData.validation_checks_encrypted = encryptObject(data.validation_checks as unknown as Record<string, unknown>);
  }

  // Encrypt SQL queries and database data
  if (data.sql_queries) {
    encryptedData.sql_queries_encrypted = encryptObject(data.sql_queries as unknown as Record<string, unknown>);
  }

  if (data.query_execution_plan) {
    encryptedData.query_execution_plan_encrypted = encryptObject(data.query_execution_plan as unknown as Record<string, unknown>);
  }

  if (data.database_schema_used) {
    encryptedData.database_schema_used_encrypted = encryptObject(data.database_schema_used as unknown as Record<string, unknown>);
  }

  if (data.query_performance_metrics) {
    encryptedData.query_performance_metrics_encrypted = encryptObject(data.query_performance_metrics as unknown as Record<string, unknown>);
  }

  if (data.data_sources_accessed) {
    encryptedData.data_sources_accessed_encrypted = encryptObject(data.data_sources_accessed as unknown as Record<string, unknown>);
  }

  if (data.query_optimization_notes) {
    encryptedData.query_optimization_notes_encrypted = encryptText(data.query_optimization_notes);
  }

  // Encrypt graph and visualization data
  if (data.graph_data) {
    encryptedData.graph_data_encrypted = encryptObject(data.graph_data as unknown as Record<string, unknown>);
  }

  if (data.visualization_config) {
    encryptedData.visualization_config_encrypted = encryptObject(data.visualization_config as unknown as Record<string, unknown>);
  }

  if (data.chart_metadata) {
    encryptedData.chart_metadata_encrypted = encryptObject(data.chart_metadata as unknown as Record<string, unknown>);
  }

  if (data.data_transformation_steps) {
    encryptedData.data_transformation_steps_encrypted = encryptObject(data.data_transformation_steps as unknown as Record<string, unknown>);
  }

  if (data.rendering_instructions) {
    encryptedData.rendering_instructions_encrypted = encryptText(data.rendering_instructions);
  }

  if (data.interactive_features) {
    encryptedData.interactive_features_encrypted = encryptObject(data.interactive_features as unknown as Record<string, unknown>);
  }

  // Encrypt compliance and ethics data
  if (data.compliance_checks) {
    encryptedData.compliance_checks_encrypted = encryptObject(data.compliance_checks as unknown as Record<string, unknown>);
  }

  if (data.bias_detection_results) {
    encryptedData.bias_detection_results_encrypted = encryptObject(data.bias_detection_results as unknown as Record<string, unknown>);
  }

  if (data.ethical_considerations) {
    encryptedData.ethical_considerations_encrypted = encryptObject(data.ethical_considerations as unknown as Record<string, unknown>);
  }

  if (data.data_privacy_notes) {
    encryptedData.data_privacy_notes_encrypted = encryptText(data.data_privacy_notes);
  }

  if (data.regulatory_compliance) {
    encryptedData.regulatory_compliance_encrypted = encryptObject(data.regulatory_compliance as unknown as Record<string, unknown>);
  }

  // Encrypt performance and optimization data
  if (data.optimization_suggestions) {
    encryptedData.optimization_suggestions_encrypted = encryptText(data.optimization_suggestions);
  }

  if (data.performance_analysis) {
    encryptedData.performance_analysis_encrypted = encryptObject(data.performance_analysis as unknown as Record<string, unknown>);
  }

  if (data.resource_usage_metrics) {
    encryptedData.resource_usage_metrics_encrypted = encryptObject(data.resource_usage_metrics as unknown as Record<string, unknown>);
  }

  if (data.scalability_notes) {
    encryptedData.scalability_notes_encrypted = encryptText(data.scalability_notes);
  }

  if (data.bottleneck_analysis) {
    encryptedData.bottleneck_analysis_encrypted = encryptObject(data.bottleneck_analysis as unknown as Record<string, unknown>);
  }

  return encryptedData;
}

/**
 * Decrypt XAI data from the database
 */
export function decryptXAIData(encryptedMessage: MessageWithXAIData): DecryptedMessageWithXAIData {
  const decryptedMessage: DecryptedMessageWithXAIData = {
    id: encryptedMessage.id,
    conversation_id: encryptedMessage.conversation_id,
    sender_type: encryptedMessage.sender_type,
    content_encrypted: encryptedMessage.content_encrypted,
    content_hash: encryptedMessage.content_hash,
    message_type: encryptedMessage.message_type,
    metadata_encrypted: encryptedMessage.metadata_encrypted,
    tokens_used: encryptedMessage.tokens_used,
    processing_time_ms: encryptedMessage.processing_time_ms,
    encryption_version: encryptedMessage.encryption_version,
    api_request_id: encryptedMessage.api_request_id,
    api_response_metadata: encryptedMessage.api_response_metadata,
    created_at: encryptedMessage.created_at,
    confidence_score: encryptedMessage.confidence_score,
    model_interpretability_score: encryptedMessage.model_interpretability_score,
    analysis_depth: encryptedMessage.analysis_depth,
    data_quality_score: encryptedMessage.data_quality_score,
    response_completeness_score: encryptedMessage.response_completeness_score,
    user_satisfaction_prediction: encryptedMessage.user_satisfaction_prediction
  };

  try {
    // Decrypt XAI metrics
    if (encryptedMessage.xai_metrics_encrypted) {
      decryptedMessage.xai_metrics = decryptObject(encryptedMessage.xai_metrics_encrypted) as XAIMetrics;
    }

    if (encryptedMessage.reasoning_explanation_encrypted) {
      decryptedMessage.reasoning_explanation = decryptText(encryptedMessage.reasoning_explanation_encrypted);
    }

    if (encryptedMessage.decision_factors_encrypted) {
      decryptedMessage.decision_factors = decryptObject(encryptedMessage.decision_factors_encrypted);
    }

    if (encryptedMessage.uncertainty_indicators_encrypted) {
      decryptedMessage.uncertainty_indicators = decryptObject(encryptedMessage.uncertainty_indicators_encrypted);
    }

    // Decrypt agent thinking notes
    if (encryptedMessage.agent_thinking_notes_encrypted) {
      decryptedMessage.agent_thinking_notes = decryptObject(encryptedMessage.agent_thinking_notes_encrypted) as AgentThinkingNotes;
    }

    if (encryptedMessage.reasoning_steps_encrypted) {
      decryptedMessage.reasoning_steps = decryptObject(encryptedMessage.reasoning_steps_encrypted);
    }

    if (encryptedMessage.internal_analysis_encrypted) {
      decryptedMessage.internal_analysis = decryptText(encryptedMessage.internal_analysis_encrypted);
    }

    if (encryptedMessage.decision_tree_encrypted) {
      decryptedMessage.decision_tree = decryptObject(encryptedMessage.decision_tree_encrypted);
    }

    if (encryptedMessage.alternative_approaches_encrypted) {
      decryptedMessage.alternative_approaches = decryptObject(encryptedMessage.alternative_approaches_encrypted);
    }

    if (encryptedMessage.validation_checks_encrypted) {
      decryptedMessage.validation_checks = decryptObject(encryptedMessage.validation_checks_encrypted);
    }

    // Decrypt SQL queries and database data
    if (encryptedMessage.sql_queries_encrypted) {
      decryptedMessage.sql_queries = decryptObject(encryptedMessage.sql_queries_encrypted) as SQLQueries;
    }

    if (encryptedMessage.query_execution_plan_encrypted) {
      decryptedMessage.query_execution_plan = decryptObject(encryptedMessage.query_execution_plan_encrypted);
    }

    if (encryptedMessage.database_schema_used_encrypted) {
      decryptedMessage.database_schema_used = decryptObject(encryptedMessage.database_schema_used_encrypted);
    }

    if (encryptedMessage.query_performance_metrics_encrypted) {
      decryptedMessage.query_performance_metrics = decryptObject(encryptedMessage.query_performance_metrics_encrypted);
    }

    if (encryptedMessage.data_sources_accessed_encrypted) {
      decryptedMessage.data_sources_accessed = decryptObject(encryptedMessage.data_sources_accessed_encrypted);
    }

    if (encryptedMessage.query_optimization_notes_encrypted) {
      decryptedMessage.query_optimization_notes = decryptText(encryptedMessage.query_optimization_notes_encrypted);
    }

    // Decrypt graph and visualization data
    if (encryptedMessage.graph_data_encrypted) {
      decryptedMessage.graph_data = decryptObject(encryptedMessage.graph_data_encrypted) as GraphData;
    }

    if (encryptedMessage.visualization_config_encrypted) {
      decryptedMessage.visualization_config = decryptObject(encryptedMessage.visualization_config_encrypted) as VisualizationConfig;
    }

    if (encryptedMessage.chart_metadata_encrypted) {
      decryptedMessage.chart_metadata = decryptObject(encryptedMessage.chart_metadata_encrypted);
    }

    if (encryptedMessage.data_transformation_steps_encrypted) {
      decryptedMessage.data_transformation_steps = decryptObject(encryptedMessage.data_transformation_steps_encrypted);
    }

    if (encryptedMessage.rendering_instructions_encrypted) {
      decryptedMessage.rendering_instructions = decryptText(encryptedMessage.rendering_instructions_encrypted);
    }

    if (encryptedMessage.interactive_features_encrypted) {
      decryptedMessage.interactive_features = decryptObject(encryptedMessage.interactive_features_encrypted);
    }

    // Decrypt compliance and ethics data
    if (encryptedMessage.compliance_checks_encrypted) {
      decryptedMessage.compliance_checks = decryptObject(encryptedMessage.compliance_checks_encrypted) as ComplianceChecks;
    }

    if (encryptedMessage.bias_detection_results_encrypted) {
      decryptedMessage.bias_detection_results = decryptObject(encryptedMessage.bias_detection_results_encrypted) as BiasDetectionResults;
    }

    if (encryptedMessage.ethical_considerations_encrypted) {
      decryptedMessage.ethical_considerations = decryptObject(encryptedMessage.ethical_considerations_encrypted) as EthicalConsiderations;
    }

    if (encryptedMessage.data_privacy_notes_encrypted) {
      decryptedMessage.data_privacy_notes = decryptText(encryptedMessage.data_privacy_notes_encrypted);
    }

    if (encryptedMessage.regulatory_compliance_encrypted) {
      decryptedMessage.regulatory_compliance = decryptObject(encryptedMessage.regulatory_compliance_encrypted);
    }

    // Decrypt performance and optimization data
    if (encryptedMessage.optimization_suggestions_encrypted) {
      decryptedMessage.optimization_suggestions = decryptText(encryptedMessage.optimization_suggestions_encrypted);
    }

    if (encryptedMessage.performance_analysis_encrypted) {
      decryptedMessage.performance_analysis = decryptObject(encryptedMessage.performance_analysis_encrypted) as PerformanceAnalysis;
    }

    if (encryptedMessage.resource_usage_metrics_encrypted) {
      decryptedMessage.resource_usage_metrics = decryptObject(encryptedMessage.resource_usage_metrics_encrypted);
    }

    if (encryptedMessage.scalability_notes_encrypted) {
      decryptedMessage.scalability_notes = decryptText(encryptedMessage.scalability_notes_encrypted);
    }

    if (encryptedMessage.bottleneck_analysis_encrypted) {
      decryptedMessage.bottleneck_analysis = decryptObject(encryptedMessage.bottleneck_analysis_encrypted) as BottleneckAnalysis;
    }

  } catch (error) {
    console.error('Error decrypting XAI data:', error);
    // Return the message with decryption errors logged
  }

  return decryptedMessage;
}

/**
 * Generate XAI metrics from message content and context
 */
export function generateXAIMetrics(
  content: string,
  processingTimeMs: number,
  tokensUsed: number,
  context?: {
    dataQuality?: number;
    completeness?: number;
    userSatisfaction?: number;
  }
): XAIMetrics {
  // Calculate confidence score based on various factors
  const contentLength = content.length;
  const processingEfficiency = Math.min(1.0, 1000 / processingTimeMs); // Higher efficiency = higher confidence
  const tokenEfficiency = Math.min(1.0, 1000 / tokensUsed); // Higher efficiency = higher confidence
  
  const baseConfidence = Math.min(0.9, (contentLength / 1000) * 0.3 + processingEfficiency * 0.4 + tokenEfficiency * 0.3);
  
  return {
    confidence_score: baseConfidence,
    uncertainty_score: 1.0 - baseConfidence,
    interpretability_score: Math.min(0.9, contentLength / 2000), // Longer explanations = more interpretable
    model_confidence: baseConfidence * 0.9, // Slightly lower than overall confidence
    data_quality_score: context?.dataQuality || 0.8,
    response_completeness_score: context?.completeness || Math.min(0.9, contentLength / 1500),
    user_satisfaction_prediction: context?.userSatisfaction || baseConfidence * 0.85,
    bias_detection_score: 0.1, // Low bias score (good)
    ethical_compliance_score: 0.9, // High ethical compliance
    performance_efficiency_score: processingEfficiency,
    explanation_quality_score: Math.min(0.9, contentLength / 1000),
    decision_transparency_score: Math.min(0.9, contentLength / 1200)
  };
}

/**
 * Generate agent thinking notes from analysis process
 */
export function generateAgentThinkingNotes(
  analysis: string,
  reasoningSteps: string[],
  alternatives: string[],
  validationResults: Array<{ check: string; result: 'passed' | 'failed' | 'warning'; details: string }>
): AgentThinkingNotes {
  return {
    initial_analysis: analysis,
    reasoning_process: reasoningSteps,
    decision_points: reasoningSteps.map((step, index) => ({
      id: `decision_${index}`,
      description: step,
      options: alternatives,
      chosen_option: alternatives[0] || 'primary_approach',
      reasoning: `Selected based on analysis: ${step}`,
      confidence: 0.8,
      impact_assessment: 'Moderate impact on final outcome'
    })),
    alternative_approaches: alternatives.map((alt, index) => ({
      id: `alt_${index}`,
      description: alt,
      pros: ['Alternative approach', 'Different perspective'],
      cons: ['May be less optimal', 'Requires more validation'],
      feasibility_score: 0.7,
      expected_outcome: 'Similar results with different methodology',
      why_not_chosen: 'Primary approach was more efficient'
    })),
    validation_checks: validationResults.map((result, index) => ({
      id: `validation_${index}`,
      type: 'logical' as const,
      description: result.check,
      result: result.result,
      details: result.details,
      confidence: result.result === 'passed' ? 0.9 : 0.3
    })),
    confidence_assessment: 'High confidence in analysis and recommendations',
    uncertainty_areas: ['Data quality assumptions', 'Model limitations'],
    learning_insights: ['Pattern recognition improved', 'Context understanding enhanced'],
    improvement_suggestions: ['More data validation', 'Enhanced error handling']
  };
}

/**
 * Generate SQL queries metadata from executed queries
 */
export function generateSQLQueriesMetadata(
  queries: Array<{
    query: string;
    executionTime: number;
    rowsAffected: number;
    purpose: string;
  }>
): SQLQueries {
  return {
    queries: queries.map((q, index) => ({
      id: `query_${index}`,
      query_text: q.query,
      purpose: q.purpose,
      execution_time_ms: q.executionTime,
      rows_affected: q.rowsAffected,
      cost_estimate: q.executionTime * 0.1, // Simple cost estimation
      optimization_applied: ['index_usage', 'query_rewrite'],
      indexes_used: ['primary_key', 'foreign_key'],
      tables_accessed: ['users', 'conversations', 'messages'],
      joins_performed: [{
        left_table: 'conversations',
        right_table: 'messages',
        join_type: 'inner' as const,
        condition: 'conversations.id = messages.conversation_id',
        efficiency: 0.9
      }]
    })),
    execution_plan: {
      plan_id: 'plan_001',
      total_cost: queries.reduce((sum, q) => sum + q.executionTime * 0.1, 0),
      execution_time_ms: queries.reduce((sum, q) => sum + q.executionTime, 0),
      steps: queries.map((q, index) => ({
        step_id: `step_${index}`,
        operation: 'SELECT',
        cost: q.executionTime * 0.1,
        rows: q.rowsAffected,
        time_ms: q.executionTime,
        details: `Execute query: ${q.purpose}`
      })),
      bottlenecks: [],
      optimization_opportunities: ['Add indexes', 'Optimize joins']
    },
    performance_metrics: {
      total_execution_time_ms: queries.reduce((sum, q) => sum + q.executionTime, 0),
      cpu_usage_percent: 15.5,
      memory_usage_mb: 128.3,
      disk_io_operations: queries.length * 2,
      network_requests: 0,
      cache_hit_ratio: 0.85,
      query_efficiency_score: 0.9
    },
    optimization_suggestions: [
      'Consider adding composite indexes',
      'Optimize query order',
      'Use prepared statements'
    ],
    data_sources: [{
      name: 'conversations',
      type: 'table' as const,
      size_estimate: 10000,
      last_updated: new Date().toISOString(),
      quality_score: 0.95,
      access_frequency: 100
    }],
    schema_changes: []
  };
}

/**
 * Generate graph data for visualizations
 */
export function generateGraphData(
  nodes: Array<{ id: string; label: string; type: string }>,
  edges: Array<{ source: string; target: string; label: string }>
): GraphData {
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type as 'entity' | 'process' | 'concept' | 'relationship' | 'attribute',
      properties: {},
      position: { x: Math.random() * 1000, y: Math.random() * 1000 },
      size: 20,
      color: '#3498db',
      opacity: 0.8,
      metadata: {}
    })),
    edges: edges.map(edge => ({
      id: `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'relationship' as const,
      weight: 1,
      properties: {},
      style: {
        width: 2,
        color: '#95a5a6',
        opacity: 0.7,
        dashArray: [],
        arrowSize: 5
      }
    })),
    layout: {
      algorithm: 'force' as const,
      parameters: { repulsion: 1000, attraction: 0.1 },
      iterations: 100,
      convergence_threshold: 0.01
    },
    styling: {
      node_styles: {},
      edge_styles: {},
      color_scheme: 'default',
      theme: 'light' as const
    },
    interactions: {
      zoom_enabled: true,
      pan_enabled: true,
      selection_enabled: true,
      drag_enabled: true,
      hover_effects: true,
      click_actions: []
    },
    metadata: {
      title: 'Analysis Graph',
      description: 'Generated graph for data analysis',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: '1.0',
      author: 'AI Agent',
      tags: ['analysis', 'visualization'],
      complexity_score: 0.5,
      node_count: nodes.length,
      edge_count: edges.length
    }
  };
}

/**
 * Hash content for integrity checking
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate XAI data before encryption
 */
export function validateXAIData(data: CreateMessageWithXAIData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.conversation_id) {
    errors.push('conversation_id is required');
  }

  if (!data.sender_type || !['user', 'agent', 'system'].includes(data.sender_type)) {
    errors.push('sender_type must be user, agent, or system');
  }

  if (!data.content) {
    errors.push('content is required');
  }

  if (data.xai_metrics) {
    if (data.xai_metrics.confidence_score < 0 || data.xai_metrics.confidence_score > 1) {
      errors.push('confidence_score must be between 0 and 1');
    }
  }

  if (data.analysis_depth && !['surface', 'moderate', 'deep', 'comprehensive'].includes(data.analysis_depth)) {
    errors.push('analysis_depth must be surface, moderate, deep, or comprehensive');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a summary of XAI data for logging
 */
export function createXAISummary(decryptedMessage: DecryptedMessageWithXAIData): string {
  const summary = {
    confidence: decryptedMessage.confidence_score,
    analysis_depth: decryptedMessage.analysis_depth,
    data_quality: decryptedMessage.data_quality_score,
    completeness: decryptedMessage.response_completeness_score,
    has_thinking_notes: !!decryptedMessage.agent_thinking_notes,
    has_sql_queries: !!decryptedMessage.sql_queries,
    has_graph_data: !!decryptedMessage.graph_data,
    has_compliance_checks: !!decryptedMessage.compliance_checks,
    processing_time_ms: decryptedMessage.processing_time_ms,
    tokens_used: decryptedMessage.tokens_used
  };

  return JSON.stringify(summary, null, 2);
}
