-- Rollback Migration: Restore redundant encrypted fields to messages table
-- Use this only if you need to revert the changes
-- Date: 2025-09-27

-- Start transaction
BEGIN;

-- Add back all the redundant encrypted fields
-- Note: This will add empty columns - existing data will be lost

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS xai_metrics_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reasoning_explanation_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS decision_factors_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS uncertainty_indicators_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS agent_thinking_notes_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reasoning_steps_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS internal_analysis_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS decision_tree_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS alternative_approaches_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS validation_checks_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sql_queries_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS query_execution_plan_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS database_schema_used_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS query_performance_metrics_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS data_sources_accessed_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS query_optimization_notes_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS graph_data_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS visualization_config_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS chart_metadata_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS data_transformation_steps_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS rendering_instructions_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS interactive_features_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS compliance_checks_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bias_detection_results_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS ethical_considerations_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS data_privacy_notes_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS regulatory_compliance_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS optimization_suggestions_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS performance_analysis_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS resource_usage_metrics_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS scalability_notes_encrypted text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bottleneck_analysis_encrypted text;

-- Commit transaction
COMMIT;

-- Note: This rollback will restore the table structure but will NOT restore
-- any data that was previously stored in these fields, as that data is now
-- consolidated in the metadata_encrypted field.
