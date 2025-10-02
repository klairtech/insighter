/**
 * Model Configuration and Cost Management
 * 
 * Centralized configuration for AI models with cost tracking and control
 */

export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'local'
  model: string
  type: 'embedding' | 'chat' | 'completion' | 'image'
  cost_per_token: number
  cost_per_1k_tokens: number
  max_tokens: number
  context_window: number
  is_active: boolean
  fallback_model?: string
  rate_limit_per_minute?: number
  rate_limit_per_day?: number
  features: {
    supports_streaming: boolean
    supports_function_calling: boolean
    supports_vision: boolean
    supports_embeddings: boolean
  }
}

export interface ModelUsage {
  model_id: string
  tokens_used: number
  cost: number
  timestamp: string
  user_id?: string
  workspace_id?: string
  operation_type: 'embedding' | 'chat' | 'completion' | 'image'
}

export interface CostLimits {
  daily_limit: number
  monthly_limit: number
  per_user_limit: number
  per_workspace_limit: number
  alert_threshold: number // Percentage of limit to trigger alerts
}

export interface ModelStats {
  total_tokens: number
  total_cost: number
  requests_count: number
  average_tokens_per_request: number
  cost_per_day: number
  usage_by_model: Record<string, {
    tokens: number
    cost: number
    requests: number
  }>
}

/**
 * Model Configuration Manager
 */
export class ModelConfigManager {
  private static instance: ModelConfigManager
  private models: Map<string, ModelConfig> = new Map()
  private usage: ModelUsage[] = []
  private costLimits: CostLimits = {
    daily_limit: 10.00,
    monthly_limit: 300.00,
    per_user_limit: 5.00,
    per_workspace_limit: 50.00,
    alert_threshold: 80
  }

  private constructor() {
    this.initializeModels()
    this.initializeCostLimits()
  }

  public static getInstance(): ModelConfigManager {
    if (!ModelConfigManager.instance) {
      ModelConfigManager.instance = new ModelConfigManager()
    }
    return ModelConfigManager.instance
  }

  /**
   * Initialize model configurations from environment variables
   */
  private initializeModels(): void {
    // Embedding Models
    this.addModel({
      id: 'text-embedding-3-small',
      name: 'Text Embedding 3 Small',
      provider: 'openai',
      model: 'text-embedding-3-small',
      type: 'embedding',
      cost_per_token: 0.00000002, // $0.02 per 1M tokens
      cost_per_1k_tokens: 0.00002,
      max_tokens: 8191,
      context_window: 8191,
      is_active: process.env.OPENAI_EMBEDDING_MODEL === 'text-embedding-3-small',
      fallback_model: 'text-embedding-ada-002',
      rate_limit_per_minute: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_MINUTE || '3000'),
      rate_limit_per_day: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_DAY || '100000'),
      features: {
        supports_streaming: false,
        supports_function_calling: false,
        supports_vision: false,
        supports_embeddings: true
      }
    })

    this.addModel({
      id: 'text-embedding-3-large',
      name: 'Text Embedding 3 Large',
      provider: 'openai',
      model: 'text-embedding-3-large',
      type: 'embedding',
      cost_per_token: 0.00000013, // $0.13 per 1M tokens
      cost_per_1k_tokens: 0.00013,
      max_tokens: 8191,
      context_window: 8191,
      is_active: process.env.OPENAI_EMBEDDING_MODEL === 'text-embedding-3-large',
      fallback_model: 'text-embedding-3-small',
      rate_limit_per_minute: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_MINUTE || '3000'),
      rate_limit_per_day: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_DAY || '100000'),
      features: {
        supports_streaming: false,
        supports_function_calling: false,
        supports_vision: false,
        supports_embeddings: true
      }
    })

    this.addModel({
      id: 'text-embedding-ada-002',
      name: 'Text Embedding Ada 002',
      provider: 'openai',
      model: 'text-embedding-ada-002',
      type: 'embedding',
      cost_per_token: 0.0000001, // $0.10 per 1M tokens
      cost_per_1k_tokens: 0.0001,
      max_tokens: 8191,
      context_window: 8191,
      is_active: process.env.OPENAI_EMBEDDING_MODEL === 'text-embedding-ada-002',
      fallback_model: 'text-embedding-3-small',
      rate_limit_per_minute: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_MINUTE || '3000'),
      rate_limit_per_day: parseInt(process.env.EMBEDDING_RATE_LIMIT_PER_DAY || '100000'),
      features: {
        supports_streaming: false,
        supports_function_calling: false,
        supports_vision: false,
        supports_embeddings: true
      }
    })

    // Chat Models
    this.addModel({
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      model: 'gpt-4o-mini',
      type: 'chat',
      cost_per_token: 0.00000015, // $0.15 per 1M tokens input
      cost_per_1k_tokens: 0.00015,
      max_tokens: 128000,
      context_window: 128000,
      is_active: process.env.OPENAI_MODEL === 'gpt-4o-mini',
      fallback_model: 'gpt-3.5-turbo',
      rate_limit_per_minute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '500'),
      rate_limit_per_day: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '10000'),
      features: {
        supports_streaming: true,
        supports_function_calling: true,
        supports_vision: true,
        supports_embeddings: false
      }
    })

    this.addModel({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
      type: 'chat',
      cost_per_token: 0.000005, // $5.00 per 1M tokens input
      cost_per_1k_tokens: 0.005,
      max_tokens: 128000,
      context_window: 128000,
      is_active: process.env.OPENAI_MODEL === 'gpt-4o',
      fallback_model: 'gpt-4o-mini',
      rate_limit_per_minute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '500'),
      rate_limit_per_day: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '10000'),
      features: {
        supports_streaming: true,
        supports_function_calling: true,
        supports_vision: true,
        supports_embeddings: false
      }
    })

    // Anthropic Models
    this.addModel({
      id: 'claude-3-5-sonnet-20240620',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20240620',
      type: 'chat',
      cost_per_token: 0.000003, // $3.00 per 1M tokens input
      cost_per_1k_tokens: 0.003,
      max_tokens: 200000,
      context_window: 200000,
      is_active: process.env.CLAUDE_MODEL === 'claude-3-5-sonnet-20240620',
      fallback_model: 'gpt-4o-mini',
      rate_limit_per_minute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '500'),
      rate_limit_per_day: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '10000'),
      features: {
        supports_streaming: true,
        supports_function_calling: true,
        supports_vision: true,
        supports_embeddings: false
      }
    })

    // Google Models
    this.addModel({
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      model: 'gemini-1.5-flash',
      type: 'chat',
      cost_per_token: 0.000000075, // $0.075 per 1M tokens input
      cost_per_1k_tokens: 0.000075,
      max_tokens: 1000000,
      context_window: 1000000,
      is_active: process.env.GOOGLE_GEMINI_API_KEY ? process.env.GOOGLE_GEMINI_MODEL === 'gemini-1.5-flash' : false,
      fallback_model: 'gpt-4o-mini',
      rate_limit_per_minute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '500'),
      rate_limit_per_day: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '10000'),
      features: {
        supports_streaming: true,
        supports_function_calling: true,
        supports_vision: true,
        supports_embeddings: false
      }
    })

    // Add Gemini Pro model (used in AI agents)
    this.models.set('gemini-pro', {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'google',
      model: 'gemini-pro',
      type: 'chat',
      cost_per_token: 0.0000005, // $0.50 per 1M tokens input
      cost_per_1k_tokens: 0.0005,
      max_tokens: 30000,
      context_window: 30000,
      is_active: process.env.GOOGLE_GEMINI_API_KEY ? process.env.GOOGLE_GEMINI_MODEL === 'gemini-pro' : false,
      fallback_model: 'gpt-4o-mini',
      rate_limit_per_minute: parseInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE || '500'),
      rate_limit_per_day: parseInt(process.env.CHAT_RATE_LIMIT_PER_DAY || '10000'),
      features: {
        supports_streaming: true,
        supports_function_calling: false,
        supports_vision: false,
        supports_embeddings: false
      }
    })
  }

  /**
   * Initialize cost limits from environment variables
   */
  private initializeCostLimits(): void {
    this.costLimits = {
      daily_limit: parseFloat(process.env.DAILY_COST_LIMIT || '10.00'),
      monthly_limit: parseFloat(process.env.MONTHLY_COST_LIMIT || '300.00'),
      per_user_limit: parseFloat(process.env.PER_USER_COST_LIMIT || '5.00'),
      per_workspace_limit: parseFloat(process.env.PER_WORKSPACE_COST_LIMIT || '50.00'),
      alert_threshold: parseFloat(process.env.COST_ALERT_THRESHOLD || '80') // 80%
    }
  }

  /**
   * Add a model configuration
   */
  private addModel(config: ModelConfig): void {
    this.models.set(config.id, config)
  }

  /**
   * Get model configuration by ID
   */
  public getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId)
  }

  /**
   * Get active model by type
   */
  public getActiveModel(type: 'embedding' | 'chat' | 'completion' | 'image'): ModelConfig | undefined {
    for (const model of this.models.values()) {
      if (model.type === type && model.is_active) {
        return model
      }
    }
    return undefined
  }

  /**
   * Get all models by type
   */
  public getModelsByType(type: 'embedding' | 'chat' | 'completion' | 'image'): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => model.type === type)
  }

  /**
   * Get all active models
   */
  public getActiveModels(): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => model.is_active)
  }

  /**
   * Record model usage
   */
  public recordUsage(usage: ModelUsage): void {
    this.usage.push(usage)
    
    // Keep only last 10000 usage records
    if (this.usage.length > 10000) {
      this.usage = this.usage.slice(-10000)
    }
  }

  /**
   * Calculate cost for tokens
   */
  public calculateCost(modelId: string, tokens: number): number {
    const model = this.getModel(modelId)
    if (!model) return 0
    
    return tokens * model.cost_per_token
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(timeRange: 'day' | 'week' | 'month' = 'day'): ModelStats {
    const now = new Date()
    const timeRangeMs = this.getTimeRangeMs(timeRange)
    const cutoffTime = new Date(now.getTime() - timeRangeMs)
    
    const recentUsage = this.usage.filter(u => new Date(u.timestamp) >= cutoffTime)
    
    const totalTokens = recentUsage.reduce((sum, u) => sum + u.tokens_used, 0)
    const totalCost = recentUsage.reduce((sum, u) => sum + u.cost, 0)
    const requestsCount = recentUsage.length
    const averageTokensPerRequest = requestsCount > 0 ? totalTokens / requestsCount : 0
    const costPerDay = this.calculateCostPerDay(recentUsage)
    
    const usageByModel: Record<string, { tokens: number; cost: number; requests: number }> = {}
    recentUsage.forEach(u => {
      if (!usageByModel[u.model_id]) {
        usageByModel[u.model_id] = { tokens: 0, cost: 0, requests: 0 }
      }
      usageByModel[u.model_id].tokens += u.tokens_used
      usageByModel[u.model_id].cost += u.cost
      usageByModel[u.model_id].requests += 1
    })
    
    return {
      total_tokens: totalTokens,
      total_cost: totalCost,
      requests_count: requestsCount,
      average_tokens_per_request: averageTokensPerRequest,
      cost_per_day: costPerDay,
      usage_by_model: usageByModel
    }
  }

  /**
   * Check if usage is within limits
   */
  public checkUsageLimits(userId?: string, workspaceId?: string): {
    within_limits: boolean
    warnings: string[]
    errors: string[]
  } {
    const warnings: string[] = []
    const errors: string[] = []
    
    const stats = this.getUsageStats('day')
    
    // Check daily limit
    if (stats.total_cost >= this.costLimits.daily_limit) {
      errors.push(`Daily cost limit exceeded: $${stats.total_cost.toFixed(2)} / $${this.costLimits.daily_limit}`)
    } else if (stats.total_cost >= this.costLimits.daily_limit * (this.costLimits.alert_threshold / 100)) {
      warnings.push(`Approaching daily cost limit: $${stats.total_cost.toFixed(2)} / $${this.costLimits.daily_limit}`)
    }
    
    // Check monthly limit
    const monthlyStats = this.getUsageStats('month')
    if (monthlyStats.total_cost >= this.costLimits.monthly_limit) {
      errors.push(`Monthly cost limit exceeded: $${monthlyStats.total_cost.toFixed(2)} / $${this.costLimits.monthly_limit}`)
    } else if (monthlyStats.total_cost >= this.costLimits.monthly_limit * (this.costLimits.alert_threshold / 100)) {
      warnings.push(`Approaching monthly cost limit: $${monthlyStats.total_cost.toFixed(2)} / $${this.costLimits.monthly_limit}`)
    }
    
    // Check per-user limit
    if (userId) {
      const userStats = this.getUserUsageStats(userId, 'day')
      if (userStats.total_cost >= this.costLimits.per_user_limit) {
        errors.push(`User cost limit exceeded: $${userStats.total_cost.toFixed(2)} / $${this.costLimits.per_user_limit}`)
      } else if (userStats.total_cost >= this.costLimits.per_user_limit * (this.costLimits.alert_threshold / 100)) {
        warnings.push(`Approaching user cost limit: $${userStats.total_cost.toFixed(2)} / $${this.costLimits.per_user_limit}`)
      }
    }
    
    // Check per-workspace limit
    if (workspaceId) {
      const workspaceStats = this.getWorkspaceUsageStats(workspaceId, 'day')
      if (workspaceStats.total_cost >= this.costLimits.per_workspace_limit) {
        errors.push(`Workspace cost limit exceeded: $${workspaceStats.total_cost.toFixed(2)} / $${this.costLimits.per_workspace_limit}`)
      } else if (workspaceStats.total_cost >= this.costLimits.per_workspace_limit * (this.costLimits.alert_threshold / 100)) {
        warnings.push(`Approaching workspace cost limit: $${workspaceStats.total_cost.toFixed(2)} / $${this.costLimits.per_workspace_limit}`)
      }
    }
    
    return {
      within_limits: errors.length === 0,
      warnings,
      errors
    }
  }

  /**
   * Get user usage statistics
   */
  private getUserUsageStats(userId: string, timeRange: 'day' | 'week' | 'month' = 'day'): ModelStats {
    const now = new Date()
    const timeRangeMs = this.getTimeRangeMs(timeRange)
    const cutoffTime = new Date(now.getTime() - timeRangeMs)
    
    const userUsage = this.usage.filter(u => 
      u.user_id === userId && new Date(u.timestamp) >= cutoffTime
    )
    
    return this.calculateStatsFromUsage(userUsage)
  }

  /**
   * Get workspace usage statistics
   */
  private getWorkspaceUsageStats(workspaceId: string, timeRange: 'day' | 'week' | 'month' = 'day'): ModelStats {
    const now = new Date()
    const timeRangeMs = this.getTimeRangeMs(timeRange)
    const cutoffTime = new Date(now.getTime() - timeRangeMs)
    
    const workspaceUsage = this.usage.filter(u => 
      u.workspace_id === workspaceId && new Date(u.timestamp) >= cutoffTime
    )
    
    return this.calculateStatsFromUsage(workspaceUsage)
  }

  /**
   * Calculate statistics from usage array
   */
  private calculateStatsFromUsage(usage: ModelUsage[]): ModelStats {
    const totalTokens = usage.reduce((sum, u) => sum + u.tokens_used, 0)
    const totalCost = usage.reduce((sum, u) => sum + u.cost, 0)
    const requestsCount = usage.length
    const averageTokensPerRequest = requestsCount > 0 ? totalTokens / requestsCount : 0
    const costPerDay = this.calculateCostPerDay(usage)
    
    const usageByModel: Record<string, { tokens: number; cost: number; requests: number }> = {}
    usage.forEach(u => {
      if (!usageByModel[u.model_id]) {
        usageByModel[u.model_id] = { tokens: 0, cost: 0, requests: 0 }
      }
      usageByModel[u.model_id].tokens += u.tokens_used
      usageByModel[u.model_id].cost += u.cost
      usageByModel[u.model_id].requests += 1
    })
    
    return {
      total_tokens: totalTokens,
      total_cost: totalCost,
      requests_count: requestsCount,
      average_tokens_per_request: averageTokensPerRequest,
      cost_per_day: costPerDay,
      usage_by_model: usageByModel
    }
  }

  /**
   * Calculate cost per day
   */
  private calculateCostPerDay(usage: ModelUsage[]): number {
    if (usage.length === 0) return 0
    
    const firstUsage = new Date(usage[0].timestamp)
    const lastUsage = new Date(usage[usage.length - 1].timestamp)
    const daysDiff = Math.max(1, (lastUsage.getTime() - firstUsage.getTime()) / (1000 * 60 * 60 * 24))
    
    const totalCost = usage.reduce((sum, u) => sum + u.cost, 0)
    return totalCost / daysDiff
  }

  /**
   * Get time range in milliseconds
   */
  private getTimeRangeMs(timeRange: 'day' | 'week' | 'month'): number {
    switch (timeRange) {
      case 'day': return 24 * 60 * 60 * 1000
      case 'week': return 7 * 24 * 60 * 60 * 1000
      case 'month': return 30 * 24 * 60 * 60 * 1000
      default: return 24 * 60 * 60 * 1000
    }
  }

  /**
   * Get cost limits
   */
  public getCostLimits(): CostLimits {
    return { ...this.costLimits }
  }

  /**
   * Update cost limits
   */
  public updateCostLimits(limits: Partial<CostLimits>): void {
    this.costLimits = { ...this.costLimits, ...limits }
  }

  /**
   * Get all model configurations
   */
  public getAllModels(): ModelConfig[] {
    return Array.from(this.models.values())
  }

  /**
   * Update model configuration
   */
  public updateModel(modelId: string, updates: Partial<ModelConfig>): boolean {
    const model = this.models.get(modelId)
    if (!model) return false
    
    this.models.set(modelId, { ...model, ...updates })
    return true
  }

  /**
   * Enable/disable model
   */
  public setModelActive(modelId: string, isActive: boolean): boolean {
    return this.updateModel(modelId, { is_active: isActive })
  }
}

// Export singleton instance
export const modelConfigManager = ModelConfigManager.getInstance()
