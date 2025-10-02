/**
 * Common types and interfaces for all agents in the multi-agent flow
 */

import { XAIMetrics } from '@/types/xai-metrics';
import { TokenTrackingData } from '@/lib/token-utils';

// Additional interfaces for API responses
export interface RAGContext {
  retrieved_chunks: number;
  similarity_scores: unknown[];
  source_documents: string[];
}

export interface Explainability {
  reasoning_steps: string[];
  confidence_score: unknown;
  uncertainty_factors: string[];
}

export interface DataSource {
  source_id?: string;
  source_name?: string;
  relevance_score: unknown;
  sections_used?: string[];
}

export interface AgentResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: {
    processing_time_ms: number;
    tokens_used: number;
    confidence_score?: number;
    [key: string]: unknown;
  };
}

export interface ConversationMessage {
  sender_type: string;
  content: string;
  created_at: string;
}

export interface AgentContext {
  userQuery: string;
  workspaceId: string;
  conversationHistory: ConversationMessage[];
  userId?: string;
  selectedDataSources?: string[];
  [key: string]: unknown;
}

export interface BaseAgent {
  name: string;
  description: string;
  execute(context: AgentContext): Promise<AgentResponse>;
}

// Specific agent response types
export interface GuardrailsResponse {
  allowed: boolean;
  reason?: string;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
  suggested_alternatives?: string[];
  flagged_keywords?: string[];
}

export interface PromptEngineeringResponse {
  optimized_query: string;
  query_type: 'analytical' | 'exploratory' | 'comparative' | 'temporal' | 'aggregation';
  intent_analysis: {
    primary_intent: string;
    secondary_intents: string[];
    entities: string[];
    time_references: string[];
    data_requirements: string[];
  };
  optimization_notes: string;
  confidence: number;
}

export interface DataSourceFilterResponse {
  filtered_sources: Array<{
    id: string;
    name: string;
    type: string;
    connection_type: string;
    relevance_score: number;
    ai_summary?: string;
    schema?: Record<string, unknown>;
  }>;
  filter_metadata: {
    total_sources_analyzed: number;
    sources_filtered: number;
    filter_criteria: string[];
    processing_time_ms: number;
    tokens_used: number;
    estimated_credits: number;
    user_selected_sources: number;
  };
  confidence_score: number;
}

export interface DataSourceRankingResponse {
  ranked_sources: Array<{
    source: Record<string, unknown>;
    priority_score: number;
    processing_strategy: 'parallel' | 'sequential' | 'hybrid';
    estimated_complexity: 'low' | 'medium' | 'high';
    recommended_approach: string;
  }>;
  processing_plan: {
    total_sources: number;
    parallel_sources: number;
    sequential_sources: number;
    estimated_time_ms: number;
    resource_requirements: string[];
  };
  confidence_score: number;
}

export interface DatabaseExecutionResult {
  source_id: string;
  source_name: string;
  source_type: string;
  success: boolean;
  data?: Array<Record<string, unknown>>;
  error?: string;
  query_executed?: string;
  execution_time_ms: number;
  row_count: number;
  schema_info?: {
    columns: Array<{name: string, type: string}>;
    table_name: string;
    database_type: string;
  };
  metadata: {
    tokens_used: number;
    estimated_credits: number;
    processing_strategy: string;
  };
}

export interface MultiSourceQAResponse {
  answer: string;
  confidence: number;
  sources_used: string[];
  reasoning: string;
  follow_up_suggestions: string[];
  data_summary: {
    total_records: number;
    sources_analyzed: number;
    key_insights: string[];
  };
  metadata: {
    processing_time_ms: number;
    tokens_used: number;
    estimated_credits: number;
  };
}

export interface VisualAgentResponse {
  should_visualize: boolean;
  visualization_type?: 'chart' | 'table' | 'graph' | 'map' | 'dashboard';
  visualization_config?: {
    chart_type: string;
    data_mapping: Record<string, unknown>;
    styling: Record<string, unknown>;
    interactivity: Record<string, unknown>;
  };
  reasoning: string;
  confidence: number;
  alternative_visualizations?: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

export interface GreetingAgentResponse {
  isGreeting: boolean;
  response?: string;
  greetingType?: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none';
  confidence: number;
  reasoning?: string;
}

export interface ValidationAgentResponse {
  is_valid: boolean;
  query_type: 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation' | 'clarification';
  confidence: number;
  intent_analysis: {
    primary_intent: string;
    secondary_intents: string[];
    entities: string[];
    time_references: string[];
    data_requirements: string[];
  };
  requires_follow_up?: boolean;
  follow_up_context?: string;
  reasoning?: string;
}

export interface DatabaseExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_sources: number;
  failed_sources: number;
  total_rows_retrieved: number;
  execution_summary: {
    sources_processed: number;
    queries_executed: number;
    average_execution_time_ms: number;
    success_rate: number;
  };
}

export interface ExternalSearchAgentResponse {
  search_results: Array<{
    source: string;
    title: string;
    content: string;
    url?: string;
    relevance_score: number;
    source_type: 'web' | 'api' | 'external_connection';
  }>;
  total_results: number;
  search_summary: {
    sources_searched: number;
    successful_searches: number;
    failed_searches: number;
    average_relevance_score: number;
  };
  external_data_used: string[];
}

export interface FileExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_files: number;
  failed_files: number;
  total_data_extracted: number;
  file_processing_summary: {
    files_processed: number;
    successful_extractions: number;
    failed_extractions: number;
    average_extraction_time_ms: number;
    success_rate: number;
  };
}

export interface DatabaseExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_queries: number;
  failed_queries: number;
  total_rows_retrieved: number;
  database_processing_summary: {
    databases_processed: number;
    queries_executed: number;
    successful_queries: number;
    failed_queries: number;
    average_execution_time_ms: number;
    success_rate: number;
  };
}

export interface ExternalExecutionAgentResponse {
  execution_results: DatabaseExecutionResult[];
  total_execution_time_ms: number;
  successful_connections: number;
  failed_connections: number;
  total_data_retrieved: number;
  external_processing_summary: {
    connections_processed: number;
    successful_api_calls: number;
    failed_api_calls: number;
    average_execution_time_ms: number;
    success_rate: number;
  };
}

export interface EnhancedAgentResponse {
  content: string;
  success: boolean;
  data_sources_used: string[];
  processing_time_ms: number;
  tokens_used: number;
  estimated_credits: number;
  confidence_score: number;
  follow_up_suggestions: string[];
  visualization?: {
    type: string;
    config: Record<string, unknown>;
    data: Record<string, unknown>;
  };
  metadata: {
    agents_executed: string[];
    fallback_used: boolean;
    context_analysis: Record<string, unknown>;
    processing_strategy: string;
  };
  error?: string;
  // XAI and detailed metadata fields
  xai_metrics?: XAIMetrics;
  agent_thinking_notes?: string[];
  sql_queries?: string[];
  all_queries?: string[];
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
