-- Simplified Messages Table Schema
-- This is the new, clean structure after removing redundant fields
-- All metadata is now stored in metadata_encrypted field

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['user'::text, 'agent'::text, 'system'::text])),
  content_encrypted text NOT NULL,
  content_hash text NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text CHECK (message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'system'::text])),
  metadata_encrypted text, -- Contains all SQL queries, graph data, XAI metrics, etc.
  tokens_used integer DEFAULT 0,
  processing_time_ms integer DEFAULT 0,
  encryption_version text DEFAULT 'v1'::text CHECK (encryption_version = ANY (ARRAY['v1'::text, 'v2'::text, 'v3'::text])),
  api_request_id text,
  api_response_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Essential non-encrypted fields for quick access
  confidence_score real CHECK (confidence_score >= 0.0::double precision AND confidence_score <= 1.0::double precision),
  model_interpretability_score real CHECK (model_interpretability_score >= 0.0::double precision AND model_interpretability_score <= 1.0::double precision),
  analysis_depth text CHECK (analysis_depth = ANY (ARRAY['surface'::text, 'moderate'::text, 'deep'::text, 'comprehensive'::text])),
  data_quality_score real CHECK (data_quality_score >= 0.0::double precision AND data_quality_score <= 1.0::double precision),
  response_completeness_score real CHECK (response_completeness_score >= 0.0::double precision AND response_completeness_score <= 1.0::double precision),
  user_satisfaction_prediction real CHECK (user_satisfaction_prediction >= 0.0::double precision AND user_satisfaction_prediction <= 1.0::double precision),
  
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);

-- Example of what metadata_encrypted contains:
/*
{
  "tokens_used": 17179,
  "processing_time_ms": 42091,
  "confidence_score": 0.7,
  "files_referenced": [],
  "sql_queries": ["SELECT location, COUNT(*) AS donor_count FROM view_user_data_rean GROUP BY location;"],
  "graph_data": {
    "labels": ["Hyderabad", "Rangareddy", "Ananthapur", ...],
    "values": [5495, 549, 169, ...],
    "chart_type": "bar",
    "chart_title": "Donor Distribution by Location"
  },
  "xai_metrics": {
    "confidence_score": 0.7,
    "reasoning_steps": ["Analyzed 1 data sources", "Successfully processed 1 sources"],
    "uncertainty_factors": ["Limited to available data sources"],
    "data_quality_score": 1,
    "response_completeness_score": 0.8,
    "user_satisfaction_prediction": 0.85
  },
  "agent_thinking_notes": ["Query validation and analysis", "File relevance assessment", ...],
  "reasoning_explanation": "Based on the analysis of the database query...",
  "token_tracking": {
    "userInputTokens": 15,
    "systemPromptTokens": 1200,
    "contextTokens": 500,
    "totalTokensUsed": 17179
  }
}
*/
