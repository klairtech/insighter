/**
 * ML Model Training API
 * 
 * This endpoint can be called as a Vercel Cron Job to train ML models
 * Compatible with Next.js, Vercel, and Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Simple ML model for strategy prediction
 */
class SimpleMLModel {
  private rules: any

  constructor() {
    this.rules = {
      high_complexity: {
        threshold: 0.7,
        strategy: 'detailed_analysis',
        confidence: 0.8
      },
      multiple_failures: {
        threshold: 2,
        strategy: 'aggressive_fallback',
        confidence: 0.9
      },
      high_context_similarity: {
        threshold: 0.6,
        strategy: 'context_aware',
        confidence: 0.85
      },
      new_user: {
        threshold: 0.3,
        strategy: 'guided_approach',
        confidence: 0.7
      }
    }
  }

  getRules() {
    return this.rules
  }

  predict(features: any) {
    const predictions = []

    if (features.query_complexity > this.rules.high_complexity.threshold) {
      predictions.push({
        strategy: this.rules.high_complexity.strategy,
        confidence: this.rules.high_complexity.confidence,
        reasoning: 'High query complexity detected'
      })
    }

    if (features.previous_failures >= this.rules.multiple_failures.threshold) {
      predictions.push({
        strategy: this.rules.multiple_failures.strategy,
        confidence: this.rules.multiple_failures.confidence,
        reasoning: 'Multiple previous failures detected'
      })
    }

    if (features.context_similarity > this.rules.high_context_similarity.threshold) {
      predictions.push({
        strategy: this.rules.high_context_similarity.strategy,
        confidence: this.rules.high_context_similarity.confidence,
        reasoning: 'High context similarity detected'
      })
    }

    if (features.user_experience_level < this.rules.new_user.threshold) {
      predictions.push({
        strategy: this.rules.new_user.strategy,
        confidence: this.rules.new_user.confidence,
        reasoning: 'New user detected, using guided approach'
      })
    }

    if (predictions.length === 0) {
      return {
        strategy: 'standard_processing',
        confidence: 0.6,
        reasoning: 'No specific patterns detected, using standard processing'
      }
    }

    return predictions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
  }

  updateRules(trainingData: any[]) {
    const successfulStrategies = trainingData
      .filter(d => d.success)
      .reduce((acc: any, d: any) => {
        acc[d.processing_strategy] = (acc[d.processing_strategy] || 0) + 1
        return acc
      }, {})

    const failedStrategies = trainingData
      .filter(d => !d.success)
      .reduce((acc: any, d: any) => {
        acc[d.processing_strategy] = (acc[d.processing_strategy] || 0) + 1
        return acc
      }, {})

    Object.keys(successfulStrategies).forEach(strategy => {
      const successCount = successfulStrategies[strategy]
      const failureCount = failedStrategies[strategy] || 0
      const totalCount = successCount + failureCount
      const successRate = successCount / totalCount

      if (successRate > 0.8) {
        this.updateRuleConfidence(strategy, 0.1)
      } else if (successRate < 0.5) {
        this.updateRuleConfidence(strategy, -0.1)
      }
    })
  }

  private updateRuleConfidence(strategy: string, adjustment: number) {
    Object.keys(this.rules).forEach(ruleKey => {
      if (this.rules[ruleKey].strategy === strategy) {
        this.rules[ruleKey].confidence = Math.max(0.1, Math.min(1.0, 
          this.rules[ruleKey].confidence + adjustment
        ))
      }
    })
  }
}

/**
 * Train ML models based on historical data
 */
async function trainMLModels() {
  console.log('🤖 Starting ML model training...')
  
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: trainingData, error } = await supabase
      .from('user_interaction_patterns')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch training data: ${error.message}`)
    }

    if (!trainingData || trainingData.length === 0) {
      console.log('📊 No training data available')
      return { success: true, message: 'No training data available' }
    }

    console.log(`📊 Training with ${trainingData.length} interactions`)

    const model = new SimpleMLModel()
    model.updateRules(trainingData)

    const modelParams = {
      rules: model.getRules(),
      training_data_count: trainingData.length,
      last_trained: new Date().toISOString(),
      version: '1.0'
    }

    await supabase
      .from('ml_training_data')
      .insert({
        model_type: 'strategy_prediction',
        workspace_id: null,
        input_features: { model_params: modelParams },
        expected_output: { success: true },
        actual_output: { success: true },
        model_version: '1.0',
        accuracy_score: 0.8
      })

    await updateAgentPerformanceMetrics(trainingData)
    await updateDataSourceEffectiveness(trainingData)

    console.log('✅ ML model training completed successfully')
    return { 
      success: true, 
      message: 'ML model training completed',
      training_data_count: trainingData.length,
      model_version: '1.0'
    }

  } catch (error) {
    console.error('❌ ML training error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function updateAgentPerformanceMetrics(trainingData: any[]) {
  console.log('📈 Updating agent performance metrics...')

  const agentMetrics = trainingData.reduce((acc: any, interaction: any) => {
    const agentType = interaction.agent_id || 'unknown'
    
    if (!acc[agentType]) {
      acc[agentType] = {
        total_queries: 0,
        successful_queries: 0,
        failed_queries: 0,
        total_execution_time: 0
      }
    }

    acc[agentType].total_queries++
    if (interaction.success) {
      acc[agentType].successful_queries++
    } else {
      acc[agentType].failed_queries++
    }
    acc[agentType].total_execution_time += interaction.execution_time_ms || 0

    return acc
  }, {})

  for (const [agentType, metrics] of Object.entries(agentMetrics)) {
    const metricsData = metrics as any
    const successRate = metricsData.successful_queries / metricsData.total_queries
    const avgExecutionTime = metricsData.total_execution_time / metricsData.total_queries

    await supabase
      .from('agent_performance_metrics')
      .upsert({
        agent_type: agentType,
        workspace_id: null,
        total_queries: metricsData.total_queries,
        successful_queries: metricsData.successful_queries,
        failed_queries: metricsData.failed_queries,
        average_processing_time_ms: avgExecutionTime,
        average_confidence_score: successRate,
        improvement_rate: 0.0,
        last_optimization_date: new Date().toISOString()
      }, {
        onConflict: 'agent_type,workspace_id'
      })
  }

  console.log('✅ Agent performance metrics updated')
}

async function updateDataSourceEffectiveness(trainingData: any[]) {
  console.log('📊 Updating data source effectiveness...')

  const sourceMetrics = trainingData.reduce((acc: any, interaction: any) => {
    const sources = interaction.data_sources_used || []
    
    sources.forEach((sourceId: string) => {
      if (!acc[sourceId]) {
        acc[sourceId] = {
          total_queries: 0,
          successful_queries: 0,
          total_relevance_score: 0
        }
      }

      acc[sourceId].total_queries++
      if (interaction.success) {
        acc[sourceId].successful_queries++
      }
      acc[sourceId].total_relevance_score += interaction.features_vector?.context_similarity || 0.5
    })

    return acc
  }, {})

  for (const [sourceId, metrics] of Object.entries(sourceMetrics)) {
    const metricsData = metrics as any
    const _successRate = metricsData.successful_queries / metricsData.total_queries
    const avgRelevance = metricsData.total_relevance_score / metricsData.total_queries

    await supabase
      .from('data_source_effectiveness')
      .upsert({
        data_source_id: sourceId,
        workspace_id: null,
        total_queries: metricsData.total_queries,
        successful_queries: metricsData.successful_queries,
        average_relevance_score: avgRelevance,
        last_optimization_date: new Date().toISOString()
      }, {
        onConflict: 'data_source_id,workspace_id'
      })
  }

  console.log('✅ Data source effectiveness updated')
}

export async function POST(_request: NextRequest) {
  try {
    const result = await trainMLModels()
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error) {
    console.error('Training API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: 'ML Training API - Use POST to trigger training',
    endpoints: {
      'POST /api/ml/train-models': 'Train ML models with historical data'
    }
  })
}
