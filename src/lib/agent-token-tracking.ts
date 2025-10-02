/**
 * Agent-level Token Tracking Utilities
 * Tracks token usage for each individual agent step
 */

import { supabaseServer } from '@/lib/server-utils'
import { v4 as uuidv4 } from 'uuid'

export interface AgentStepTracking {
  conversationStepId: string;
  userId: string;
  agentType: string;
  agentStep: string;
  stepOrder: number;
  modelUsed: string;
  modelProvider: string;
  fallbackUsed: boolean;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, any>;
}

/**
 * Track token usage for a specific agent step
 */
export async function trackAgentStepUsage(
  userId: string,
  agentType: string,
  agentStep: string,
  stepOrder: number,
  modelInfo: {
    model_used: string;
    model_provider: string;
    fallback_used: boolean;
    tokens_used: number;
    input_tokens: number;
    output_tokens: number;
  },
  conversationId?: string,
  metadata?: Record<string, any>
): Promise<string> {
  try {
    const conversationStepId = uuidv4()
    
    const trackingData: AgentStepTracking = {
      conversationStepId,
      userId,
      agentType,
      agentStep,
      stepOrder,
      modelUsed: modelInfo.model_used,
      modelProvider: modelInfo.model_provider,
      fallbackUsed: modelInfo.fallback_used,
      tokensUsed: modelInfo.tokens_used,
      inputTokens: modelInfo.input_tokens,
      outputTokens: modelInfo.output_tokens,
      metadata: {
        ...metadata,
        conversation_id: conversationId,
        timestamp: new Date().toISOString()
      }
    }

    // Insert into token_usage table with agent-level tracking
    const { error } = await supabaseServer
      .from('token_usage')
      .insert({
        user_id: userId,
        tokens_used: modelInfo.tokens_used,
        action: 'chat',
        model_used: modelInfo.model_used,
        model_provider: modelInfo.model_provider,
        model_version: modelInfo.model_used,
        fallback_used: modelInfo.fallback_used,
        input_tokens: modelInfo.input_tokens,
        output_tokens: modelInfo.output_tokens,
        agent_step: agentStep,
        agent_type: agentType,
        step_order: stepOrder,
        conversation_step_id: conversationStepId,
        metadata: {
          ...metadata,
          conversation_id: conversationId,
          timestamp: new Date().toISOString(),
          agent_tracking: trackingData
        }
      })

    if (error) {
      console.error('❌ Error tracking agent step usage:', error)
      throw error
    }

    console.log(`✅ Agent step tracked: ${agentType}/${agentStep} - ${modelInfo.tokens_used} tokens (${modelInfo.model_used})`)
    return conversationStepId

  } catch (error) {
    console.error('❌ Error in trackAgentStepUsage:', error)
    // Don't throw - token tracking shouldn't break the main flow
    return ''
  }
}

/**
 * Track AI summary generation usage
 */
export async function trackAISummaryUsage(
  userId: string,
  summaryType: 'column_definition' | 'table_definition' | 'database_definition' | 'hierarchical_definition',
  modelInfo: {
    model_used: string;
    model_provider: string;
    fallback_used: boolean;
    tokens_used: number;
    input_tokens: number;
    output_tokens: number;
  },
  metadata?: Record<string, any>
): Promise<string> {
  return trackAgentStepUsage(
    userId,
    'ai_summary',
    summaryType,
    0, // No step order for summary generation
    modelInfo,
    undefined,
    {
      ...metadata,
      summary_type: summaryType
    }
  )
}

/**
 * Get agent usage analytics
 */
export async function getAgentUsageAnalytics(
  userId?: string,
  days: number = 30
): Promise<{
  agentPerformance: Array<{
    agent_type: string;
    total_steps: number;
    total_tokens: number;
    avg_tokens_per_step: number;
    fallback_rate: number;
    most_used_model: string;
  }>;
  stepBreakdown: Array<{
    agent_step: string;
    agent_type: string;
    total_requests: number;
    total_tokens: number;
    avg_tokens_per_request: number;
    fallback_percentage: number;
  }>;
  modelUsage: Array<{
    model_used: string;
    model_provider: string;
    total_tokens: number;
    total_requests: number;
    avg_tokens_per_request: number;
    fallback_percentage: number;
  }>;
}> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabaseServer
      .from('token_usage')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .not('agent_step', 'is', null)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: usageData, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching agent usage analytics:', error)
      return {
        agentPerformance: [],
        stepBreakdown: [],
        modelUsage: []
      }
    }

    // Process agent performance
    const agentPerformance = Object.values(
      (usageData || []).reduce((acc: any, item: any) => {
        const key = item.agent_type
        if (!acc[key]) {
          acc[key] = {
            agent_type: key,
            total_steps: 0,
            total_tokens: 0,
            fallback_steps: 0,
            models: new Set()
          }
        }
        acc[key].total_steps++
        acc[key].total_tokens += item.tokens_used || 0
        if (item.fallback_used) acc[key].fallback_steps++
        acc[key].models.add(item.model_used)
        return acc
      }, {})
    ).map((agent: any) => ({
      agent_type: agent.agent_type,
      total_steps: agent.total_steps,
      total_tokens: agent.total_tokens,
      avg_tokens_per_step: Math.round(agent.total_tokens / agent.total_steps),
      fallback_rate: Math.round((agent.fallback_steps / agent.total_steps) * 100),
      most_used_model: Array.from(agent.models)[0] as string
    }))

    // Process step breakdown
    const stepBreakdown = Object.values(
      (usageData || []).reduce((acc: any, item: any) => {
        const key = `${item.agent_type}/${item.agent_step}`
        if (!acc[key]) {
          acc[key] = {
            agent_step: item.agent_step,
            agent_type: item.agent_type,
            total_requests: 0,
            total_tokens: 0,
            fallback_requests: 0
          }
        }
        acc[key].total_requests++
        acc[key].total_tokens += item.tokens_used || 0
        if (item.fallback_used) acc[key].fallback_requests++
        return acc
      }, {})
    ).map((step: any) => ({
      agent_step: step.agent_step,
      agent_type: step.agent_type,
      total_requests: step.total_requests,
      total_tokens: step.total_tokens,
      avg_tokens_per_request: Math.round(step.total_tokens / step.total_requests),
      fallback_percentage: Math.round((step.fallback_requests / step.total_requests) * 100)
    }))

    // Process model usage
    const modelUsage = Object.values(
      (usageData || []).reduce((acc: any, item: any) => {
        const key = item.model_used
        if (!acc[key]) {
          acc[key] = {
            model_used: item.model_used,
            model_provider: item.model_provider,
            total_requests: 0,
            total_tokens: 0,
            fallback_requests: 0
          }
        }
        acc[key].total_requests++
        acc[key].total_tokens += item.tokens_used || 0
        if (item.fallback_used) acc[key].fallback_requests++
        return acc
      }, {})
    ).map((model: any) => ({
      model_used: model.model_used,
      model_provider: model.model_provider,
      total_tokens: model.total_tokens,
      total_requests: model.total_requests,
      avg_tokens_per_request: Math.round(model.total_tokens / model.total_requests),
      fallback_percentage: Math.round((model.fallback_requests / model.total_requests) * 100)
    }))

    return {
      agentPerformance: agentPerformance.sort((a, b) => b.total_tokens - a.total_tokens),
      stepBreakdown: stepBreakdown.sort((a, b) => b.total_tokens - a.total_tokens),
      modelUsage: modelUsage.sort((a, b) => b.total_tokens - a.total_tokens)
    }

  } catch (error) {
    console.error('Error in getAgentUsageAnalytics:', error)
    return {
      agentPerformance: [],
      stepBreakdown: [],
      modelUsage: []
    }
  }
}
