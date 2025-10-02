/**
 * Server-side Token Tracking Utilities
 * These functions require server-side Supabase access
 */

import { supabaseServer } from '@/lib/server-utils'
import { TokenTrackingData } from './token-utils'

/**
 * Save token usage data to database (server-side only)
 */
export async function saveTokenUsageToDatabase(
  userId: string,
  tokenData: TokenTrackingData,
  action: 'chat' | 'canvas_generation' | 'dashboard_creation' = 'chat',
  modelInfo?: {
    model_used: string;
    model_provider: string;
    model_version: string;
    fallback_used: boolean;
  }
): Promise<void> {
  try {
    
    // Save to token_usage table
    await supabaseServer
      .from('token_usage')
      .insert({
        user_id: userId,
        tokens_used: tokenData.totalTokensUsed,
        action: action,
        input_tokens: tokenData.totalInputTokens,
        output_tokens: tokenData.totalOutputTokens,
        system_tokens: tokenData.systemPromptTokens,
        context_tokens: tokenData.contextTokens,
        agent_processing_tokens: tokenData.totalProcessingTokens,
        model_used: modelInfo?.model_used,
        model_provider: modelInfo?.model_provider,
        model_version: modelInfo?.model_version,
        fallback_used: modelInfo?.fallback_used || false,
        metadata: {
          stageBreakdown: tokenData.stageBreakdown,
          userInputTokens: tokenData.userInputTokens,
          systemPromptTokens: tokenData.systemPromptTokens,
          contextTokens: tokenData.contextTokens,
          routerAgentTokens: tokenData.routerAgentTokens,
          qaAgentTokens: tokenData.qaAgentTokens,
          fileContentTokens: tokenData.fileContentTokens,
          conversationHistoryTokens: tokenData.conversationHistoryTokens,
          agentResponseTokens: tokenData.agentResponseTokens,
          modelInfo: modelInfo
        }
      })
    
  } catch (error) {
    console.error('❌ Error saving token usage:', error)
    // Don't throw - token tracking shouldn't break the main flow
  }
}

/**
 * Get token usage statistics for a user (server-side only)
 */
export async function getUserTokenUsage(
  userId: string,
  days: number = 30
): Promise<{
  totalTokens: number
  totalRequests: number
  averageTokensPerRequest: number
  usageByAction: Record<string, { tokens: number; requests: number }>
  dailyUsage: Array<{ date: string; tokens: number; requests: number }>
}> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data: usage, error } = await supabaseServer
      .from('token_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching token usage:', error)
      return {
        totalTokens: 0,
        totalRequests: 0,
        averageTokensPerRequest: 0,
        usageByAction: {},
        dailyUsage: []
      }
    }

    const totalTokens = usage?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0
    const totalRequests = usage?.length || 0
    const averageTokensPerRequest = totalRequests > 0 ? totalTokens / totalRequests : 0

    // Group by action
    const usageByAction: Record<string, { tokens: number; requests: number }> = {}
    usage?.forEach(record => {
      const action = record.action || 'unknown'
      if (!usageByAction[action]) {
        usageByAction[action] = { tokens: 0, requests: 0 }
      }
      usageByAction[action].tokens += record.tokens_used || 0
      usageByAction[action].requests += 1
    })

    // Group by day
    const dailyUsage: Array<{ date: string; tokens: number; requests: number }> = []
    const dailyMap = new Map<string, { tokens: number; requests: number }>()
    
    usage?.forEach(record => {
      const date = new Date(record.created_at).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { tokens: 0, requests: 0 })
      }
      const dayData = dailyMap.get(date)!
      dayData.tokens += record.tokens_used || 0
      dayData.requests += 1
    })

    dailyMap.forEach((data, date) => {
      dailyUsage.push({ date, ...data })
    })

    return {
      totalTokens,
      totalRequests,
      averageTokensPerRequest,
      usageByAction,
      dailyUsage: dailyUsage.sort((a, b) => a.date.localeCompare(b.date))
    }
  } catch (error) {
    console.error('Error in getUserTokenUsage:', error)
    return {
      totalTokens: 0,
      totalRequests: 0,
      averageTokensPerRequest: 0,
      usageByAction: {},
      dailyUsage: []
    }
  }
}
