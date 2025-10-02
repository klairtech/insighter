/**
 * Cold Start Solutions
 * 
 * Implements solutions for cold start problems in ML models, including
 * transfer learning, default strategies, and data sparsity handling.
 */

import { supabaseServer as supabase } from './server-utils'
import { MLFeatures, MLPrediction } from './ml-learning-service'

export interface ColdStartSolution {
  id: string
  workspace_id: string
  user_id?: string
  solution_type: 'transfer_learning' | 'default_strategy' | 'similar_workspace' | 'synthetic_data'
  source_workspace_id?: string
  source_user_id?: string
  similarity_score: number
  solution_data: {
    default_features: MLFeatures
    default_prediction: MLPrediction
    fallback_strategies: string[]
    confidence_threshold: number
  }
  effectiveness_score: number
  usage_count: number
  created_at: string
  updated_at: string
}

export interface SimilarityMatch {
  workspace_id: string
  user_id?: string
  similarity_score: number
  similarity_factors: {
    domain_similarity: number
    query_pattern_similarity: number
    data_source_similarity: number
    user_behavior_similarity: number
  }
  transferable_patterns: string[]
}

export interface SyntheticDataGenerator {
  generateFeatures(query: string, context: unknown): MLFeatures
  generatePrediction(features: MLFeatures): MLPrediction
  generateInteractionData(count: number): unknown[]
}

/**
 * Cold Start Solutions Manager
 */
export class ColdStartSolutionsManager {
  private static instance: ColdStartSolutionsManager
  private defaultSolutions: Map<string, ColdStartSolution> = new Map()
  private similarityCache: Map<string, SimilarityMatch[]> = new Map()
  private syntheticDataGenerator: SyntheticDataGenerator

  private constructor() {
    this.syntheticDataGenerator = new DefaultSyntheticDataGenerator()
    this.initializeDefaultSolutions()
  }

  public static getInstance(): ColdStartSolutionsManager {
    if (!ColdStartSolutionsManager.instance) {
      ColdStartSolutionsManager.instance = new ColdStartSolutionsManager()
    }
    return ColdStartSolutionsManager.instance
  }

  /**
   * Get cold start solution for new workspace/user
   */
  public async getColdStartSolution(
    workspaceId: string,
    userId?: string,
    query?: string
  ): Promise<ColdStartSolution> {
    try {
      // Check if we have a cached solution
      const cacheKey = `${workspaceId}_${userId || 'anonymous'}`
      if (this.defaultSolutions.has(cacheKey)) {
        return this.defaultSolutions.get(cacheKey)!
      }

      // Try different solution strategies
      let solution: ColdStartSolution | null = null

      // 1. Try transfer learning from similar workspace
      solution = await this.tryTransferLearning(workspaceId, userId, query)
      if (solution) {
        await this.storeSolution(solution)
        return solution
      }

      // 2. Try similar user patterns
      solution = await this.trySimilarUserPatterns(workspaceId, userId, query)
      if (solution) {
        await this.storeSolution(solution)
        return solution
      }

      // 3. Use default strategy
      solution = await this.createDefaultStrategy(workspaceId, userId, query)
      await this.storeSolution(solution)
      return solution

    } catch (error) {
      console.error('Cold start solution error:', error)
      return this.getFallbackSolution(workspaceId, userId)
    }
  }

  /**
   * Try transfer learning from similar workspace
   */
  private async tryTransferLearning(
    workspaceId: string,
    userId?: string,
    query?: string
  ): Promise<ColdStartSolution | null> {
    try {
      // Find similar workspaces
      const similarWorkspaces = await this.findSimilarWorkspaces(workspaceId, query)
      
      if (similarWorkspaces.length === 0) return null

      const bestMatch = similarWorkspaces[0]
      
      // Get successful patterns from similar workspace
      const { data: patterns } = await supabase
        .from('user_interaction_patterns')
        .select('*')
        .eq('workspace_id', bestMatch.workspace_id)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!patterns || patterns.length === 0) return null

      // Analyze patterns to create solution
      const solutionData = this.analyzePatternsForSolution(patterns, query)
      
      return {
        id: this.generateSolutionId(),
        workspace_id: workspaceId,
        user_id: userId,
        solution_type: 'transfer_learning',
        source_workspace_id: bestMatch.workspace_id,
        similarity_score: bestMatch.similarity_score,
        solution_data: solutionData,
        effectiveness_score: 0.7, // Initial score, will be updated based on usage
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

    } catch (error) {
      console.error('Transfer learning error:', error)
      return null
    }
  }

  /**
   * Try similar user patterns
   */
  private async trySimilarUserPatterns(
    workspaceId: string,
    userId?: string,
    query?: string
  ): Promise<ColdStartSolution | null> {
    try {
      if (!userId) return null

      // Find similar users
      const similarUsers = await this.findSimilarUsers(userId, query)
      
      if (similarUsers.length === 0) return null

      const bestMatch = similarUsers[0]
      
      // Get successful patterns from similar user
      const { data: patterns } = await supabase
        .from('user_interaction_patterns')
        .select('*')
        .eq('user_id', bestMatch.user_id)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!patterns || patterns.length === 0) return null

      // Analyze patterns to create solution
      const solutionData = this.analyzePatternsForSolution(patterns, query)
      
      return {
        id: this.generateSolutionId(),
        workspace_id: workspaceId,
        user_id: userId,
        solution_type: 'similar_workspace',
        source_user_id: bestMatch.user_id,
        similarity_score: bestMatch.similarity_score,
        solution_data: solutionData,
        effectiveness_score: 0.6,
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

    } catch (error) {
      console.error('Similar user patterns error:', error)
      return null
    }
  }

  /**
   * Create default strategy
   */
  private async createDefaultStrategy(
    workspaceId: string,
    userId?: string,
    query?: string
  ): Promise<ColdStartSolution> {
    try {
      // Generate default features
      const defaultFeatures = this.generateDefaultFeatures(query)
      
      // Generate default prediction
      const defaultPrediction = this.generateDefaultPrediction(defaultFeatures)
      
      // Create fallback strategies
      const fallbackStrategies = this.generateFallbackStrategies()
      
      return {
        id: this.generateSolutionId(),
        workspace_id: workspaceId,
        user_id: userId,
        solution_type: 'default_strategy',
        similarity_score: 0.5,
        solution_data: {
          default_features: defaultFeatures,
          default_prediction: defaultPrediction,
          fallback_strategies: fallbackStrategies,
          confidence_threshold: 0.6
        },
        effectiveness_score: 0.5,
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

    } catch (error) {
      console.error('Default strategy creation error:', error)
      return this.getFallbackSolution(workspaceId, userId)
    }
  }

  /**
   * Generate synthetic data for training
   */
  public async generateSyntheticData(
    workspaceId: string,
    dataType: 'features' | 'interactions' | 'patterns',
    count: number = 100
  ): Promise<unknown[]> {
    try {
      switch (dataType) {
        case 'features':
          return this.generateSyntheticFeatures(count)
        case 'interactions':
          return this.generateSyntheticInteractions(workspaceId, count)
        case 'patterns':
          return this.generateSyntheticPatterns(workspaceId, count)
        default:
          return []
      }
    } catch (error) {
      console.error('Synthetic data generation error:', error)
      return []
    }
  }

  /**
   * Handle data sparsity
   */
  public async handleDataSparsity(
    workspaceId: string,
    userId?: string,
    queryType?: string
  ): Promise<{
    solution: ColdStartSolution
    syntheticData: unknown[]
    confidence: number
  }> {
    try {
      // Check data availability
      const dataAvailability = await this.checkDataAvailability(workspaceId, userId, queryType)
      
      if (dataAvailability.isSparse) {
        // Generate synthetic data
        const syntheticData = await this.generateSyntheticData(workspaceId, 'interactions', 50)
        
        // Create solution with synthetic data
        const solution = await this.createSyntheticDataSolution(workspaceId, userId, syntheticData)
        
        return {
          solution,
          syntheticData,
          confidence: 0.4 // Lower confidence due to synthetic data
        }
      } else {
        // Use regular cold start solution
        const solution = await this.getColdStartSolution(workspaceId, userId)
        return {
          solution,
          syntheticData: [],
          confidence: 0.7
        }
      }

    } catch (error) {
      console.error('Data sparsity handling error:', error)
      return {
        solution: this.getFallbackSolution(workspaceId, userId),
        syntheticData: [],
        confidence: 0.3
      }
    }
  }

  /**
   * Update solution effectiveness
   */
  public async updateSolutionEffectiveness(
    solutionId: string,
    success: boolean,
    userSatisfaction?: number
  ): Promise<void> {
    try {
      const { data: solution } = await supabase
        .from('cold_start_solutions')
        .select('*')
        .eq('id', solutionId)
        .single()

      if (!solution) return

      // Update effectiveness score
      const currentScore = solution.effectiveness_score
      const usageCount = solution.usage_count + 1
      const successWeight = success ? 1 : 0
      const satisfactionWeight = userSatisfaction ? userSatisfaction / 5 : 0.5
      
      const newScore = (currentScore * (usageCount - 1) + successWeight * satisfactionWeight) / usageCount

      await supabase
        .from('cold_start_solutions')
        .update({
          effectiveness_score: newScore,
          usage_count: usageCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', solutionId)

    } catch (error) {
      console.error('Solution effectiveness update error:', error)
    }
  }

  // Helper methods
  private async findSimilarWorkspaces(workspaceId: string, query?: string): Promise<SimilarityMatch[]> {
    try {
      // Get workspace data
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()

      if (!workspace) return []

      // Find similar workspaces based on various factors
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('*')
        .neq('id', workspaceId)

      if (!allWorkspaces) return []

      const similarities: SimilarityMatch[] = []

      for (const otherWorkspace of allWorkspaces) {
        const similarity = await this.calculateWorkspaceSimilarity(workspace, otherWorkspace, query)
        
        if (similarity.similarity_score > 0.3) {
          similarities.push({
            workspace_id: otherWorkspace.id,
            similarity_score: similarity.similarity_score,
            similarity_factors: similarity.similarity_factors,
            transferable_patterns: similarity.transferable_patterns
          })
        }
      }

      return similarities.sort((a, b) => b.similarity_score - a.similarity_score)

    } catch (error) {
      console.error('Find similar workspaces error:', error)
      return []
    }
  }

  private async findSimilarUsers(userId: string, _query?: string): Promise<SimilarityMatch[]> {
    try {
      // Get user data
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!user) return []

      // Find similar users based on interaction patterns
      const { data: userPatterns } = await supabase
        .from('user_interaction_patterns')
        .select('user_id, query_intent, processing_strategy, success')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!userPatterns || userPatterns.length === 0) return []

      // Find other users with similar patterns
      const { data: allPatterns } = await supabase
        .from('user_interaction_patterns')
        .select('user_id, query_intent, processing_strategy, success')
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (!allPatterns) return []

      const userSimilarities: Map<string, SimilarityMatch> = new Map()

      for (const pattern of allPatterns) {
        const similarity = this.calculateUserPatternSimilarity(userPatterns, [pattern])
        
        if (similarity > 0.3) {
          if (!userSimilarities.has(pattern.user_id)) {
            userSimilarities.set(pattern.user_id, {
              workspace_id: '', // Will be set from context
              user_id: pattern.user_id,
              similarity_score: similarity,
              similarity_factors: {
                domain_similarity: similarity,
                query_pattern_similarity: similarity,
                data_source_similarity: 0.5,
                user_behavior_similarity: similarity
              },
              transferable_patterns: [pattern.processing_strategy]
            })
          } else {
            const existing = userSimilarities.get(pattern.user_id)!
            existing.similarity_score = Math.max(existing.similarity_score, similarity)
            existing.transferable_patterns.push(pattern.processing_strategy)
          }
        }
      }

      return Array.from(userSimilarities.values())
        .sort((a, b) => b.similarity_score - a.similarity_score)

    } catch (error) {
      console.error('Find similar users error:', error)
      return []
    }
  }

  private async calculateWorkspaceSimilarity(
    workspace1: unknown,
    workspace2: unknown,
    _query?: string
  ): Promise<{
    similarity_score: number
    similarity_factors: SimilarityMatch['similarity_factors']
    transferable_patterns: string[]
  }> {
    const ws1 = workspace1 as { id: string; name?: string; description?: string }
    const ws2 = workspace2 as { id: string; name?: string; description?: string }
    
    // Calculate domain similarity
    const domainSimilarity = this.calculateDomainSimilarity(ws1, ws2)
    
    // Calculate data source similarity
    const dataSourceSimilarity = await this.calculateDataSourceSimilarity(ws1.id, ws2.id)
    
    // Calculate query pattern similarity
    const queryPatternSimilarity = await this.calculateQueryPatternSimilarity(ws1.id, ws2.id)
    
    // Calculate user behavior similarity
    const userBehaviorSimilarity = await this.calculateUserBehaviorSimilarity(ws1.id, ws2.id)

    const overallSimilarity = (
      domainSimilarity * 0.3 +
      dataSourceSimilarity * 0.3 +
      queryPatternSimilarity * 0.2 +
      userBehaviorSimilarity * 0.2
    )

    return {
      similarity_score: overallSimilarity,
      similarity_factors: {
        domain_similarity: domainSimilarity,
        query_pattern_similarity: queryPatternSimilarity,
        data_source_similarity: dataSourceSimilarity,
        user_behavior_similarity: userBehaviorSimilarity
      },
      transferable_patterns: await this.getTransferablePatterns(ws2.id)
    }
  }

  private calculateDomainSimilarity(workspace1: { name?: string; description?: string }, workspace2: { name?: string; description?: string }): number {
    // Simple domain similarity based on workspace name and description
    const name1 = (workspace1.name || '').toLowerCase()
    const name2 = (workspace2.name || '').toLowerCase()
    const desc1 = (workspace1.description || '').toLowerCase()
    const desc2 = (workspace2.description || '').toLowerCase()

    const nameSimilarity = this.calculateTextSimilarity(name1, name2)
    const descSimilarity = this.calculateTextSimilarity(desc1, desc2)

    return (nameSimilarity + descSimilarity) / 2
  }

  private async calculateDataSourceSimilarity(workspaceId1: string, workspaceId2: string): Promise<number> {
    try {
      const { data: sources1 } = await supabase
        .from('database_connections')
        .select('connection_type')
        .eq('workspace_id', workspaceId1)

      const { data: sources2 } = await supabase
        .from('database_connections')
        .select('connection_type')
        .eq('workspace_id', workspaceId2)

      if (!sources1 || !sources2) return 0

      const types1 = sources1.map((s: { connection_type: string }) => s.connection_type)
      const types2 = sources2.map((s: { connection_type: string }) => s.connection_type)

      const intersection = types1.filter(type => types2.includes(type))
      const union = [...new Set([...types1, ...types2])]

      return intersection.length / union.length

    } catch {
      return 0
    }
  }

  private async calculateQueryPatternSimilarity(workspaceId1: string, workspaceId2: string): Promise<number> {
    try {
      const { data: patterns1 } = await supabase
        .from('user_interaction_patterns')
        .select('query_intent, processing_strategy')
        .eq('workspace_id', workspaceId1)
        .limit(100)

      const { data: patterns2 } = await supabase
        .from('user_interaction_patterns')
        .select('query_intent, processing_strategy')
        .eq('workspace_id', workspaceId2)
        .limit(100)

      if (!patterns1 || !patterns2) return 0

      return this.calculateUserPatternSimilarity(patterns1 as Array<{ query_intent: string; processing_strategy: string }>, patterns2 as Array<{ query_intent: string; processing_strategy: string }>)

    } catch {
      return 0
    }
  }

  private async calculateUserBehaviorSimilarity(workspaceId1: string, workspaceId2: string): Promise<number> {
    try {
      const { data: behavior1 } = await supabase
        .from('user_interaction_patterns')
        .select('user_satisfaction_score, execution_time_ms')
        .eq('workspace_id', workspaceId1)
        .not('user_satisfaction_score', 'is', null)
        .limit(100)

      const { data: behavior2 } = await supabase
        .from('user_interaction_patterns')
        .select('user_satisfaction_score, execution_time_ms')
        .eq('workspace_id', workspaceId2)
        .not('user_satisfaction_score', 'is', null)
        .limit(100)

      if (!behavior1 || !behavior2 || behavior1.length === 0 || behavior2.length === 0) return 0

      const behavior1Typed = behavior1 as Array<{ user_satisfaction_score: number; execution_time_ms: number }>
      const behavior2Typed = behavior2 as Array<{ user_satisfaction_score: number; execution_time_ms: number }>

      const avgSatisfaction1 = behavior1Typed.reduce((sum, b) => sum + b.user_satisfaction_score, 0) / behavior1Typed.length
      const avgSatisfaction2 = behavior2Typed.reduce((sum, b) => sum + b.user_satisfaction_score, 0) / behavior2Typed.length

      const avgTime1 = behavior1Typed.reduce((sum, b) => sum + b.execution_time_ms, 0) / behavior1Typed.length
      const avgTime2 = behavior2Typed.reduce((sum, b) => sum + b.execution_time_ms, 0) / behavior2Typed.length

      const satisfactionSimilarity = 1 - Math.abs(avgSatisfaction1 - avgSatisfaction2) / 5
      const timeSimilarity = 1 - Math.abs(avgTime1 - avgTime2) / Math.max(avgTime1, avgTime2, 1)

      return (satisfactionSimilarity + timeSimilarity) / 2

    } catch {
      return 0
    }
  }

  private calculateUserPatternSimilarity(patterns1: Array<{ query_intent: string; processing_strategy: string }>, patterns2: Array<{ query_intent: string; processing_strategy: string }>): number {
    if (patterns1.length === 0 || patterns2.length === 0) return 0

    const intents1 = patterns1.map(p => p.query_intent)
    const intents2 = patterns2.map(p => p.query_intent)
    const strategies1 = patterns1.map(p => p.processing_strategy)
    const strategies2 = patterns2.map(p => p.processing_strategy)

    const intentIntersection = intents1.filter(intent => intents2.includes(intent))
    const strategyIntersection = strategies1.filter(strategy => strategies2.includes(strategy))

    const intentSimilarity = intentIntersection.length / Math.max(intents1.length, intents2.length)
    const strategySimilarity = strategyIntersection.length / Math.max(strategies1.length, strategies2.length)

    return (intentSimilarity + strategySimilarity) / 2
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    const words1 = new Set(text1.split(/\s+/))
    const words2 = new Set(text2.split(/\s+/))

    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  private async getTransferablePatterns(workspaceId: string): Promise<string[]> {
    try {
      const { data: patterns } = await supabase
        .from('user_interaction_patterns')
        .select('processing_strategy')
        .eq('workspace_id', workspaceId)
        .eq('success', true)
        .limit(50)

      if (!patterns) return []

      const strategyCounts: Record<string, number> = {}
      patterns.forEach((p: { processing_strategy: string }) => {
        strategyCounts[p.processing_strategy] = (strategyCounts[p.processing_strategy] || 0) + 1
      })

      return Object.entries(strategyCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([strategy]) => strategy)

    } catch {
      return []
    }
  }

  private analyzePatternsForSolution(patterns: unknown[], query?: string): ColdStartSolution['solution_data'] {
    // Analyze patterns to extract common features and strategies
    const commonStrategies = this.getCommonStrategies(patterns)
    const _commonFeatures = this.getCommonFeatures(patterns)
    
    const defaultFeatures = this.generateDefaultFeatures(query)
    const defaultPrediction = this.generateDefaultPrediction(defaultFeatures)

    return {
      default_features: defaultFeatures,
      default_prediction: defaultPrediction,
      fallback_strategies: commonStrategies,
      confidence_threshold: 0.6
    }
  }

  private getCommonStrategies(patterns: unknown[]): string[] {
    const strategyCounts: Record<string, number> = {}
    patterns.forEach((p: unknown) => {
      const pattern = p as { processing_strategy: string }
      strategyCounts[pattern.processing_strategy] = (strategyCounts[pattern.processing_strategy] || 0) + 1
    })

    return Object.entries(strategyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strategy]) => strategy)
  }

  private getCommonFeatures(patterns: unknown[]): Record<string, number> {
    // Extract common features from patterns
    return {
      query_complexity: patterns.reduce((sum: number, p: unknown) => {
        const pattern = p as { query_complexity_score?: number }
        return sum + (pattern.query_complexity_score || 0.5)
      }, 0) / patterns.length,
      conversation_length: patterns.reduce((sum: number, p: unknown) => {
        const pattern = p as { conversation_length?: number }
        return sum + (pattern.conversation_length || 1)
      }, 0) / patterns.length
    }
  }

  private generateDefaultFeatures(query?: string): MLFeatures {
    return {
      query_length: query?.length || 50,
      query_complexity: 0.5,
      conversation_length: 1,
      previous_failures: 0,
      time_of_day: new Date().getHours(),
      day_of_week: new Date().getDay(),
      user_experience_level: 0.3,
      workspace_data_sources_count: 1,
      query_entities: [],
      query_intent: 'general',
      context_similarity: 0.5,
      semantic_similarity: 0.5,
      domain_specific_features: {},
      user_intent_confidence: 0.5,
      query_sentiment: 0,
      technical_complexity: 0.3,
      business_context_score: 0.3,
      session_duration: 0,
      time_since_last_query: 0,
      query_frequency: 0,
      peak_usage_hours: 12,
      user_activity_pattern: 0.3,
      conversation_sentiment: 0,
      data_source_effectiveness: {},
      agent_performance_history: {},
      workspace_specific_patterns: {},
      user_preference_indicators: {},
      query_embedding: [],
      context_embedding: [],
      semantic_entities: [],
      domain_keywords: [],
      complexity_indicators: {}
    }
  }

  private generateDefaultPrediction(_features: MLFeatures): MLPrediction {
    return {
      strategy: 'standard_processing',
      confidence: 0.6,
      reasoning: 'Default strategy for new user/workspace',
      expected_success_rate: 0.7,
      recommended_agents: ['validation', 'data_source_filter'],
      processing_priority: 0.5,
      estimated_processing_time: 2000,
      resource_requirements: { cpu_intensive: 0.3, memory_intensive: 0.2 },
      fallback_strategies: ['simplified_analysis', 'basic_retrieval'],
      user_satisfaction_prediction: 0.7
    }
  }

  private generateFallbackStrategies(): string[] {
    return [
      'standard_processing',
      'simplified_analysis',
      'basic_retrieval',
      'guided_approach'
    ]
  }

  private generateSyntheticFeatures(count: number): MLFeatures[] {
    const features: MLFeatures[] = []
    
    for (let i = 0; i < count; i++) {
      features.push(this.generateDefaultFeatures())
    }
    
    return features
  }

  private generateSyntheticInteractions(workspaceId: string, count: number): unknown[] {
    const interactions: unknown[] = []
    
    for (let i = 0; i < count; i++) {
      interactions.push({
        workspace_id: workspaceId,
        original_query: `Synthetic query ${i}`,
        query_intent: 'general',
        processing_strategy: 'standard_processing',
        success: Math.random() > 0.3,
        execution_time_ms: 1000 + Math.random() * 2000,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    return interactions
  }

  private generateSyntheticPatterns(workspaceId: string, count: number): unknown[] {
    return this.generateSyntheticInteractions(workspaceId, count)
  }

  private async checkDataAvailability(
    workspaceId: string,
    userId?: string,
    queryType?: string
  ): Promise<{ isSparse: boolean; dataCount: number }> {
    try {
      let query = supabase
        .from('user_interaction_patterns')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (queryType) {
        query = query.eq('query_intent', queryType)
      }

      const { count } = await query

      return {
        isSparse: (count || 0) < 10,
        dataCount: count || 0
      }

    } catch {
      return { isSparse: true, dataCount: 0 }
    }
  }

  private async createSyntheticDataSolution(
    workspaceId: string,
    userId: string | undefined,
    _syntheticData: unknown[]
  ): Promise<ColdStartSolution> {
    const defaultFeatures = this.generateDefaultFeatures()
    const defaultPrediction = this.generateDefaultPrediction(defaultFeatures)

    return {
      id: this.generateSolutionId(),
      workspace_id: workspaceId,
      user_id: userId,
      solution_type: 'synthetic_data',
      similarity_score: 0.4,
      solution_data: {
        default_features: defaultFeatures,
        default_prediction: defaultPrediction,
        fallback_strategies: this.generateFallbackStrategies(),
        confidence_threshold: 0.4
      },
      effectiveness_score: 0.4,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  private getFallbackSolution(workspaceId: string, userId?: string): ColdStartSolution {
    return {
      id: this.generateSolutionId(),
      workspace_id: workspaceId,
      user_id: userId,
      solution_type: 'default_strategy',
      similarity_score: 0.3,
      solution_data: {
        default_features: this.generateDefaultFeatures(),
        default_prediction: this.generateDefaultPrediction(this.generateDefaultFeatures()),
        fallback_strategies: ['standard_processing'],
        confidence_threshold: 0.3
      },
      effectiveness_score: 0.3,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  private generateSolutionId(): string {
    return `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async storeSolution(solution: ColdStartSolution): Promise<void> {
    try {
      await supabase
        .from('cold_start_solutions')
        .insert(solution)
    } catch (error) {
      console.error('Error storing solution:', error)
    }
  }

  private initializeDefaultSolutions(): void {
    // Initialize with some default solutions
    // This could be loaded from a configuration file or database
  }
}

/**
 * Default Synthetic Data Generator
 */
class DefaultSyntheticDataGenerator implements SyntheticDataGenerator {
  generateFeatures(query: string, _context: unknown): MLFeatures {
    return {
      query_length: query.length,
      query_complexity: Math.random(),
      conversation_length: 1,
      previous_failures: 0,
      time_of_day: new Date().getHours(),
      day_of_week: new Date().getDay(),
      user_experience_level: Math.random(),
      workspace_data_sources_count: 1,
      query_entities: [],
      query_intent: 'general',
      context_similarity: Math.random(),
      semantic_similarity: Math.random(),
      domain_specific_features: {},
      user_intent_confidence: Math.random(),
      query_sentiment: Math.random() * 2 - 1,
      technical_complexity: Math.random(),
      business_context_score: Math.random(),
      session_duration: Math.random() * 60,
      time_since_last_query: Math.random() * 60,
      query_frequency: Math.random() * 10,
      peak_usage_hours: Math.floor(Math.random() * 24),
      user_activity_pattern: Math.random(),
      conversation_sentiment: Math.random() * 2 - 1,
      data_source_effectiveness: {},
      agent_performance_history: {},
      workspace_specific_patterns: {},
      user_preference_indicators: {},
      query_embedding: [],
      context_embedding: [],
      semantic_entities: [],
      domain_keywords: [],
      complexity_indicators: {}
    }
  }

  generatePrediction(_features: MLFeatures): MLPrediction {
    return {
      strategy: 'standard_processing',
      confidence: 0.5 + Math.random() * 0.3,
      reasoning: 'Synthetic prediction',
      expected_success_rate: 0.6 + Math.random() * 0.3,
      recommended_agents: ['validation', 'data_source_filter'],
      processing_priority: Math.random(),
      estimated_processing_time: 1000 + Math.random() * 3000,
      resource_requirements: {
        cpu_intensive: Math.random(),
        memory_intensive: Math.random(),
        network_intensive: Math.random(),
        storage_intensive: Math.random()
      },
      fallback_strategies: ['simplified_analysis'],
      user_satisfaction_prediction: 0.6 + Math.random() * 0.3
    }
  }

  generateInteractionData(count: number): unknown[] {
    const interactions: unknown[] = []
    
    for (let i = 0; i < count; i++) {
      interactions.push({
        query: `Synthetic query ${i}`,
        features: this.generateFeatures(`Synthetic query ${i}`, {}),
        prediction: this.generatePrediction(this.generateFeatures(`Synthetic query ${i}`, {})),
        success: Math.random() > 0.3,
        processing_time_ms: 1000 + Math.random() * 2000,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    return interactions
  }
}

export const coldStartSolutionsManager = ColdStartSolutionsManager.getInstance()
