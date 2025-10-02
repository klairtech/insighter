import OpenAI from 'openai'
import { modelConfigManager, ModelUsage } from './model-config'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EmbeddingResult {
  embedding: number[]
  tokens_used: number
  model: string
  cost: number
  provider: string
}

/**
 * Generate embeddings for text using configured embedding model
 */
export async function generateEmbedding(
  text: string, 
  options?: {
    userId?: string
    workspaceId?: string
    modelId?: string
  }
): Promise<EmbeddingResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Get active embedding model or use specified model
    const modelConfig = options?.modelId 
      ? modelConfigManager.getModel(options.modelId)
      : modelConfigManager.getActiveModel('embedding')

    if (!modelConfig) {
      throw new Error('No active embedding model configured')
    }

    // Check usage limits before making request
    const limitCheck = modelConfigManager.checkUsageLimits(options?.userId, options?.workspaceId)
    if (!limitCheck.within_limits) {
      console.warn('Usage limits exceeded:', limitCheck.errors)
      // Use fallback model if available
      if (modelConfig.fallback_model) {
        const fallbackConfig = modelConfigManager.getModel(modelConfig.fallback_model)
        if (fallbackConfig) {
          return generateEmbedding(text, { ...options, modelId: fallbackConfig.id })
        }
      }
      throw new Error(`Usage limits exceeded: ${limitCheck.errors.join(', ')}`)
    }

    // Log warnings if approaching limits
    if (limitCheck.warnings.length > 0) {
      console.warn('Approaching usage limits:', limitCheck.warnings)
    }

    const startTime = Date.now()
    
    const response = await openai.embeddings.create({
      model: modelConfig.model,
      input: text,
      encoding_format: 'float'
    })

    const tokensUsed = response.usage.total_tokens
    const cost = modelConfigManager.calculateCost(modelConfig.id, tokensUsed)

    // Record usage
    const usage: ModelUsage = {
      model_id: modelConfig.id,
      tokens_used: tokensUsed,
      cost: cost,
      timestamp: new Date().toISOString(),
      user_id: options?.userId,
      workspace_id: options?.workspaceId,
      operation_type: 'embedding'
    }
    modelConfigManager.recordUsage(usage)

    const processingTime = Date.now() - startTime
    console.log(`Embedding generated: ${tokensUsed} tokens, $${cost.toFixed(4)} cost, ${processingTime}ms`)

    return {
      embedding: response.data[0].embedding,
      tokens_used: tokensUsed,
      model: modelConfig.model,
      cost: cost,
      provider: modelConfig.provider
    }
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[], 
  options?: {
    userId?: string
    workspaceId?: string
    modelId?: string
  }
): Promise<EmbeddingResult[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Get active embedding model or use specified model
    const modelConfig = options?.modelId 
      ? modelConfigManager.getModel(options.modelId)
      : modelConfigManager.getActiveModel('embedding')

    if (!modelConfig) {
      throw new Error('No active embedding model configured')
    }

    // Check usage limits before making request
    const limitCheck = modelConfigManager.checkUsageLimits(options?.userId, options?.workspaceId)
    if (!limitCheck.within_limits) {
      console.warn('Usage limits exceeded:', limitCheck.errors)
      // Use fallback model if available
      if (modelConfig.fallback_model) {
        const fallbackConfig = modelConfigManager.getModel(modelConfig.fallback_model)
        if (fallbackConfig) {
          return generateEmbeddings(texts, { ...options, modelId: fallbackConfig.id })
        }
      }
      throw new Error(`Usage limits exceeded: ${limitCheck.errors.join(', ')}`)
    }

    const startTime = Date.now()
    
    const response = await openai.embeddings.create({
      model: modelConfig.model,
      input: texts,
      encoding_format: 'float'
    })

    const totalTokensUsed = response.usage.total_tokens
    const tokensPerText = totalTokensUsed / texts.length
    const totalCost = modelConfigManager.calculateCost(modelConfig.id, totalTokensUsed)
    const costPerText = totalCost / texts.length

    // Record usage
    const usage: ModelUsage = {
      model_id: modelConfig.id,
      tokens_used: totalTokensUsed,
      cost: totalCost,
      timestamp: new Date().toISOString(),
      user_id: options?.userId,
      workspace_id: options?.workspaceId,
      operation_type: 'embedding'
    }
    modelConfigManager.recordUsage(usage)

    const processingTime = Date.now() - startTime
    console.log(`Batch embeddings generated: ${texts.length} texts, ${totalTokensUsed} tokens, $${totalCost.toFixed(4)} cost, ${processingTime}ms`)

    return response.data.map((item) => ({
      embedding: item.embedding,
      tokens_used: tokensPerText,
      model: modelConfig.model,
      cost: costPerText,
      provider: modelConfig.provider
    }))
  } catch (error) {
    console.error('Error generating embeddings:', error)
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i]
    norm1 += embedding1[i] * embedding1[i]
    norm2 += embedding2[i] * embedding2[i]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (norm1 === 0 || norm2 === 0) {
    return 0
  }

  return dotProduct / (norm1 * norm2)
}

/**
 * Find most similar embeddings using cosine similarity
 */
export function findMostSimilar(
  queryEmbedding: number[],
  candidateEmbeddings: Array<{ id: string; embedding: number[] }>,
  topK: number = 5
): Array<{ id: string; similarity: number }> {
  const similarities = candidateEmbeddings.map(candidate => ({
    id: candidate.id,
    similarity: calculateCosineSimilarity(queryEmbedding, candidate.embedding)
  }))

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}

/**
 * Generate embedding for AI summary content
 */
export async function generateSummaryEmbedding(
  summary: {
    summary?: string
    key_points?: string[]
    tags?: string[]
  },
  options?: {
    userId?: string
    workspaceId?: string
    modelId?: string
  }
): Promise<EmbeddingResult> {
  const content = [
    summary.summary || '',
    ...(summary.key_points || []),
    ...(summary.tags || [])
  ].join(' ')

  return generateEmbedding(content, options)
}
