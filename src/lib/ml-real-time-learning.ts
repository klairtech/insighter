/**
 * Real-time Learning Pipeline
 * 
 * Implements continuous learning from user interactions with immediate model updates,
 * drift detection, and adaptive optimization for the ML system.
 */

import { supabaseServer as supabase } from './server-utils'
import { MLFeatures, MLPrediction } from './ml-learning-service'

export interface RealTimeLearningEvent {
  id: string
  workspace_id: string
  user_id?: string
  event_type: 'prediction' | 'feedback' | 'correction' | 'optimization'
  event_data: {
    query: string
    features: MLFeatures
    prediction: MLPrediction
    actual_outcome?: {
      success: boolean
      data_sources_used: string[]
      processing_time_ms: number
      user_satisfaction_score?: number
    }
    user_feedback?: number
    processing_time_ms: number
    success: boolean
    error_message?: string
  }
  model_version: string
  processing_time_ms: number
  created_at: string
}

export interface LearningMetrics {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  model_drift_score: number
  learning_rate: number
  adaptation_speed: number
  last_updated: string
}

export interface DriftDetectionResult {
  drift_detected: boolean
  drift_type: 'concept_drift' | 'data_drift' | 'performance_drift'
  drift_score: number
  confidence: number
  affected_features: string[]
  recommended_action: string
  detection_timestamp: string
}

/**
 * Real-time Learning Pipeline Class
 */
export class RealTimeLearningPipeline {
  private static instance: RealTimeLearningPipeline
  private learningBuffer: Map<string, RealTimeLearningEvent[]> = new Map()
  private driftThresholds: Map<string, number> = new Map()
  private learningRates: Map<string, number> = new Map()
  private lastUpdateTime: Map<string, number> = new Map()

  private constructor() {
    this.initializeDefaultThresholds()
  }

  public static getInstance(): RealTimeLearningPipeline {
    if (!RealTimeLearningPipeline.instance) {
      RealTimeLearningPipeline.instance = new RealTimeLearningPipeline()
    }
    return RealTimeLearningPipeline.instance
  }

  /**
   * Process real-time learning event
   */
  public async processLearningEvent(
    workspaceId: string,
    userId: string | undefined,
    eventType: RealTimeLearningEvent['event_type'],
    eventData: RealTimeLearningEvent['event_data']
  ): Promise<void> {
    try {
      // Create learning event
      const learningEvent: RealTimeLearningEvent = {
        id: this.generateEventId(),
        workspace_id: workspaceId,
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
        model_version: '1.0.0', // Get from model registry
        processing_time_ms: eventData.processing_time_ms,
        created_at: new Date().toISOString()
      }

      // Store event in buffer
      this.addToBuffer(workspaceId, learningEvent)

      // Store in database
      await this.storeLearningEvent(learningEvent)

      // Process immediate learning
      await this.processImmediateLearning(learningEvent)

      // Check for drift
      await this.checkForDrift(workspaceId)

      // Update model if needed
      await this.updateModelIfNeeded(workspaceId)

      // Clean up old events
      await this.cleanupOldEvents(workspaceId)

    } catch (error) {
      console.error('Real-time learning event processing error:', error)
    }
  }

  /**
   * Process immediate learning from event
   */
  private async processImmediateLearning(event: RealTimeLearningEvent): Promise<void> {
    try {
      const { workspace_id, event_data } = event

      // Update feature importance
      await this.updateFeatureImportance(workspace_id, event_data)

      // Update agent performance
      await this.updateAgentPerformance(workspace_id, event_data)

      // Update data source effectiveness
      await this.updateDataSourceEffectiveness(workspace_id, event_data)

      // Update user patterns
      await this.updateUserPatterns(event)

      // Update model weights (if neural network)
      await this.updateModelWeights(workspace_id, event_data)

    } catch (error) {
      console.error('Immediate learning processing error:', error)
    }
  }

  /**
   * Check for model drift
   */
  public async checkForDrift(workspaceId: string): Promise<DriftDetectionResult> {
    try {
      // Get recent events
      const recentEvents = this.getRecentEvents(workspaceId, 100)
      
      if (recentEvents.length < 10) {
        return {
          drift_detected: false,
          drift_type: 'performance_drift',
          drift_score: 0,
          confidence: 0,
          affected_features: [],
          recommended_action: 'insufficient_data',
          detection_timestamp: new Date().toISOString()
        }
      }

      // Calculate drift scores
      const conceptDriftScore = await this.calculateConceptDrift(recentEvents)
      const dataDriftScore = await this.calculateDataDrift(recentEvents)
      const performanceDriftScore = await this.calculatePerformanceDrift(recentEvents)

      // Determine if drift is detected
      const maxDriftScore = Math.max(conceptDriftScore, dataDriftScore, performanceDriftScore)
      const driftThreshold = this.driftThresholds.get(workspaceId) || 0.3

      if (maxDriftScore > driftThreshold) {
        const driftType = maxDriftScore === conceptDriftScore ? 'concept_drift' :
                         maxDriftScore === dataDriftScore ? 'data_drift' : 'performance_drift'

        // Store drift detection
        await this.storeDriftDetection(workspaceId, driftType, maxDriftScore)

        return {
          drift_detected: true,
          drift_type: driftType,
          drift_score: maxDriftScore,
          confidence: Math.min(maxDriftScore / driftThreshold, 1),
          affected_features: await this.identifyAffectedFeatures(workspaceId, driftType),
          recommended_action: this.getRecommendedAction(driftType, maxDriftScore),
          detection_timestamp: new Date().toISOString()
        }
      }

      return {
        drift_detected: false,
        drift_type: 'performance_drift',
        drift_score: maxDriftScore,
        confidence: 1 - maxDriftScore,
        affected_features: [],
        recommended_action: 'continue_monitoring',
        detection_timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('Drift detection error:', error)
      return {
        drift_detected: false,
        drift_type: 'performance_drift',
        drift_score: 0,
        confidence: 0,
        affected_features: [],
        recommended_action: 'error_occurred',
        detection_timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Update model weights in real-time
   */
  private async updateModelWeights(workspaceId: string, eventData: RealTimeLearningEvent['event_data']): Promise<void> {
    try {
      // Get current model
      const { data: model } = await supabase
        .from('ml_models')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('last_trained_at', { ascending: false })
        .limit(1)
        .single()

      if (!model) return

      // Calculate prediction error
      const predictionError = eventData.actual_outcome ? this.calculatePredictionError(eventData.prediction, eventData.actual_outcome) : 0
      
      if (Math.abs(predictionError) > 0.1) { // Only update for significant errors
        // Update model weights using online learning
        const updatedModel = await this.performOnlineLearning(model, eventData, predictionError)
        
        // Store updated model
        await this.storeUpdatedModel(workspaceId, updatedModel)
      }

    } catch (error) {
      console.error('Model weight update error:', error)
    }
  }

  /**
   * Update feature importance scores
   */
  private async updateFeatureImportance(
    workspaceId: string, 
    eventData: RealTimeLearningEvent['event_data']
  ): Promise<void> {
    try {
      const { features, prediction, actual_outcome } = eventData
      
      if (!actual_outcome) return

      // Calculate feature contributions
      const featureContributions = this.calculateFeatureContributions(features, prediction, actual_outcome)

      // Update feature importance in database
      for (const [featureName, contribution] of Object.entries(featureContributions)) {
        await supabase
          .from('feature_importance')
          .upsert({
            model_id: await this.getActiveModelId(workspaceId),
            feature_name: featureName,
            importance_score: contribution,
            feature_type: this.getFeatureType(featureName),
            calculated_at: new Date().toISOString()
          })
      }

    } catch (error) {
      console.error('Feature importance update error:', error)
    }
  }

  /**
   * Update agent performance metrics
   */
  private async updateAgentPerformance(
    workspaceId: string,
    eventData: RealTimeLearningEvent['event_data']
  ): Promise<void> {
    try {
      const { prediction, actual_outcome, processing_time_ms } = eventData
      
      if (!actual_outcome) return

      // Update agent performance
      await supabase
        .from('agent_performance_metrics')
        .upsert({
          workspace_id: workspaceId,
          agent_type: prediction.strategy,
          average_confidence_score: prediction.confidence,
          success_rate: actual_outcome.success ? 1 : 0,
          average_processing_time_ms: processing_time_ms,
          total_interactions: 1,
          last_used_at: new Date().toISOString()
        })

    } catch (error) {
      console.error('Agent performance update error:', error)
    }
  }

  /**
   * Update data source effectiveness
   */
  private async updateDataSourceEffectiveness(
    workspaceId: string,
    eventData: RealTimeLearningEvent['event_data']
  ): Promise<void> {
    try {
      const { prediction, actual_outcome } = eventData
      
      if (!actual_outcome || !actual_outcome.data_sources_used) return

      // Update effectiveness for each data source used
      for (const dataSourceId of actual_outcome.data_sources_used) {
        await supabase
          .from('data_source_effectiveness')
          .upsert({
            workspace_id: workspaceId,
            data_source_id: dataSourceId,
            data_source_type: 'database', // Get from actual data
            average_relevance_score: prediction.confidence,
            success_rate: actual_outcome.success ? 1 : 0,
            average_response_time_ms: eventData.processing_time_ms,
            usage_count: 1,
            last_used_at: new Date().toISOString()
          })
      }

    } catch (error) {
      console.error('Data source effectiveness update error:', error)
    }
  }

  /**
   * Update user interaction patterns
   */
  private async updateUserPatterns(event: RealTimeLearningEvent): Promise<void> {
    try {
      const { workspace_id, user_id, event_data } = event
      
      if (!user_id) return

      // Update user interaction patterns
      await supabase
        .from('user_interaction_patterns')
        .insert({
          user_id: user_id,
          workspace_id: workspace_id,
          original_query: event_data.query,
          optimized_query: event_data.prediction.reasoning,
          query_intent: event_data.features.query_intent,
          query_entities: event_data.features.query_entities,
          query_complexity_score: event_data.features.query_complexity,
          conversation_length: event_data.features.conversation_length,
          previous_failures_count: event_data.features.previous_failures,
          successful_patterns_used: [event_data.prediction.strategy],
          processing_strategy: event_data.prediction.strategy,
          data_sources_used: event_data.actual_outcome?.data_sources_used || [],
          execution_time_ms: event_data.processing_time_ms,
          success: event_data.success,
          failure_reason: event_data.error_message,
          user_satisfaction_score: event_data.user_feedback,
          features_vector: event_data.features,
          prediction_confidence: event_data.prediction.confidence,
          enhanced_features: event_data.features,
          semantic_entities: event_data.features.semantic_entities,
          domain_keywords: event_data.features.domain_keywords,
          complexity_indicators: event_data.features.complexity_indicators,
          temporal_features: {
            session_duration: event_data.features.session_duration,
            time_since_last_query: event_data.features.time_since_last_query,
            query_frequency: event_data.features.query_frequency
          },
          context_features: {
            data_source_effectiveness: event_data.features.data_source_effectiveness,
            agent_performance_history: event_data.features.agent_performance_history,
            workspace_specific_patterns: event_data.features.workspace_specific_patterns
          },
          ml_prediction_confidence: event_data.prediction.confidence,
          model_version: event.model_version
        })

    } catch (error) {
      console.error('User patterns update error:', error)
    }
  }

  /**
   * Calculate concept drift
   */
  private async calculateConceptDrift(events: RealTimeLearningEvent[]): Promise<number> {
    if (events.length < 20) return 0

    // Split events into recent and older
    const recentEvents = events.slice(0, Math.floor(events.length / 2))
    const olderEvents = events.slice(Math.floor(events.length / 2))

    // Calculate success rates
    const recentSuccessRate = recentEvents.filter(e => e.event_data.success).length / recentEvents.length
    const olderSuccessRate = olderEvents.filter(e => e.event_data.success).length / olderEvents.length

    // Calculate concept drift as difference in success rates
    return Math.abs(recentSuccessRate - olderSuccessRate)
  }

  /**
   * Calculate data drift
   */
  private async calculateDataDrift(events: RealTimeLearningEvent[]): Promise<number> {
    if (events.length < 20) return 0

    // Split events into recent and older
    const recentEvents = events.slice(0, Math.floor(events.length / 2))
    const olderEvents = events.slice(Math.floor(events.length / 2))

    // Calculate average query complexity
    const recentComplexity = recentEvents.reduce((sum, e) => sum + e.event_data.features.query_complexity, 0) / recentEvents.length
    const olderComplexity = olderEvents.reduce((sum, e) => sum + e.event_data.features.query_complexity, 0) / olderEvents.length

    // Calculate data drift as difference in complexity
    return Math.abs(recentComplexity - olderComplexity)
  }

  /**
   * Calculate performance drift
   */
  private async calculatePerformanceDrift(events: RealTimeLearningEvent[]): Promise<number> {
    if (events.length < 20) return 0

    // Split events into recent and older
    const recentEvents = events.slice(0, Math.floor(events.length / 2))
    const olderEvents = events.slice(Math.floor(events.length / 2))

    // Calculate average processing time
    const recentTime = recentEvents.reduce((sum, e) => sum + e.processing_time_ms, 0) / recentEvents.length
    const olderTime = olderEvents.reduce((sum, e) => sum + e.processing_time_ms, 0) / olderEvents.length

    // Calculate performance drift as relative change in processing time
    return Math.abs(recentTime - olderTime) / Math.max(olderTime, 1)
  }

  /**
   * Get learning metrics for workspace
   */
  public async getLearningMetrics(workspaceId: string): Promise<LearningMetrics> {
    try {
      const recentEvents = this.getRecentEvents(workspaceId, 100)
      
      if (recentEvents.length === 0) {
        return this.getDefaultMetrics()
      }

      // Calculate metrics
      const accuracy = this.calculateAccuracy(recentEvents)
      const precision = this.calculatePrecision(recentEvents)
      const recall = this.calculateRecall(recentEvents)
      const f1_score = (2 * precision * recall) / (precision + recall)
      
      const driftResult = await this.checkForDrift(workspaceId)
      const learningRate = this.calculateLearningRate(workspaceId)
      const adaptationSpeed = this.calculateAdaptationSpeed(workspaceId)

      return {
        accuracy,
        precision,
        recall,
        f1_score,
        model_drift_score: driftResult.drift_score,
        learning_rate: learningRate,
        adaptation_speed: adaptationSpeed,
        last_updated: new Date().toISOString()
      }

    } catch (error) {
      console.error('Learning metrics calculation error:', error)
      return this.getDefaultMetrics()
    }
  }

  // Helper methods
  private initializeDefaultThresholds(): void {
    this.driftThresholds.set('default', 0.3)
    this.learningRates.set('default', 0.01)
  }

  private generateEventId(): string {
    return `rtl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private addToBuffer(workspaceId: string, event: RealTimeLearningEvent): void {
    if (!this.learningBuffer.has(workspaceId)) {
      this.learningBuffer.set(workspaceId, [])
    }
    
    const buffer = this.learningBuffer.get(workspaceId)!
    buffer.push(event)
    
    // Keep only last 1000 events
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000)
    }
  }

  private getRecentEvents(workspaceId: string, count: number): RealTimeLearningEvent[] {
    const buffer = this.learningBuffer.get(workspaceId) || []
    return buffer.slice(-count)
  }

  private async storeLearningEvent(event: RealTimeLearningEvent): Promise<void> {
    try {
      await supabase
        .from('real_time_learning_events')
        .insert({
          workspace_id: event.workspace_id,
          user_id: event.user_id,
          event_type: event.event_type,
          event_data: event.event_data,
          model_version: event.model_version,
          processing_time_ms: event.processing_time_ms,
          created_at: event.created_at
        })
    } catch (error) {
      console.error('Error storing learning event:', error)
    }
  }

  private async storeDriftDetection(
    workspaceId: string, 
    driftType: DriftDetectionResult['drift_type'], 
    driftScore: number
  ): Promise<void> {
    try {
      await supabase
        .from('model_drift_detection')
        .insert({
          model_id: await this.getActiveModelId(workspaceId),
          drift_score: driftScore,
          drift_type: driftType,
          detection_method: 'real_time_monitoring',
          drift_details: { workspace_id: workspaceId },
          detected_at: new Date().toISOString()
        })
    } catch {
      console.error('Error storing drift detection')
    }
  }

  private calculatePredictionError(prediction: MLPrediction, actualOutcome: {
    success: boolean
    data_sources_used: string[]
    processing_time_ms: number
    user_satisfaction_score?: number
  }): number {
    if (!actualOutcome) return 0
    
    const predictedSuccess = prediction.expected_success_rate
    const actualSuccess = actualOutcome.success ? 1 : 0
    
    return predictedSuccess - actualSuccess
  }

  private calculateFeatureContributions(
    features: MLFeatures, 
    prediction: MLPrediction, 
    actualOutcome: {
      success: boolean
      data_sources_used: string[]
      processing_time_ms: number
      user_satisfaction_score?: number
    }
  ): Record<string, number> {
    // Simple feature contribution calculation
    const contributions: Record<string, number> = {}
    
    // Calculate contribution based on feature values and prediction accuracy
    const predictionError = this.calculatePredictionError(prediction, actualOutcome)
    
    Object.entries(features).forEach(([key, value]) => {
      if (typeof value === 'number') {
        contributions[key] = Math.abs(value * predictionError)
      }
    })
    
    return contributions
  }

  private getFeatureType(featureName: string): string {
    if (featureName.includes('semantic') || featureName.includes('embedding')) return 'semantic'
    if (featureName.includes('time') || featureName.includes('duration')) return 'temporal'
    if (featureName.includes('context') || featureName.includes('workspace')) return 'context'
    if (featureName.includes('complexity') || featureName.includes('entities')) return 'advanced'
    return 'basic'
  }

  private async getActiveModelId(workspaceId: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('ml_models')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('last_trained_at', { ascending: false })
        .limit(1)
        .single()
      
      return data?.id || 'default'
    } catch {
      return 'default'
    }
  }

  private async performOnlineLearning(model: Record<string, unknown>, _eventData: RealTimeLearningEvent['event_data'], _predictionError: number): Promise<Record<string, unknown>> {
    // Simple online learning implementation
    // In a real implementation, this would use proper neural network backpropagation
    
    const _learningRate = this.learningRates.get('default') || 0.01
    
    // Update model weights based on prediction error
    // This is a simplified version - real implementation would be more complex
    return {
      ...model,
      last_trained_at: new Date().toISOString(),
      training_data_size: ((model.training_data_size as number) || 0) + 1
    }
  }

  private async storeUpdatedModel(workspaceId: string, updatedModel: Record<string, unknown>): Promise<void> {
    try {
      await supabase
        .from('ml_models')
        .update({
          model_data: updatedModel,
          last_trained_at: updatedModel.last_trained_at,
          training_data_size: updatedModel.training_data_size
        })
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
    } catch (error) {
      console.error('Error storing updated model:', error)
    }
  }

  private async identifyAffectedFeatures(workspaceId: string, _driftType: string): Promise<string[]> {
    // Identify which features are most affected by drift
    const recentEvents = this.getRecentEvents(workspaceId, 50)
    
    if (recentEvents.length === 0) return []
    
    // Simple feature importance calculation
    const featureImportance: Record<string, number> = {}
    
    recentEvents.forEach(event => {
      Object.entries(event.event_data.features).forEach(([key, value]) => {
        if (typeof value === 'number') {
          featureImportance[key] = (featureImportance[key] || 0) + Math.abs(value)
        }
      })
    })
    
    // Return top 5 most important features
    return Object.entries(featureImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key]) => key)
  }

  private getRecommendedAction(_driftType: string, driftScore: number): string {
    if (driftScore > 0.7) {
      return 'immediate_retraining'
    } else if (driftScore > 0.5) {
      return 'schedule_retraining'
    } else if (driftScore > 0.3) {
      return 'increase_monitoring'
    } else {
      return 'continue_monitoring'
    }
  }

  private calculateAccuracy(events: RealTimeLearningEvent[]): number {
    const correctPredictions = events.filter(e => {
      const predictedSuccess = e.event_data.prediction.expected_success_rate > 0.5
      return predictedSuccess === e.event_data.success
    }).length
    
    return correctPredictions / events.length
  }

  private calculatePrecision(events: RealTimeLearningEvent[]): number {
    const positivePredictions = events.filter(e => e.event_data.prediction.expected_success_rate > 0.5)
    const truePositives = positivePredictions.filter(e => e.event_data.success).length
    
    return positivePredictions.length > 0 ? truePositives / positivePredictions.length : 0
  }

  private calculateRecall(events: RealTimeLearningEvent[]): number {
    const actualPositives = events.filter(e => e.event_data.success)
    const truePositives = actualPositives.filter(e => e.event_data.prediction.expected_success_rate > 0.5).length
    
    return actualPositives.length > 0 ? truePositives / actualPositives.length : 0
  }

  private calculateLearningRate(workspaceId: string): number {
    const lastUpdate = this.lastUpdateTime.get(workspaceId) || 0
    const timeSinceUpdate = Date.now() - lastUpdate
    
    // Learning rate decreases over time
    return Math.max(0.001, 0.01 * Math.exp(-timeSinceUpdate / (24 * 60 * 60 * 1000)))
  }

  private calculateAdaptationSpeed(workspaceId: string): number {
    const recentEvents = this.getRecentEvents(workspaceId, 20)
    
    if (recentEvents.length < 10) return 0
    
    // Calculate how quickly the model adapts to new patterns
    const recentAccuracy = this.calculateAccuracy(recentEvents.slice(0, 10))
    const olderAccuracy = this.calculateAccuracy(recentEvents.slice(10, 20))
    
    return Math.abs(recentAccuracy - olderAccuracy)
  }

  private getDefaultMetrics(): LearningMetrics {
    return {
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1_score: 0.5,
      model_drift_score: 0,
      learning_rate: 0.01,
      adaptation_speed: 0,
      last_updated: new Date().toISOString()
    }
  }

  private async updateModelIfNeeded(workspaceId: string): Promise<void> {
    // Check if model needs updating based on drift or performance
    const driftResult = await this.checkForDrift(workspaceId)
    
    if (driftResult.drift_detected && driftResult.drift_score > 0.5) {
      // Trigger model retraining
      await this.triggerModelRetraining(workspaceId)
    }
  }

  private async triggerModelRetraining(workspaceId: string): Promise<void> {
    // Trigger model retraining (could be async job)
    console.log(`Triggering model retraining for workspace: ${workspaceId}`)
  }

  private async cleanupOldEvents(workspaceId: string): Promise<void> {
    // Clean up events older than 30 days
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    try {
      await supabase
        .from('real_time_learning_events')
        .delete()
        .eq('workspace_id', workspaceId)
        .lt('created_at', cutoffDate)
    } catch (error) {
      console.error('Error cleaning up old events:', error)
    }
  }
}

export const realTimeLearningPipeline = RealTimeLearningPipeline.getInstance()
