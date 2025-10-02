/**
 * React Hook for Model Configuration Management
 * 
 * Provides a React interface for managing AI model configurations and usage
 */

import { useState, useEffect, useCallback } from 'react'
import { ModelConfig, ModelStats, CostLimits } from '@/lib/model-config'

interface UseModelConfigReturn {
  // Model management
  models: ModelConfig[]
  activeModels: ModelConfig[]
  embeddingModel: ModelConfig | null
  chatModel: ModelConfig | null
  
  // Usage tracking
  usageStats: ModelStats | null
  costLimits: CostLimits | null
  limitCheck: {
    within_limits: boolean
    warnings: string[]
    errors: string[]
  } | null
  
  // Actions
  updateModel: (modelId: string, updates: Partial<ModelConfig>) => Promise<boolean>
  setModelActive: (modelId: string, isActive: boolean) => Promise<boolean>
  updateCostLimits: (limits: Partial<CostLimits>) => Promise<boolean>
  refreshUsage: () => Promise<void>
  
  // Loading states
  loading: boolean
  error: string | null
}

export function useModelConfig(): UseModelConfigReturn {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [activeModels, setActiveModels] = useState<ModelConfig[]>([])
  const [embeddingModel, setEmbeddingModel] = useState<ModelConfig | null>(null)
  const [chatModel, setChatModel] = useState<ModelConfig | null>(null)
  const [usageStats, setUsageStats] = useState<ModelStats | null>(null)
  const [costLimits, setCostLimits] = useState<CostLimits | null>(null)
  const [limitCheck, setLimitCheck] = useState<{
    within_limits: boolean
    warnings: string[]
    errors: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch model configuration
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch('/api/models/config')
      if (!response.ok) {
        throw new Error('Failed to fetch model configuration')
      }
      
      const data = await response.json()
      if (data.success) {
        setModels(data.models)
        
        // Filter active models
        const active = data.models.filter((model: ModelConfig) => model.is_active)
        setActiveModels(active)
        
        // Set specific model types
        const embedding = active.find((model: ModelConfig) => model.type === 'embedding')
        const chat = active.find((model: ModelConfig) => model.type === 'chat')
        
        setEmbeddingModel(embedding || null)
        setChatModel(chat || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  // Fetch usage statistics
  const fetchUsage = useCallback(async () => {
    try {
      const response = await fetch('/api/models/usage?time_range=day')
      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics')
      }
      
      const data = await response.json()
      if (data.success) {
        setUsageStats(data.statistics)
        setCostLimits(data.cost_limits)
        setLimitCheck(data.limit_check)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  // Update model configuration
  const updateModel = useCallback(async (modelId: string, updates: Partial<ModelConfig>): Promise<boolean> => {
    try {
      const response = await fetch('/api/models/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_model',
          modelId,
          updates
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update model')
      }
      
      const data = await response.json()
      if (data.success) {
        await fetchModels() // Refresh models
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [fetchModels])

  // Set model active/inactive
  const setModelActive = useCallback(async (modelId: string, isActive: boolean): Promise<boolean> => {
    try {
      const response = await fetch('/api/models/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_active',
          modelId,
          isActive
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update model status')
      }
      
      const data = await response.json()
      if (data.success) {
        await fetchModels() // Refresh models
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [fetchModels])

  // Update cost limits
  const updateCostLimits = useCallback(async (limits: Partial<CostLimits>): Promise<boolean> => {
    try {
      const response = await fetch('/api/models/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_cost_limits',
          costLimits: limits
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update cost limits')
      }
      
      const data = await response.json()
      if (data.success) {
        await fetchUsage() // Refresh usage data
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [fetchUsage])

  // Refresh usage statistics
  const refreshUsage = useCallback(async () => {
    await fetchUsage()
  }, [fetchUsage])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        await Promise.all([
          fetchModels(),
          fetchUsage()
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [fetchModels, fetchUsage])

  // Auto-refresh usage every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsage()
    }, 5 * 60 * 1000) // 5 minutes
    
    return () => clearInterval(interval)
  }, [fetchUsage])

  return {
    // Model management
    models,
    activeModels,
    embeddingModel,
    chatModel,
    
    // Usage tracking
    usageStats,
    costLimits,
    limitCheck,
    
    // Actions
    updateModel,
    setModelActive,
    updateCostLimits,
    refreshUsage,
    
    // Loading states
    loading,
    error
  }
}

// Hook for specific model type
export function useModelByType(type: 'embedding' | 'chat' | 'completion' | 'image') {
  const { models, loading, error } = useModelConfig()
  
  const modelsByType = models.filter(model => model.type === type)
  const activeModel = modelsByType.find(model => model.is_active)
  
  return {
    models: modelsByType,
    activeModel,
    loading,
    error
  }
}

// Hook for usage monitoring
export function useModelUsage(timeRange: 'day' | 'week' | 'month' = 'day') {
  const [usageStats, setUsageStats] = useState<ModelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/models/usage?time_range=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics')
      }
      
      const data = await response.json()
      if (data.success) {
        setUsageStats(data.statistics)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return {
    usageStats,
    loading,
    error,
    refresh: fetchUsage
  }
}
