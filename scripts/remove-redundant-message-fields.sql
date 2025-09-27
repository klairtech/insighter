-- Migration: Remove redundant encrypted fields from messages table
-- All data is now stored in metadata_encrypted field
-- Date: 2025-09-27

-- Start transaction
BEGIN;

-- First, drop any views that depend on the columns we're about to remove
-- This will prevent dependency errors
DROP VIEW IF EXISTS public.messages_with_xai CASCADE;
DROP VIEW IF EXISTS public.messages_with_metadata CASCADE;
DROP VIEW IF EXISTS public.messages_with_sql CASCADE;
DROP VIEW IF EXISTS public.messages_with_graph CASCADE;
DROP VIEW IF EXISTS public.messages_with_xai_metrics CASCADE;

-- Drop all redundant encrypted fields from messages table
-- These fields are no longer needed as all data is stored in metadata_encrypted

ALTER TABLE public.messages DROP COLUMN IF EXISTS xai_metrics_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS reasoning_explanation_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS decision_factors_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS uncertainty_indicators_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS agent_thinking_notes_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS reasoning_steps_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS internal_analysis_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS decision_tree_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS alternative_approaches_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS validation_checks_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS sql_queries_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS query_execution_plan_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS database_schema_used_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS query_performance_metrics_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS data_sources_accessed_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS query_optimization_notes_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS graph_data_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS visualization_config_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS chart_metadata_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS data_transformation_steps_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS rendering_instructions_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS interactive_features_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS compliance_checks_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS bias_detection_results_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS ethical_considerations_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS data_privacy_notes_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS regulatory_compliance_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS optimization_suggestions_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS performance_analysis_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS resource_usage_metrics_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS scalability_notes_encrypted;
ALTER TABLE public.messages DROP COLUMN IF EXISTS bottleneck_analysis_encrypted;

-- Recreate essential views with the new simplified structure
-- Note: These views now read from metadata_encrypted instead of separate columns

-- Create a view for messages with XAI data (now from metadata_encrypted)
CREATE OR REPLACE VIEW public.messages_with_xai AS
SELECT 
  m.id,
  m.conversation_id,
  m.sender_type,
  m.content_encrypted,
  m.content_hash,
  m.message_type,
  m.metadata_encrypted,
  m.tokens_used,
  m.processing_time_ms,
  m.encryption_version,
  m.api_request_id,
  m.api_response_metadata,
  m.created_at,
  m.confidence_score,
  m.model_interpretability_score,
  m.analysis_depth,
  m.data_quality_score,
  m.response_completeness_score,
  m.user_satisfaction_prediction
FROM public.messages m
WHERE m.metadata_encrypted IS NOT NULL;

-- Create a view for messages with SQL queries
CREATE OR REPLACE VIEW public.messages_with_sql AS
SELECT 
  m.id,
  m.conversation_id,
  m.sender_type,
  m.content_encrypted,
  m.metadata_encrypted,
  m.tokens_used,
  m.processing_time_ms,
  m.created_at,
  m.confidence_score
FROM public.messages m
WHERE m.metadata_encrypted IS NOT NULL
AND m.sender_type = 'agent';

-- Create a view for messages with graph/visualization data
CREATE OR REPLACE VIEW public.messages_with_graph AS
SELECT 
  m.id,
  m.conversation_id,
  m.sender_type,
  m.content_encrypted,
  m.metadata_encrypted,
  m.tokens_used,
  m.processing_time_ms,
  m.created_at,
  m.confidence_score
FROM public.messages m
WHERE m.metadata_encrypted IS NOT NULL
AND m.sender_type = 'agent';

-- Commit transaction
COMMIT;

-- Verification query to check remaining columns
-- Run this after the migration to verify the table structure
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;
*/

-- Expected remaining columns after migration:
-- id, conversation_id, sender_type, content_encrypted, content_hash, 
-- message_type, metadata_encrypted, tokens_used, processing_time_ms, 
-- encryption_version, api_request_id, api_response_metadata, created_at,
-- confidence_score, model_interpretability_score, analysis_depth,
-- data_quality_score, response_completeness_score, user_satisfaction_prediction
