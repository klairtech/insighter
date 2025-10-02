/**
 * ML Learning Hook
 * 
 * This hook provides ML-powered learning capabilities for the frontend
 * Compatible with Next.js, Vercel, and Supabase
 */

import { useState, useCallback } from 'react'

export interface MLPrediction {
  strategy: string
  confidence: number
  reasoning: string
  expected_success_rate: number
}

export interface LearningInsights {
  query_patterns: {
    successful_patterns: string[]
    failure_patterns: string[]
    user_preferences: Record<string, any>
  }
  agent_optimizations: {
    agent_type: string
    recommended_strategy: string
    success_rate_improvement: number
  }[]
  data_source_recommendations: {
    source_id: string
    relevance_score: number
    usage_frequency: number
  }[]
}

export interface MLFeatures {
  query_length: number
  query_complexity: number
  conversation_length: number
  previous_failures: number
  time_of_day: number
  day_of_week: number
  user_experience_level: number
  workspace_data_sources_count: number
  query_entities: string[]
  query_intent: string
  context_similarity: number
}

export function useMLLearning() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Get ML strategy prediction for a query
   */
  const predictStrategy = useCallback(async (
    query: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    workspaceId: string,
    userId: string
  ): Promise<{
    prediction: MLPrediction
    features: MLFeatures
    learningInsights: LearningInsights
  } | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ml/predict-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          conversationHistory,
          workspaceId,
          userId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get ML prediction')
      }

      return {
        prediction: data.prediction,
        features: data.features,
        learningInsights: data.learningInsights
      }
    } catch (_err) {
      const errorMessage = _err instanceof Error ? _err.message : 'Unknown error'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get learning insights for a workspace/user
   */
  const getLearningInsights = useCallback(async (
    workspaceId: string,
    userId: string
  ): Promise<LearningInsights | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ml/predict-strategy?workspaceId=${workspaceId}&userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get learning insights')
      }

      return data.learningInsights
    } catch (_err) {
      const errorMessage = _err instanceof Error ? _err.message : 'Unknown error'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Learn from user interaction
   */
  const learnFromInteraction = useCallback(async (interactionData: {
    user_id: string
    workspace_id: string
    agent_id: string
    original_query: string
    optimized_query?: string
    query_intent: string
    query_entities: string[]
    processing_strategy: string
    data_sources_used: string[]
    execution_time_ms: number
    success: boolean
    failure_reason?: string
    user_satisfaction_score?: number
    user_feedback?: string
  }): Promise<boolean> => {
    try {
      const response = await fetch('/api/ml/learn-from-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interactionData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.success
    } catch (_err) {
      return false
    }
  }, [])

  /**
   * Provide user feedback for ML learning
   */
  const provideFeedback = useCallback(async (
    interactionId: string,
    satisfactionScore: number,
    feedback?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/ml/learn-from-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interaction_id: interactionId,
          user_satisfaction_score: satisfactionScore,
          user_feedback: feedback
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.success
    } catch (_err) {
      return false
    }
  }, [])

  return {
    predictStrategy,
    getLearningInsights,
    learnFromInteraction,
    provideFeedback,
    isLoading,
    error
  }
}
