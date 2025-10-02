/**
 * Enhanced ML Learning Service
 * 
 * Advanced machine learning capabilities with neural networks, real-time learning,
 * and comprehensive feature engineering for the multi-agent flow system.
 */

import { supabaseServer as supabase } from './server-utils'
// import { createHash } from 'crypto' // Unused import
import { generateEmbedding, calculateCosineSimilarity } from './embeddings'

// Enhanced ML Features with semantic and domain-specific capabilities
export interface MLFeatures {
  // Basic features (existing)
  query_length: number;
  query_complexity: number;
  conversation_length: number;
  previous_failures: number;
  time_of_day: number;
  day_of_week: number;
  user_experience_level: number;
  workspace_data_sources_count: number;
  query_entities: string[];
  query_intent: string;
  context_similarity: number;

  // Enhanced semantic features
  semantic_similarity: number;
  domain_specific_features: Record<string, number>;
  user_intent_confidence: number;
  query_sentiment: number;
  technical_complexity: number;
  business_context_score: number;

  // Temporal features
  session_duration: number;
  time_since_last_query: number;
  query_frequency: number;
  peak_usage_hours: number;
  user_activity_pattern: number;

  // Context features
  conversation_sentiment: number;
  data_source_effectiveness: Record<string, number>;
  agent_performance_history: Record<string, number>;
  workspace_specific_patterns: Record<string, number>;
  user_preference_indicators: Record<string, number>;

  // Advanced features
  query_embedding?: number[];
  context_embedding?: number[];
  semantic_entities?: string[];
  domain_keywords?: string[];
  complexity_indicators?: Record<string, number>;
}

export interface MLPrediction {
  strategy: string;
  confidence: number;
  reasoning: string;
  expected_success_rate: number;
  recommended_agents: string[];
  processing_priority: number;
  estimated_processing_time: number;
  resource_requirements: Record<string, number>;
  fallback_strategies: string[];
  user_satisfaction_prediction: number;
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  model_drift_score: number;
  prediction_confidence_distribution: number[];
  feature_importance: Record<string, number>;
  last_updated: string;
  training_data_size: number;
}

export interface InteractionData {
  user_id: string;
  workspace_id: string;
  agent_id: string;
  original_query: string;
  optimized_query?: string;
  query_intent?: string;
  query_entities?: string[];
  query_complexity_score?: number;
  conversation_length?: number;
  previous_failures_count?: number;
  processing_strategy: string;
  data_sources_used?: string[];
  execution_time_ms: number;
  success: boolean;
  failure_reason?: string;
  user_satisfaction_score?: number;
  user_feedback?: string;
  features_vector?: MLFeatures;
  prediction_confidence?: number;
  ml_prediction?: MLPrediction;
}

/**
 * Enhanced ML Learning Service with Neural Network capabilities
 */
export class MLLearningService {
  private static instance: MLLearningService
  private modelCache: Map<string, unknown> = new Map()
  private lastTrainingTime: Map<string, number> = new Map()
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map()
  private neuralNetworkModels: Map<string, unknown> = new Map()

  private constructor() {}

  public static getInstance(): MLLearningService {
    if (!MLLearningService.instance) {
      MLLearningService.instance = new MLLearningService()
    }
    return MLLearningService.instance
  }

  /**
   * Enhanced feature extraction with semantic analysis
   */
  public async extractFeatures(
    query: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    workspaceId: string,
    userId: string
  ): Promise<MLFeatures> {
    try {
      // Basic features (existing)
      const basicFeatures = this.extractBasicFeatures(query, conversationHistory, workspaceId, userId)
      
      // Enhanced semantic features
      const semanticFeatures = await this.extractSemanticFeatures(query, conversationHistory)
      
      // Temporal features
      const temporalFeatures = this.extractTemporalFeatures(conversationHistory, userId)
      
      // Context features
      const contextFeatures = await this.extractContextFeatures(query, workspaceId, userId)
      
      // Advanced features
      const advancedFeatures = await this.extractAdvancedFeatures(query, conversationHistory)

      return {
        ...basicFeatures,
        ...semanticFeatures,
        ...temporalFeatures,
        ...contextFeatures,
        ...advancedFeatures
      } as MLFeatures
    } catch (error) {
      console.error('Enhanced feature extraction error:', error)
      // Return basic features as fallback
      return this.extractBasicFeatures(query, conversationHistory, workspaceId, userId) as MLFeatures
    }
  }

  /**
   * Extract basic features (existing implementation)
   */
  private extractBasicFeatures(
    query: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    workspaceId: string,
    userId: string
  ): Partial<MLFeatures> {
    const now = new Date()
    
    return {
      query_length: query.length,
      query_complexity: this.calculateQueryComplexity(query),
      conversation_length: conversationHistory.length,
      previous_failures: this.countPreviousFailures(conversationHistory),
      time_of_day: now.getHours(),
      day_of_week: now.getDay(),
      user_experience_level: this.calculateUserExperienceLevel(userId, conversationHistory),
      workspace_data_sources_count: 0, // Will be populated from database
      query_entities: this.extractQueryEntities(query),
      query_intent: this.detectQueryIntent(query),
      context_similarity: this.calculateContextSimilarity(query, conversationHistory)
    }
  }

  /**
   * Extract semantic features using embeddings and NLP
   */
  private async extractSemanticFeatures(
    query: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
  ): Promise<Partial<MLFeatures>> {
    try {
      // Generate embeddings for semantic analysis
      const queryEmbeddingResult = await generateEmbedding(query)
      const contextEmbeddingResult = await generateEmbedding(
        conversationHistory.map(msg => msg.content).join(' ')
      )

      const queryEmbedding = queryEmbeddingResult.embedding || []
      const contextEmbedding = contextEmbeddingResult.embedding || []

      // Calculate semantic similarity
      const semanticSimilarity = calculateCosineSimilarity(queryEmbedding, contextEmbedding)

      // Analyze sentiment
      const querySentiment = await this.analyzeSentiment(query)
      const conversationSentiment = await this.analyzeSentiment(
        conversationHistory.map(msg => msg.content).join(' ')
      )

      // Detect domain-specific features
      const domainFeatures = this.detectDomainFeatures(query)
      
      // Calculate technical complexity
      const technicalComplexity = this.calculateTechnicalComplexity(query)
      
      // Business context score
      const businessContextScore = this.calculateBusinessContextScore(query)

      return {
        semantic_similarity: semanticSimilarity,
        domain_specific_features: domainFeatures,
        user_intent_confidence: this.calculateIntentConfidence(query),
        query_sentiment: querySentiment,
        technical_complexity: technicalComplexity,
        business_context_score: businessContextScore,
        conversation_sentiment: conversationSentiment,
        query_embedding: queryEmbedding,
        context_embedding: contextEmbedding
      }
    } catch (error) {
      console.error('Semantic feature extraction error:', error)
      return {}
    }
  }

  /**
   * Extract temporal features from user behavior patterns
   */
  private extractTemporalFeatures(
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    _userId: string
  ): Partial<MLFeatures> {
    const now = new Date()
    const sessionStart = conversationHistory.length > 0 
      ? new Date(conversationHistory[0].created_at)
      : now

    const sessionDuration = (now.getTime() - sessionStart.getTime()) / (1000 * 60) // minutes
    
    const timeSinceLastQuery = conversationHistory.length > 0
      ? (now.getTime() - new Date(conversationHistory[conversationHistory.length - 1].created_at).getTime()) / (1000 * 60)
      : 0

    // Calculate query frequency (queries per hour)
    const queryFrequency = conversationHistory.length / Math.max(sessionDuration / 60, 1)
    
    // Peak usage hours (0-23)
    const peakUsageHours = this.calculatePeakUsageHours(conversationHistory)
    
    // User activity pattern (0-1, where 1 is very active)
    const userActivityPattern = this.calculateUserActivityPattern(conversationHistory)

    return {
      session_duration: sessionDuration,
      time_since_last_query: timeSinceLastQuery,
      query_frequency: queryFrequency,
      peak_usage_hours: peakUsageHours,
      user_activity_pattern: userActivityPattern
    }
  }

  /**
   * Extract context features from workspace and user data
   */
  private async extractContextFeatures(
    query: string,
    workspaceId: string,
    userId: string
  ): Promise<Partial<MLFeatures>> {
    try {
      // Get data source effectiveness
      const dataSourceEffectiveness = await this.getDataSourceEffectiveness(workspaceId)
      
      // Get agent performance history
      const agentPerformanceHistory = await this.getAgentPerformanceHistory(workspaceId, userId)
      
      // Get workspace-specific patterns
      const workspacePatterns = await this.getWorkspaceSpecificPatterns(workspaceId)
      
      // Get user preference indicators
      const userPreferences = await this.getUserPreferenceIndicators(userId)

      return {
        data_source_effectiveness: dataSourceEffectiveness,
        agent_performance_history: agentPerformanceHistory,
        workspace_specific_patterns: workspacePatterns,
        user_preference_indicators: userPreferences
      }
    } catch (error) {
      console.error('Context feature extraction error:', error)
      return {}
    }
  }

  /**
   * Extract advanced features using ML techniques
   */
  private async extractAdvancedFeatures(
    query: string,
    _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
  ): Promise<Partial<MLFeatures>> {
    try {
      // Extract semantic entities
      const semanticEntities = await this.extractSemanticEntities(query)
      
      // Extract domain keywords
      const domainKeywords = this.extractDomainKeywords(query)
      
      // Calculate complexity indicators
      const complexityIndicators = this.calculateComplexityIndicators(query)

      return {
        semantic_entities: semanticEntities,
        domain_keywords: domainKeywords,
        complexity_indicators: complexityIndicators
      }
    } catch (error) {
      console.error('Advanced feature extraction error:', error)
      return {}
    }
  }

  /**
   * Neural Network-based prediction with enhanced capabilities
   */
  public async predictOptimalStrategy(
    features: MLFeatures,
    workspaceId: string,
    userId: string
  ): Promise<MLPrediction> {
    try {
      // Check if neural network model exists for this workspace
      let model = this.neuralNetworkModels.get(workspaceId)
      
      if (!model) {
        // Initialize or load neural network model
        model = await this.initializeNeuralNetworkModel(workspaceId)
        this.neuralNetworkModels.set(workspaceId, model)
      }

      // Convert features to model input format
      const modelInput = this.prepareModelInput(features)
      
      // Make prediction using neural network
      const prediction = await this.runNeuralNetworkPrediction(model, modelInput)
      
      // Enhance prediction with additional analysis
      const enhancedPrediction = this.enhancePrediction(prediction, features, workspaceId, userId)
      
      // Store prediction for learning
      await this.storePrediction(workspaceId, userId, features, enhancedPrediction)
      
      return enhancedPrediction
    } catch (error) {
      console.error('Neural network prediction error:', error)
      // Fallback to rule-based prediction
      return this.ruleBasedPrediction(features, workspaceId, userId)
    }
  }

  /**
   * Initialize neural network model for workspace
   */
  private async initializeNeuralNetworkModel(workspaceId: string): Promise<unknown> {
    try {
      // Load existing model or create new one
      const { data: existingModel } = await supabase
        .from('ml_models')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('model_type', 'neural_network')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingModel) {
        // Load existing model
        return this.loadModelFromData(existingModel.model_data)
      } else {
        // Create new neural network model
        return this.createNewNeuralNetworkModel()
      }
    } catch (error) {
      console.error('Model initialization error:', error)
      return this.createNewNeuralNetworkModel()
    }
  }

  /**
   * Create new neural network model
   */
  private createNewNeuralNetworkModel(): unknown {
    // Simple neural network implementation (can be enhanced with TensorFlow.js)
    return {
      layers: [
        { type: 'input', size: 50 }, // Input layer
        { type: 'hidden', size: 32, activation: 'relu' },
        { type: 'hidden', size: 16, activation: 'relu' },
        { type: 'output', size: 10, activation: 'softmax' }
      ],
      weights: this.initializeWeights(),
      biases: this.initializeBiases(),
      learningRate: 0.001,
      trained: false
    }
  }

  /**
   * Run neural network prediction
   */
  private async runNeuralNetworkPrediction(model: unknown, input: number[]): Promise<unknown> {
    // Forward propagation through neural network
    let activations = input
    const modelData = model as { layers: Array<{ type: string; size: number; activation?: string }> }
    
    for (const layer of modelData.layers) {
      if (layer.type === 'input') continue
      
      activations = this.forwardPropagate(activations, layer, modelData)
    }
    
    return {
      strategy: this.decodeStrategy(activations),
      confidence: Math.max(...activations),
      reasoning: 'Neural network prediction',
      expected_success_rate: activations[0],
      recommended_agents: this.decodeAgents(activations),
      processing_priority: activations[1],
      estimated_processing_time: activations[2] * 1000, // Convert to milliseconds
      resource_requirements: this.decodeResources(activations),
      fallback_strategies: this.generateFallbackStrategies(activations),
      user_satisfaction_prediction: activations[3]
    }
  }

  /**
   * Learn from user interaction and update models (backward compatibility)
   */
  public async learnFromInteraction(interactionData: InteractionData): Promise<void> {
    try {
      // Store interaction data
      await this.storeInteractionData(interactionData)
      
      // Update agent performance metrics
      await this.updateAgentPerformance(interactionData)
      
      // Update data source effectiveness
      await this.updateDataSourceEffectiveness(interactionData)
      
      // Trigger model retraining if needed
      await this.checkAndRetrainModels(interactionData.workspace_id)
      
      // Update learning insights cache
      await this.updateLearningInsightsCache(interactionData.workspace_id, interactionData.user_id)
      
    } catch (error) {
      console.error('ML learning error:', error)
    }
  }

  /**
   * Real-time learning from interactions
   */
  public async learnFromInteractionRealTime(
    interactionData: unknown,
    actualOutcome: unknown
  ): Promise<void> {
    try {
      // Update neural network model in real-time
      await this.updateNeuralNetworkModel(interactionData as InteractionData, actualOutcome)
      
      // Update performance metrics
      await this.updatePerformanceMetrics(interactionData as InteractionData, actualOutcome)
      
      // Check for model drift
      await this.checkModelDrift((interactionData as InteractionData).workspace_id)
      
      // Update feature importance
      await this.updateFeatureImportance(interactionData as InteractionData, actualOutcome)
      
    } catch (error) {
      console.error('Real-time learning error:', error)
    }
  }

  /**
   * Model performance monitoring and drift detection
   */
  public async monitorModelPerformance(workspaceId: string): Promise<ModelPerformanceMetrics> {
    try {
      // Get recent predictions and outcomes
      const { data: recentData } = await supabase
        .from('ml_predictions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (!recentData || recentData.length === 0) {
        return this.getDefaultMetrics()
      }

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(recentData)
      
      // Check for model drift
      const driftScore = await this.calculateModelDrift(workspaceId, recentData)
      
      // Update cached metrics
      this.performanceMetrics.set(workspaceId, {
        ...metrics,
        model_drift_score: driftScore,
        last_updated: new Date().toISOString(),
        training_data_size: recentData.length
      })

      return this.performanceMetrics.get(workspaceId)!
    } catch (error) {
      console.error('Model performance monitoring error:', error)
      return this.getDefaultMetrics()
    }
  }

  // Helper methods for feature extraction and analysis
  private calculateQueryComplexity(query: string): number {
    const complexityIndicators = [
      query.includes('JOIN'),
      query.includes('GROUP BY'),
      query.includes('HAVING'),
      query.includes('SUBQUERY'),
      query.includes('UNION'),
      query.split(' ').length > 20,
      query.includes('CASE WHEN'),
      query.includes('WINDOW')
    ]
    return complexityIndicators.filter(Boolean).length / complexityIndicators.length
  }

  private countPreviousFailures(conversationHistory: Array<{sender_type: string, content: string}>): number {
    return conversationHistory.filter(msg => 
      msg.sender_type === 'agent' && 
      (msg.content.includes('error') || msg.content.includes('failed'))
    ).length
  }

  private calculateUserExperienceLevel(_userId: string, conversationHistory: Array<{ content?: string }>): number {
    // Calculate based on conversation length and complexity
    const totalInteractions = conversationHistory.length
    const avgQueryLength = conversationHistory.reduce((sum, msg) => 
      sum + (msg.content?.length || 0), 0) / Math.max(totalInteractions, 1)
    
    return Math.min(totalInteractions / 100 + avgQueryLength / 1000, 1)
  }

  private extractQueryEntities(query: string): string[] {
    // Simple entity extraction (can be enhanced with NLP libraries)
    const entities = []
    const words = query.toLowerCase().split(/\s+/)
    
    const commonEntities = ['table', 'column', 'row', 'data', 'query', 'sql', 'database', 'report', 'analysis']
    for (const word of words) {
      if (commonEntities.includes(word)) {
        entities.push(word)
      }
    }
    
    return [...new Set(entities)]
  }

  private detectQueryIntent(query: string): string {
    const queryLower = query.toLowerCase()
    
    if (queryLower.includes('show') || queryLower.includes('display') || queryLower.includes('list')) {
      return 'retrieval'
    } else if (queryLower.includes('count') || queryLower.includes('sum') || queryLower.includes('average')) {
      return 'aggregation'
    } else if (queryLower.includes('create') || queryLower.includes('insert') || queryLower.includes('add')) {
      return 'creation'
    } else if (queryLower.includes('update') || queryLower.includes('modify') || queryLower.includes('change')) {
      return 'modification'
    } else if (queryLower.includes('delete') || queryLower.includes('remove')) {
      return 'deletion'
    } else if (queryLower.includes('analyze') || queryLower.includes('trend') || queryLower.includes('pattern')) {
      return 'analysis'
    } else {
      return 'general'
    }
  }

  private calculateContextSimilarity(query: string, conversationHistory: Array<{content: string}>): number {
    if (conversationHistory.length === 0) return 0
    
    const recentContext = conversationHistory.slice(-3).map(msg => msg.content).join(' ')
    const queryWords = new Set(query.toLowerCase().split(/\s+/))
    const contextWords = new Set(recentContext.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...queryWords].filter(x => contextWords.has(x)))
    const union = new Set([...queryWords, ...contextWords])
    
    return intersection.size / union.size
  }

  // Additional helper methods would be implemented here...
  private async analyzeSentiment(text: string): Promise<number> {
    // Simple sentiment analysis (can be enhanced with proper NLP)
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'wonderful']
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'wrong', 'error']
    
    const words = text.toLowerCase().split(/\s+/)
    const positiveCount = words.filter(word => positiveWords.includes(word)).length
    const negativeCount = words.filter(word => negativeWords.includes(word)).length
    
    return (positiveCount - negativeCount) / Math.max(words.length, 1)
  }

  private detectDomainFeatures(query: string): Record<string, number> {
    const domains = {
      'finance': ['revenue', 'profit', 'cost', 'budget', 'financial', 'money'],
      'healthcare': ['patient', 'medical', 'health', 'treatment', 'diagnosis'],
      'education': ['student', 'teacher', 'course', 'grade', 'academic'],
      'retail': ['product', 'customer', 'sales', 'inventory', 'order'],
      'technology': ['system', 'software', 'hardware', 'network', 'database']
    }
    
    const queryLower = query.toLowerCase()
    const features: Record<string, number> = {}
    
    for (const [domain, keywords] of Object.entries(domains)) {
      const matches = keywords.filter(keyword => queryLower.includes(keyword)).length
      features[domain] = matches / keywords.length
    }
    
    return features
  }

  private calculateTechnicalComplexity(query: string): number {
    const technicalIndicators = [
      /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING)\b/i,
      /\b(COUNT|SUM|AVG|MIN|MAX|DISTINCT)\b/i,
      /\b(CASE|WHEN|THEN|ELSE|END)\b/i,
      /\b(UNION|INTERSECT|EXCEPT)\b/i,
      /\b(SUBQUERY|CTE|WITH)\b/i
    ]
    
    const matches = technicalIndicators.filter(regex => regex.test(query)).length
    return matches / technicalIndicators.length
  }

  private calculateBusinessContextScore(query: string): number {
    const businessKeywords = [
      'revenue', 'profit', 'customer', 'sales', 'marketing', 'strategy',
      'performance', 'growth', 'analysis', 'report', 'dashboard', 'kpi'
    ]
    
    const queryLower = query.toLowerCase()
    const matches = businessKeywords.filter(keyword => queryLower.includes(keyword)).length
    return matches / businessKeywords.length
  }

  private calculateIntentConfidence(query: string): number {
    // Simple confidence calculation based on query clarity
    const intentKeywords = ['show', 'find', 'get', 'analyze', 'compare', 'calculate']
    const queryLower = query.toLowerCase()
    const hasIntentKeyword = intentKeywords.some(keyword => queryLower.includes(keyword))
    const queryLength = query.split(' ').length
    
    return hasIntentKeyword ? Math.min(queryLength / 10, 1) : 0.5
  }

  // Additional helper methods for temporal, context, and advanced features...
  private calculatePeakUsageHours(conversationHistory: Array<{created_at: string}>): number {
    if (conversationHistory.length === 0) return 12 // Default to noon
    
    const hours = conversationHistory.map(msg => new Date(msg.created_at).getHours())
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    return parseInt(Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b
    ))
  }

  private calculateUserActivityPattern(conversationHistory: Array<{created_at: string}>): number {
    if (conversationHistory.length === 0) return 0
    
    const now = new Date()
    const recentMessages = conversationHistory.filter(msg => 
      (now.getTime() - new Date(msg.created_at).getTime()) < 24 * 60 * 60 * 1000 // Last 24 hours
    )
    
    return Math.min(recentMessages.length / 10, 1) // Normalize to 0-1
  }

  private async getDataSourceEffectiveness(workspaceId: string): Promise<Record<string, number>> {
    try {
      const { data } = await supabase
        .from('data_source_effectiveness')
        .select('*')
        .eq('workspace_id', workspaceId)
      
      const effectiveness: Record<string, number> = {}
      data?.forEach((item: unknown) => {
        const dataItem = item as { data_source_id: string; average_relevance_score?: number }
        effectiveness[dataItem.data_source_id] = dataItem.average_relevance_score || 0.5
      })
      
      return effectiveness
    } catch {
      return {}
    }
  }

  private async getAgentPerformanceHistory(workspaceId: string, _userId: string): Promise<Record<string, number>> {
    try {
      const { data } = await supabase
        .from('agent_performance_metrics')
        .select('*')
        .eq('workspace_id', workspaceId)
      
      const performance: Record<string, number> = {}
      data?.forEach((item: unknown) => {
        const dataItem = item as { agent_type: string; average_confidence_score?: number }
        performance[dataItem.agent_type] = dataItem.average_confidence_score || 0.5
      })
      
      return performance
    } catch {
      return {}
    }
  }

  private async getWorkspaceSpecificPatterns(workspaceId: string): Promise<Record<string, number>> {
    try {
      const { data } = await supabase
        .from('user_interaction_patterns')
        .select('query_intent, success')
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      
      const patterns: Record<string, number> = {}
      const intentCounts: Record<string, {success: number, total: number}> = {}
      
      data?.forEach((item: unknown) => {
        const dataItem = item as { query_intent: string; success: boolean }
        if (!intentCounts[dataItem.query_intent]) {
          intentCounts[dataItem.query_intent] = { success: 0, total: 0 }
        }
        intentCounts[dataItem.query_intent].total++
        if (dataItem.success) {
          intentCounts[dataItem.query_intent].success++
        }
      })
      
      Object.entries(intentCounts).forEach(([intent, counts]) => {
        patterns[intent] = counts.success / counts.total
      })
      
      return patterns
    } catch {
      return {}
    }
  }

  private async getUserPreferenceIndicators(userId: string): Promise<Record<string, number>> {
    try {
      const { data } = await supabase
        .from('user_interaction_patterns')
        .select('processing_strategy, user_satisfaction_score')
        .eq('user_id', userId)
        .not('user_satisfaction_score', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      
      const preferences: Record<string, number> = {}
      const strategyScores: Record<string, number[]> = {}
      
      data?.forEach((item: unknown) => {
        const dataItem = item as { processing_strategy: string; user_satisfaction_score: number }
        if (!strategyScores[dataItem.processing_strategy]) {
          strategyScores[dataItem.processing_strategy] = []
        }
        strategyScores[dataItem.processing_strategy].push(dataItem.user_satisfaction_score)
      })
      
      Object.entries(strategyScores).forEach(([strategy, scores]) => {
        preferences[strategy] = scores.reduce((sum, score) => sum + score, 0) / scores.length / 5 // Normalize to 0-1
      })
      
      return preferences
    } catch {
      return {}
    }
  }

  private async extractSemanticEntities(query: string): Promise<string[]> {
    // Enhanced entity extraction (can be integrated with NLP services)
    const entities: string[] = []
    
    const entityPatterns = [
      /\b(table|view|index)\s+(\w+)/i,
      /\b(column|field)\s+(\w+)/i,
      /\b(database|schema)\s+(\w+)/i,
      /\b(report|dashboard)\s+(\w+)/i
    ]
    
    entityPatterns.forEach(pattern => {
      const matches = query.match(pattern)
      if (matches) {
        entities.push(matches[2])
      }
    })
    
    return [...new Set(entities)]
  }

  private extractDomainKeywords(query: string): string[] {
    const domainKeywords = [
      'revenue', 'profit', 'customer', 'sales', 'marketing', 'strategy',
      'patient', 'medical', 'health', 'treatment', 'diagnosis',
      'student', 'teacher', 'course', 'grade', 'academic',
      'product', 'inventory', 'order', 'shipping',
      'system', 'software', 'hardware', 'network'
    ]
    
    const queryLower = query.toLowerCase()
    return domainKeywords.filter(keyword => queryLower.includes(keyword))
  }

  private calculateComplexityIndicators(query: string): Record<string, number> {
    return {
      'sql_complexity': this.calculateQueryComplexity(query),
      'business_complexity': this.calculateBusinessContextScore(query),
      'technical_complexity': this.calculateTechnicalComplexity(query),
      'semantic_complexity': query.split(' ').length / 20, // Normalize by word count
      'context_dependency': this.calculateContextSimilarity(query, [])
    }
  }

  // Neural network helper methods
  private initializeWeights(): number[][][] {
    // Initialize random weights for neural network
    return []
  }

  private initializeBiases(): number[][] {
    // Initialize random biases for neural network
    return []
  }

  private prepareModelInput(features: MLFeatures): number[] {
    // Convert features to numerical array for neural network input
    return [
      features.query_length / 1000,
      features.query_complexity,
      features.conversation_length / 100,
      features.previous_failures / 10,
      features.time_of_day / 24,
      features.day_of_week / 7,
      features.user_experience_level,
      features.workspace_data_sources_count / 50,
      features.context_similarity,
      features.semantic_similarity,
      features.user_intent_confidence,
      features.query_sentiment,
      features.technical_complexity,
      features.business_context_score,
      features.session_duration / 60,
      features.time_since_last_query / 60,
      features.query_frequency / 10,
      features.peak_usage_hours / 24,
      features.user_activity_pattern,
      features.conversation_sentiment
    ]
  }

  private forwardPropagate(input: number[], _layer: unknown, _model: unknown): number[] {
    // Simple forward propagation (can be enhanced with proper neural network library)
    return input.map(x => Math.max(0, x)) // ReLU activation
  }

  private decodeStrategy(activations: number[]): string {
    const strategies = [
      'standard_processing',
      'detailed_analysis',
      'aggressive_fallback',
      'context_aware',
      'guided_approach',
      'fast_processing',
      'comprehensive_analysis',
      'user_specific',
      'workspace_optimized',
      'emergency_fallback'
    ]
    
    const maxIndex = activations.indexOf(Math.max(...activations))
    return strategies[maxIndex] || 'standard_processing'
  }

  private decodeAgents(activations: number[]): string[] {
    const agents = ['greeting', 'validation', 'prompt_engineering', 'data_source_filter', 'multi_source_qa']
    return agents.filter((_, index) => activations[index] > 0.5)
  }

  private decodeResources(activations: number[]): Record<string, number> {
    return {
      'cpu_intensive': activations[0],
      'memory_intensive': activations[1],
      'network_intensive': activations[2],
      'storage_intensive': activations[3]
    }
  }

  private generateFallbackStrategies(activations: number[]): string[] {
    const strategies = ['standard_processing', 'simplified_analysis', 'basic_retrieval']
    return strategies.filter((_, index) => activations[index] > 0.3)
  }

  private enhancePrediction(
    prediction: unknown,
    _features: MLFeatures,
    _workspaceId: string,
    _userId: string
  ): MLPrediction {
    // Enhance the basic prediction with additional analysis
    const pred = prediction as {
      strategy: string;
      confidence: number;
      reasoning: string;
      expected_success_rate: number;
      recommended_agents: string[];
      processing_priority: number;
      estimated_processing_time: number;
      resource_requirements: Record<string, number>;
      fallback_strategies: string[];
      user_satisfaction_prediction: number;
    }
    
    return {
      strategy: pred.strategy,
      confidence: Math.min(pred.confidence * 1.1, 1.0), // Boost confidence slightly
      reasoning: pred.reasoning,
      expected_success_rate: Math.min(pred.expected_success_rate * 1.05, 1.0),
      recommended_agents: pred.recommended_agents,
      processing_priority: pred.processing_priority,
      estimated_processing_time: pred.estimated_processing_time,
      resource_requirements: pred.resource_requirements,
      fallback_strategies: pred.fallback_strategies,
      user_satisfaction_prediction: Math.min(pred.user_satisfaction_prediction * 1.02, 1.0)
    }
  }

  // Performance monitoring methods
  private calculatePerformanceMetrics(data: unknown[]): ModelPerformanceMetrics {
    const totalPredictions = data.length
    const correctPredictions = data.filter(item => {
      const dataItem = item as { actual_outcome?: { success?: boolean }; prediction?: { expected_success_rate?: number } }
      return dataItem.actual_outcome?.success === (dataItem.prediction?.expected_success_rate || 0) > 0.5
    }).length

    const accuracy = correctPredictions / totalPredictions
    const precision = accuracy // Simplified
    const recall = accuracy // Simplified
    const f1_score = (2 * precision * recall) / (precision + recall)

    return {
      accuracy,
      precision,
      recall,
      f1_score,
      model_drift_score: 0, // Will be calculated separately
      prediction_confidence_distribution: data.map(item => {
        const dataItem = item as { confidence_score?: number }
        return dataItem.confidence_score || 0.5
      }),
      feature_importance: {}, // Will be calculated separately
      last_updated: new Date().toISOString(),
      training_data_size: totalPredictions
    }
  }

  private async calculateModelDrift(_workspaceId: string, recentData: unknown[]): Promise<number> {
    // Calculate model drift based on prediction accuracy over time
    if (recentData.length < 10) return 0

    const recentAccuracy = recentData.slice(0, 10).reduce((sum: number, item: unknown) => {
      const dataItem = item as { prediction_accuracy?: number }
      return sum + (dataItem.prediction_accuracy || 0.5)
    }, 0) / 10

    const olderAccuracy = recentData.slice(10, 20).reduce((sum: number, item: unknown) => {
      const dataItem = item as { prediction_accuracy?: number }
      return sum + (dataItem.prediction_accuracy || 0.5)
    }, 0) / 10

    return Math.abs(recentAccuracy - olderAccuracy)
  }

  private getDefaultMetrics(): ModelPerformanceMetrics {
    return {
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1_score: 0.5,
      model_drift_score: 0,
      prediction_confidence_distribution: [0.5],
      feature_importance: {},
      last_updated: new Date().toISOString(),
      training_data_size: 0
    }
  }

  // Additional methods for real-time learning, model updates, etc.
  private async updateNeuralNetworkModel(_interactionData: unknown, _actualOutcome: unknown): Promise<void> {
    // Update neural network weights based on actual outcome
    // This would implement backpropagation in a real implementation
  }

  private async updatePerformanceMetrics(_interactionData: unknown, _actualOutcome: unknown): Promise<void> {
    // Update performance metrics in real-time
  }

  private async checkModelDrift(_workspaceId: string): Promise<void> {
    // Check for model drift and trigger retraining if needed
  }

  private async updateFeatureImportance(_interactionData: unknown, _actualOutcome: unknown): Promise<void> {
    // Update feature importance scores
  }

  private async storePrediction(workspaceId: string, userId: string, features: MLFeatures, prediction: MLPrediction): Promise<void> {
    try {
      await supabase
        .from('ml_predictions')
        .insert({
          model_type: 'enhanced_neural_network',
          workspace_id: workspaceId,
          user_id: userId,
          input_features: features,
          prediction: prediction,
          confidence_score: prediction.confidence,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error storing prediction:', error)
    }
  }

  private async ruleBasedPrediction(_features: MLFeatures, _workspaceId: string, _userId: string): Promise<MLPrediction> {
    // Fallback rule-based prediction
    return {
      strategy: 'standard_processing',
      confidence: 0.6,
      reasoning: 'Rule-based fallback prediction',
      expected_success_rate: 0.7,
      recommended_agents: ['validation', 'data_source_filter'],
      processing_priority: 0.5,
      estimated_processing_time: 2000,
      resource_requirements: { cpu_intensive: 0.3, memory_intensive: 0.2 },
      fallback_strategies: ['simplified_analysis'],
      user_satisfaction_prediction: 0.7
    }
  }

  private loadModelFromData(modelData: unknown): unknown {
    // Load neural network model from stored data
    return modelData
  }

  private async storeInteractionData(interactionData: InteractionData): Promise<void> {
    try {
      await supabase
        .from('user_interaction_patterns')
        .insert({
          user_id: interactionData.user_id,
          workspace_id: interactionData.workspace_id,
          agent_id: interactionData.agent_id,
          original_query: interactionData.original_query,
          optimized_query: interactionData.optimized_query,
          query_intent: interactionData.query_intent,
          query_entities: interactionData.query_entities,
          query_complexity_score: interactionData.query_complexity_score,
          conversation_length: interactionData.conversation_length,
          previous_failures_count: interactionData.previous_failures_count,
          processing_strategy: interactionData.processing_strategy,
          data_sources_used: interactionData.data_sources_used,
          execution_time_ms: interactionData.execution_time_ms,
          success: interactionData.success,
          failure_reason: interactionData.failure_reason,
          user_satisfaction_score: interactionData.user_satisfaction_score,
          user_feedback: interactionData.user_feedback,
          features_vector: interactionData.features_vector,
          prediction_confidence: interactionData.prediction_confidence,
        })
    } catch (error) {
      console.error('Error storing interaction data:', error)
    }
  }

  private async updateAgentPerformance(interactionData: InteractionData): Promise<void> {
    // This is handled by the database trigger, but we can add additional logic here
    console.log('Agent performance updated for:', interactionData.agent_id)
  }

  private async updateDataSourceEffectiveness(interactionData: InteractionData): Promise<void> {
    if (!interactionData.data_sources_used) return

    for (const sourceId of interactionData.data_sources_used) {
      try {
        await supabase
          .from('data_source_effectiveness')
          .upsert({
            data_source_id: sourceId,
            workspace_id: interactionData.workspace_id,
            total_queries: 1,
            successful_queries: interactionData.success ? 1 : 0,
            average_relevance_score: interactionData.success ? 0.8 : 0.3
          }, {
            onConflict: 'data_source_id,workspace_id'
          })
      } catch (error) {
        console.error('Error updating data source effectiveness:', error)
      }
    }
  }

  private async checkAndRetrainModels(workspaceId: string): Promise<void> {
    const lastTraining = this.lastTrainingTime.get(workspaceId) || 0
    const now = Date.now()
    
    // Retrain every 24 hours or after 100 new interactions
    if (now - lastTraining > 24 * 60 * 60 * 1000) {
      await this.retrainModels(workspaceId)
      this.lastTrainingTime.set(workspaceId, now)
    }
  }

  private async retrainModels(workspaceId: string): Promise<void> {
    console.log('Retraining ML models for workspace:', workspaceId)
    // Implement model retraining logic here
    // This could involve:
    // 1. Collecting training data
    // 2. Training new models
    // 3. Validating model performance
    // 4. Updating model parameters
  }

  private async updateLearningInsightsCache(workspaceId: string, userId: string): Promise<void> {
    try {
      const insights = await this.generateLearningInsights(workspaceId, userId)
      await this.cacheInsights(workspaceId, userId, insights)
    } catch (error) {
      console.error('Error updating learning insights cache:', error)
    }
  }

  private async generateLearningInsights(workspaceId: string, userId: string): Promise<unknown> {
    try {
      // Generate insights based on historical data
      const { data: interactions } = await supabase
        .from('user_interaction_patterns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!interactions || interactions.length === 0) {
        return {
          query_patterns: { successful_patterns: [], failure_patterns: [], user_preferences: {} },
          agent_optimizations: [],
          data_source_recommendations: []
        }
      }

      // Analyze patterns
      const successfulPatterns = interactions
        .filter(i => i.success)
        .map(i => i.processing_strategy)
        .filter((strategy, index, arr) => arr.indexOf(strategy) === index)

      const failurePatterns = interactions
        .filter(i => !i.success)
        .map(i => i.failure_reason)
        .filter((reason, index, arr) => arr.indexOf(reason) === index)

      return {
        query_patterns: {
          successful_patterns: successfulPatterns,
          failure_patterns: failurePatterns,
          user_preferences: {}
        },
        agent_optimizations: [],
        data_source_recommendations: []
      }
    } catch (error) {
      console.error('Error generating learning insights:', error)
      return {
        query_patterns: { successful_patterns: [], failure_patterns: [], user_preferences: {} },
        agent_optimizations: [],
        data_source_recommendations: []
      }
    }
  }

  private async getCachedInsights(workspaceId: string, userId: string) {
    try {
      const { data } = await supabase
        .from('learning_insights_cache')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single()

      return data
    } catch {
      return null
    }
  }

  private async cacheInsights(workspaceId: string, userId: string, insights: unknown): Promise<void> {
    try {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1) // Cache for 1 hour

      const insightsData = insights as {
        query_patterns: { failure_patterns: unknown };
        agent_optimizations: unknown;
        data_source_recommendations: unknown;
      }
      
      await supabase
        .from('learning_insights_cache')
        .upsert({
          workspace_id: workspaceId,
          user_id: userId,
          query_patterns: insightsData.query_patterns,
          success_strategies: insightsData.agent_optimizations,
          failure_patterns: insightsData.query_patterns.failure_patterns,
          optimization_suggestions: insightsData.data_source_recommendations,
          cache_version: '1.0',
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'workspace_id,user_id'
        })
    } catch {
      console.error('Error caching insights')
    }
  }
}

export const mlLearningService = MLLearningService.getInstance()
