/**
 * XAI (eXplainable AI) Metrics and Analysis Types
 * These types define the structure for comprehensive AI transparency and analysis
 */

// XAI Metrics Structure
export interface XAIMetrics {
  confidence_score: number; // 0.0 - 1.0
  uncertainty_score: number; // 0.0 - 1.0
  interpretability_score: number; // 0.0 - 1.0
  model_confidence: number; // 0.0 - 1.0
  data_quality_score: number; // 0.0 - 1.0
  response_completeness_score: number; // 0.0 - 1.0
  user_satisfaction_prediction: number; // 0.0 - 1.0
  bias_detection_score: number; // 0.0 - 1.0
  ethical_compliance_score: number; // 0.0 - 1.0
  performance_efficiency_score: number; // 0.0 - 1.0
  explanation_quality_score: number; // 0.0 - 1.0
  decision_transparency_score: number; // 0.0 - 1.0
}

// Agent Thinking Notes Structure
export interface AgentThinkingNotes {
  initial_analysis: string;
  reasoning_process: string[];
  decision_points: DecisionPoint[];
  alternative_approaches: AlternativeApproach[];
  validation_checks: ValidationCheck[];
  confidence_assessment: string;
  uncertainty_areas: string[];
  learning_insights: string[];
  improvement_suggestions: string[];
}

export interface DecisionPoint {
  id: string;
  description: string;
  options: string[];
  chosen_option: string;
  reasoning: string;
  confidence: number;
  impact_assessment: string;
}

export interface AlternativeApproach {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  feasibility_score: number;
  expected_outcome: string;
  why_not_chosen: string;
}

export interface ValidationCheck {
  id: string;
  type: 'logical' | 'factual' | 'consistency' | 'completeness' | 'accuracy';
  description: string;
  result: 'passed' | 'failed' | 'warning';
  details: string;
  confidence: number;
}

// SQL Queries Structure
export interface SQLQueries {
  queries: SQLQuery[];
  execution_plan: ExecutionPlan;
  performance_metrics: PerformanceMetrics;
  optimization_suggestions: string[];
  data_sources: DataSource[];
  schema_changes: SchemaChange[];
}

export interface SQLQuery {
  id: string;
  query_text: string;
  purpose: string;
  execution_time_ms: number;
  rows_affected: number;
  cost_estimate: number;
  optimization_applied: string[];
  indexes_used: string[];
  tables_accessed: string[];
  joins_performed: JoinInfo[];
}

export interface ExecutionPlan {
  plan_id: string;
  total_cost: number;
  execution_time_ms: number;
  steps: ExecutionStep[];
  bottlenecks: Bottleneck[];
  optimization_opportunities: string[];
}

export interface ExecutionStep {
  step_id: string;
  operation: string;
  cost: number;
  rows: number;
  time_ms: number;
  details: string;
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'lock';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export interface PerformanceMetrics {
  total_execution_time_ms: number;
  cpu_usage_percent: number;
  memory_usage_mb: number;
  disk_io_operations: number;
  network_requests: number;
  cache_hit_ratio: number;
  query_efficiency_score: number;
}

export interface DataSource {
  name: string;
  type: 'table' | 'view' | 'function' | 'external_api';
  size_estimate: number;
  last_updated: string;
  quality_score: number;
  access_frequency: number;
}

export interface SchemaChange {
  type: 'index_created' | 'index_dropped' | 'table_modified' | 'view_updated';
  description: string;
  impact: string;
  rollback_plan: string;
}

export interface JoinInfo {
  left_table: string;
  right_table: string;
  join_type: 'inner' | 'left' | 'right' | 'full' | 'cross';
  condition: string;
  efficiency: number;
}

// Graph and Visualization Structure
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutConfig;
  styling: StylingConfig;
  interactions: InteractionConfig;
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'entity' | 'concept' | 'relationship' | 'attribute' | 'process';
  properties: Record<string, unknown>;
  position: { x: number; y: number };
  size: number;
  color: string;
  opacity: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'relationship' | 'dependency' | 'flow' | 'hierarchy';
  weight: number;
  properties: Record<string, unknown>;
  style: EdgeStyle;
}

export interface EdgeStyle {
  width: number;
  color: string;
  opacity: number;
  dashArray: number[];
  arrowSize: number;
}

export interface LayoutConfig {
  algorithm: 'force' | 'hierarchical' | 'circular' | 'grid' | 'custom';
  parameters: Record<string, unknown>;
  iterations: number;
  convergence_threshold: number;
}

export interface StylingConfig {
  node_styles: Record<string, NodeStyle>;
  edge_styles: Record<string, EdgeStyle>;
  color_scheme: string;
  theme: 'light' | 'dark' | 'custom';
}

export interface NodeStyle {
  size: number;
  color: string;
  opacity: number;
  border_width: number;
  border_color: string;
  shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'custom';
}

export interface InteractionConfig {
  zoom_enabled: boolean;
  pan_enabled: boolean;
  selection_enabled: boolean;
  drag_enabled: boolean;
  hover_effects: boolean;
  click_actions: ClickAction[];
}

export interface ClickAction {
  trigger: 'single_click' | 'double_click' | 'right_click';
  action: 'select' | 'expand' | 'collapse' | 'highlight' | 'custom';
  parameters: Record<string, unknown>;
}

export interface GraphMetadata {
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  version: string;
  author: string;
  tags: string[];
  complexity_score: number;
  node_count: number;
  edge_count: number;
}

// Visualization Configuration
export interface VisualizationConfig {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'network' | 'tree' | 'sankey';
  dimensions: Dimension[];
  measures: Measure[];
  filters: Filter[];
  styling: ChartStyling;
  interactions: ChartInteraction[];
  animations: AnimationConfig;
}

export interface Dimension {
  name: string;
  type: 'categorical' | 'temporal' | 'geographical' | 'hierarchical';
  values: unknown[];
  formatting: FormattingConfig;
}

export interface Measure {
  name: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  formatting: FormattingConfig;
  color: string;
}

export interface Filter {
  dimension: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: unknown;
  active: boolean;
}

export interface FormattingConfig {
  number_format: string;
  date_format: string;
  currency_symbol: string;
  decimal_places: number;
  thousand_separator: string;
}

export interface ChartStyling {
  colors: string[];
  fonts: FontConfig;
  spacing: SpacingConfig;
  borders: BorderConfig;
  background: BackgroundConfig;
}

export interface FontConfig {
  family: string;
  size: number;
  weight: 'normal' | 'bold' | 'lighter';
  color: string;
}

export interface SpacingConfig {
  margin: number;
  padding: number;
  gap: number;
}

export interface BorderConfig {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  radius: number;
}

export interface BackgroundConfig {
  color: string;
  opacity: number;
  image?: string;
}

export interface ChartInteraction {
  type: 'hover' | 'click' | 'zoom' | 'pan' | 'select';
  enabled: boolean;
  parameters: Record<string, unknown>;
}

export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: string;
  delay: number;
  loop: boolean;
}

// Compliance and Ethics Structure
export interface ComplianceChecks {
  gdpr_compliance: ComplianceResult;
  ccpa_compliance: ComplianceResult;
  hipaa_compliance: ComplianceResult;
  sox_compliance: ComplianceResult;
  industry_standards: ComplianceResult[];
  custom_requirements: ComplianceResult[];
}

export interface ComplianceResult {
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  evidence: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  remediation: string[];
  last_checked: string;
}

export interface BiasDetectionResults {
  gender_bias: BiasMetric;
  racial_bias: BiasMetric;
  age_bias: BiasMetric;
  socioeconomic_bias: BiasMetric;
  cultural_bias: BiasMetric;
  overall_bias_score: number;
  recommendations: string[];
}

export interface BiasMetric {
  score: number; // 0.0 - 1.0 (lower is better)
  confidence: number;
  evidence: string[];
  impact_assessment: string;
  mitigation_strategies: string[];
}

export interface EthicalConsiderations {
  fairness: EthicalMetric;
  transparency: EthicalMetric;
  accountability: EthicalMetric;
  privacy: EthicalMetric;
  autonomy: EthicalMetric;
  beneficence: EthicalMetric;
  non_maleficence: EthicalMetric;
  overall_ethical_score: number;
}

export interface EthicalMetric {
  score: number; // 0.0 - 1.0
  assessment: string;
  concerns: string[];
  recommendations: string[];
  monitoring_plan: string;
}

// Performance and Optimization Structure
export interface PerformanceAnalysis {
  response_time_ms: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  network_latency_ms: number;
  cache_hit_ratio: number;
  error_rate: number;
  throughput_requests_per_second: number;
  scalability_assessment: ScalabilityAssessment;
  bottleneck_analysis: BottleneckAnalysis;
  optimization_recommendations: OptimizationRecommendation[];
}

export interface ScalabilityAssessment {
  current_capacity: number;
  projected_capacity: number;
  growth_rate: number;
  scaling_strategy: string;
  resource_requirements: ResourceRequirement[];
  timeline: string;
}

export interface ResourceRequirement {
  type: 'cpu' | 'memory' | 'storage' | 'network' | 'database';
  current_usage: number;
  projected_usage: number;
  unit: string;
  cost_estimate: number;
}

export interface BottleneckAnalysis {
  primary_bottleneck: Bottleneck;
  secondary_bottlenecks: Bottleneck[];
  impact_assessment: string;
  mitigation_strategies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationRecommendation {
  category: 'performance' | 'cost' | 'scalability' | 'reliability' | 'security';
  description: string;
  expected_improvement: string;
  implementation_effort: 'low' | 'medium' | 'high';
  cost_benefit_ratio: number;
  timeline: string;
  dependencies: string[];
}

// Main Message Interface with XAI Data
export interface MessageWithXAIData {
  // Core message fields
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'agent' | 'system';
  content_encrypted: string;
  content_hash: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  metadata_encrypted?: string;
  tokens_used: number;
  processing_time_ms: number;
  encryption_version: string;
  api_request_id?: string;
  api_response_metadata: Record<string, unknown>;
  created_at: string;

  // XAI Metrics
  xai_metrics_encrypted?: string;
  confidence_score?: number;
  reasoning_explanation_encrypted?: string;
  decision_factors_encrypted?: string;
  uncertainty_indicators_encrypted?: string;
  model_interpretability_score?: number;

  // Agent Thinking Notes
  agent_thinking_notes_encrypted?: string;
  reasoning_steps_encrypted?: string;
  internal_analysis_encrypted?: string;
  decision_tree_encrypted?: string;
  alternative_approaches_encrypted?: string;
  validation_checks_encrypted?: string;

  // SQL Queries
  sql_queries_encrypted?: string;
  query_execution_plan_encrypted?: string;
  database_schema_used_encrypted?: string;
  query_performance_metrics_encrypted?: string;
  data_sources_accessed_encrypted?: string;
  query_optimization_notes_encrypted?: string;

  // Graph and Visualization
  graph_data_encrypted?: string;
  visualization_config_encrypted?: string;
  chart_metadata_encrypted?: string;
  data_transformation_steps_encrypted?: string;
  rendering_instructions_encrypted?: string;
  interactive_features_encrypted?: string;

  // Analysis Metadata
  analysis_depth?: 'surface' | 'moderate' | 'deep' | 'comprehensive';
  data_quality_score?: number;
  response_completeness_score?: number;
  user_satisfaction_prediction?: number;

  // Compliance and Ethics
  compliance_checks_encrypted?: string;
  bias_detection_results_encrypted?: string;
  ethical_considerations_encrypted?: string;
  data_privacy_notes_encrypted?: string;
  regulatory_compliance_encrypted?: string;

  // Performance and Optimization
  optimization_suggestions_encrypted?: string;
  performance_analysis_encrypted?: string;
  resource_usage_metrics_encrypted?: string;
  scalability_notes_encrypted?: string;
  bottleneck_analysis_encrypted?: string;
}

// Decrypted Message Interface (for use in application)
export interface DecryptedMessageWithXAIData extends Omit<MessageWithXAIData, 
  'xai_metrics_encrypted' | 'reasoning_explanation_encrypted' | 'decision_factors_encrypted' | 
  'uncertainty_indicators_encrypted' | 'agent_thinking_notes_encrypted' | 'reasoning_steps_encrypted' |
  'internal_analysis_encrypted' | 'decision_tree_encrypted' | 'alternative_approaches_encrypted' |
  'validation_checks_encrypted' | 'sql_queries_encrypted' | 'query_execution_plan_encrypted' |
  'database_schema_used_encrypted' | 'query_performance_metrics_encrypted' | 'data_sources_accessed_encrypted' |
  'query_optimization_notes_encrypted' | 'graph_data_encrypted' | 'visualization_config_encrypted' |
  'chart_metadata_encrypted' | 'data_transformation_steps_encrypted' | 'rendering_instructions_encrypted' |
  'interactive_features_encrypted' | 'compliance_checks_encrypted' | 'bias_detection_results_encrypted' |
  'ethical_considerations_encrypted' | 'data_privacy_notes_encrypted' | 'regulatory_compliance_encrypted' |
  'optimization_suggestions_encrypted' | 'performance_analysis_encrypted' | 'resource_usage_metrics_encrypted' |
  'scalability_notes_encrypted' | 'bottleneck_analysis_encrypted'
> {
  // Decrypted XAI data
  xai_metrics?: XAIMetrics;
  reasoning_explanation?: string;
  decision_factors?: Record<string, unknown>;
  uncertainty_indicators?: Record<string, unknown>;
  agent_thinking_notes?: AgentThinkingNotes;
  reasoning_steps?: Record<string, unknown>;
  internal_analysis?: string;
  decision_tree?: Record<string, unknown>;
  alternative_approaches?: AlternativeApproach[];
  validation_checks?: ValidationCheck[];

  // Decrypted SQL data
  sql_queries?: SQLQueries;
  query_execution_plan?: ExecutionPlan;
  database_schema_used?: Record<string, unknown>;
  query_performance_metrics?: PerformanceMetrics;
  data_sources_accessed?: DataSource[];
  query_optimization_notes?: string;

  // Decrypted Graph data
  graph_data?: GraphData;
  visualization_config?: VisualizationConfig;
  chart_metadata?: Record<string, unknown>;
  data_transformation_steps?: Record<string, unknown>;
  rendering_instructions?: string;
  interactive_features?: Record<string, unknown>;

  // Decrypted Compliance data
  compliance_checks?: ComplianceChecks;
  bias_detection_results?: BiasDetectionResults;
  ethical_considerations?: EthicalConsiderations;
  data_privacy_notes?: string;
  regulatory_compliance?: Record<string, unknown>;

  // Decrypted Performance data
  optimization_suggestions?: string;
  performance_analysis?: PerformanceAnalysis;
  resource_usage_metrics?: Record<string, unknown>;
  scalability_notes?: string;
  bottleneck_analysis?: BottleneckAnalysis;
}

// Utility types for encryption/decryption
export type EncryptedField = string;
export type DecryptedField<T> = T;

// Helper type for creating encrypted message data
export interface CreateMessageWithXAIData {
  conversation_id: string;
  sender_type: 'user' | 'agent' | 'system';
  content: string;
  message_type?: 'text' | 'image' | 'file' | 'system';
  
  // XAI data to be encrypted
  xai_metrics?: XAIMetrics;
  reasoning_explanation?: string;
  decision_factors?: Record<string, unknown>;
  uncertainty_indicators?: Record<string, unknown>;
  agent_thinking_notes?: AgentThinkingNotes;
  reasoning_steps?: Record<string, unknown>;
  internal_analysis?: string;
  decision_tree?: Record<string, unknown>;
  alternative_approaches?: AlternativeApproach[];
  validation_checks?: ValidationCheck[];
  
  // SQL data to be encrypted
  sql_queries?: SQLQueries;
  query_execution_plan?: ExecutionPlan;
  database_schema_used?: Record<string, unknown>;
  query_performance_metrics?: PerformanceMetrics;
  data_sources_accessed?: DataSource[];
  query_optimization_notes?: string;
  
  // Graph data to be encrypted
  graph_data?: GraphData;
  visualization_config?: VisualizationConfig;
  chart_metadata?: Record<string, unknown>;
  data_transformation_steps?: Record<string, unknown>;
  rendering_instructions?: string;
  interactive_features?: Record<string, unknown>;
  
  // Compliance data to be encrypted
  compliance_checks?: ComplianceChecks;
  bias_detection_results?: BiasDetectionResults;
  ethical_considerations?: EthicalConsiderations;
  data_privacy_notes?: string;
  regulatory_compliance?: Record<string, unknown>;
  
  // Performance data to be encrypted
  optimization_suggestions?: string;
  performance_analysis?: PerformanceAnalysis;
  resource_usage_metrics?: Record<string, unknown>;
  scalability_notes?: string;
  bottleneck_analysis?: BottleneckAnalysis;
  
  // Analysis metadata
  analysis_depth?: 'surface' | 'moderate' | 'deep' | 'comprehensive';
  data_quality_score?: number;
  response_completeness_score?: number;
  user_satisfaction_prediction?: number;
}
