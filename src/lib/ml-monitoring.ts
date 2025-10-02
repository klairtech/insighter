/**
 * Model Monitoring System
 * 
 * Comprehensive monitoring system for ML models including performance tracking,
 * drift detection, alerting, and automated model management.
 */

import { supabaseServer as supabase } from './server-utils'

export interface ModelPerformanceAlert {
  id: string
  model_id: string
  alert_type: 'performance_degradation' | 'drift_detected' | 'accuracy_drop' | 'latency_increase' | 'error_rate_spike'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metrics: {
    current_value: number
    threshold_value: number
    historical_average: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }
  triggered_at: string
  resolved_at?: string
  status: 'active' | 'resolved' | 'acknowledged'
}

export interface ModelHealthStatus {
  model_id: string
  overall_health: 'healthy' | 'warning' | 'critical' | 'unknown'
  performance_score: number
  drift_score: number
  latency_score: number
  accuracy_score: number
  last_updated: string
  issues: string[]
  recommendations: string[]
}

export interface MonitoringConfig {
  model_id: string
  performance_thresholds: {
    accuracy_min: number
    latency_max_ms: number
    error_rate_max: number
    drift_threshold: number
  }
  alert_settings: {
    enabled: boolean
    email_notifications: boolean
    slack_notifications: boolean
    webhook_url?: string
  }
  monitoring_frequency: 'realtime' | 'hourly' | 'daily'
  retention_days: number
}

export interface ModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  latency_p50: number
  latency_p95: number
  latency_p99: number
  error_rate: number
  throughput: number
  drift_score: number
  feature_importance: Record<string, number>
  prediction_confidence_distribution: number[]
  timestamp: string
}

/**
 * Model Monitoring System Class
 */
export class ModelMonitoringSystem {
  private static instance: ModelMonitoringSystem
  private monitoringConfigs: Map<string, MonitoringConfig> = new Map()
  private activeAlerts: Map<string, ModelPerformanceAlert[]> = new Map()
  private healthStatusCache: Map<string, ModelHealthStatus> = new Map()
  private metricsHistory: Map<string, ModelMetrics[]> = new Map()

  private constructor() {
    this.initializeDefaultConfigs()
    this.startMonitoringLoop()
  }

  public static getInstance(): ModelMonitoringSystem {
    if (!ModelMonitoringSystem.instance) {
      ModelMonitoringSystem.instance = new ModelMonitoringSystem()
    }
    return ModelMonitoringSystem.instance
  }

  /**
   * Start monitoring a model
   */
  public async startMonitoring(
    modelId: string,
    config: MonitoringConfig
  ): Promise<void> {
    try {
      // Store monitoring configuration
      this.monitoringConfigs.set(modelId, config)
      
      // Store in database
      await supabase
        .from('model_monitoring_configs')
        .upsert({
          model_id: modelId,
          config: config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      // Initialize health status
      await this.initializeModelHealth(modelId)

      console.log(`Started monitoring model: ${modelId}`)

    } catch (error) {
      console.error('Error starting model monitoring:', error)
    }
  }

  /**
   * Stop monitoring a model
   */
  public async stopMonitoring(modelId: string): Promise<void> {
    try {
      this.monitoringConfigs.delete(modelId)
      this.activeAlerts.delete(modelId)
      this.healthStatusCache.delete(modelId)
      this.metricsHistory.delete(modelId)

      await supabase
        .from('model_monitoring_configs')
        .delete()
        .eq('model_id', modelId)

      console.log(`Stopped monitoring model: ${modelId}`)

    } catch (error) {
      console.error('Error stopping model monitoring:', error)
    }
  }

  /**
   * Record model metrics
   */
  public async recordMetrics(
    modelId: string,
    metrics: ModelMetrics
  ): Promise<void> {
    try {
      // Store metrics in cache
      if (!this.metricsHistory.has(modelId)) {
        this.metricsHistory.set(modelId, [])
      }
      
      const history = this.metricsHistory.get(modelId)!
      history.push(metrics)
      
      // Keep only last 1000 metrics
      if (history.length > 1000) {
        history.splice(0, history.length - 1000)
      }

      // Store in database
      await supabase
        .from('model_metrics_history')
        .insert({
          model_id: modelId,
          metrics: metrics,
          recorded_at: metrics.timestamp
        })

      // Check for alerts
      await this.checkForAlerts(modelId, metrics)

      // Update health status
      await this.updateModelHealth(modelId)

    } catch (error) {
      console.error('Error recording model metrics:', error)
    }
  }

  /**
   * Get model health status
   */
  public async getModelHealth(modelId: string): Promise<ModelHealthStatus> {
    try {
      // Check cache first
      if (this.healthStatusCache.has(modelId)) {
        const cached = this.healthStatusCache.get(modelId)!
        const cacheAge = Date.now() - new Date(cached.last_updated).getTime()
        
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes cache
          return cached
        }
      }

      // Calculate fresh health status
      const healthStatus = await this.calculateModelHealth(modelId)
      
      // Update cache
      this.healthStatusCache.set(modelId, healthStatus)
      
      return healthStatus

    } catch (error) {
      console.error('Error getting model health:', error)
      return this.getDefaultHealthStatus(modelId)
    }
  }

  /**
   * Get active alerts for model
   */
  public async getActiveAlerts(modelId: string): Promise<ModelPerformanceAlert[]> {
    try {
      const { data: alerts } = await supabase
        .from('model_performance_alerts')
        .select('*')
        .eq('model_id', modelId)
        .eq('status', 'active')
        .order('triggered_at', { ascending: false })

      return alerts || []

    } catch (error) {
      console.error('Error getting active alerts:', error)
      return []
    }
  }

  /**
   * Acknowledge alert
   */
  public async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await supabase
        .from('model_performance_alerts')
        .update({
          status: 'acknowledged',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId)

    } catch (error) {
      console.error('Error acknowledging alert:', error)
    }
  }

  /**
   * Resolve alert
   */
  public async resolveAlert(alertId: string): Promise<void> {
    try {
      await supabase
        .from('model_performance_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId)

    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  /**
   * Get model performance trends
   */
  public async getPerformanceTrends(
    modelId: string,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    accuracy_trend: number[]
    latency_trend: number[]
    error_rate_trend: number[]
    drift_trend: number[]
    timestamps: string[]
  }> {
    try {
      const timeRangeMs = this.getTimeRangeMs(timeRange)
      const cutoffTime = new Date(Date.now() - timeRangeMs).toISOString()

      const { data: metrics } = await supabase
        .from('model_metrics_history')
        .select('metrics, recorded_at')
        .eq('model_id', modelId)
        .gte('recorded_at', cutoffTime)
        .order('recorded_at', { ascending: true })

      if (!metrics || metrics.length === 0) {
        return {
          accuracy_trend: [],
          latency_trend: [],
          error_rate_trend: [],
          drift_trend: [],
          timestamps: []
        }
      }

      return {
        accuracy_trend: metrics.map(m => m.metrics.accuracy),
        latency_trend: metrics.map(m => m.metrics.latency_p95),
        error_rate_trend: metrics.map(m => m.metrics.error_rate),
        drift_trend: metrics.map(m => m.metrics.drift_score),
        timestamps: metrics.map(m => m.recorded_at)
      }

    } catch (error) {
      console.error('Error getting performance trends:', error)
      return {
        accuracy_trend: [],
        latency_trend: [],
        error_rate_trend: [],
        drift_trend: [],
        timestamps: []
      }
    }
  }

  /**
   * Get model comparison report
   */
  public async getModelComparisonReport(modelIds: string[]): Promise<{
    models: Array<{
      model_id: string
      performance_score: number
      health_status: string
      key_metrics: ModelMetrics
      issues: string[]
    }>
    recommendations: string[]
  }> {
    try {
      const models = []
      
      for (const modelId of modelIds) {
        const health = await this.getModelHealth(modelId)
        const latestMetrics = await this.getLatestMetrics(modelId)
        const alerts = await this.getActiveAlerts(modelId)
        
        models.push({
          model_id: modelId,
          performance_score: health.performance_score,
          health_status: health.overall_health,
          key_metrics: latestMetrics,
          issues: alerts.map(a => a.message)
        })
      }

      // Generate recommendations
      const recommendations = this.generateComparisonRecommendations(models)

      return { models, recommendations }

    } catch (error) {
      console.error('Error generating model comparison report:', error)
      return { models: [], recommendations: [] }
    }
  }

  // Private methods
  private async checkForAlerts(modelId: string, metrics: ModelMetrics): Promise<void> {
    try {
      const config = this.monitoringConfigs.get(modelId)
      if (!config) return

      const alerts: ModelPerformanceAlert[] = []

      // Check accuracy threshold
      if (metrics.accuracy < config.performance_thresholds.accuracy_min) {
        alerts.push({
          id: this.generateAlertId(),
          model_id: modelId,
          alert_type: 'accuracy_drop',
          severity: this.getSeverity(metrics.accuracy, config.performance_thresholds.accuracy_min),
          message: `Model accuracy dropped to ${(metrics.accuracy * 100).toFixed(2)}%, below threshold of ${(config.performance_thresholds.accuracy_min * 100).toFixed(2)}%`,
          metrics: {
            current_value: metrics.accuracy,
            threshold_value: config.performance_thresholds.accuracy_min,
            historical_average: await this.getHistoricalAverage(modelId, 'accuracy'),
            trend: await this.getTrend(modelId, 'accuracy')
          },
          triggered_at: new Date().toISOString(),
          status: 'active'
        })
      }

      // Check latency threshold
      if (metrics.latency_p95 > config.performance_thresholds.latency_max_ms) {
        alerts.push({
          id: this.generateAlertId(),
          model_id: modelId,
          alert_type: 'latency_increase',
          severity: this.getSeverity(config.performance_thresholds.latency_max_ms, metrics.latency_p95),
          message: `Model latency increased to ${metrics.latency_p95}ms, above threshold of ${config.performance_thresholds.latency_max_ms}ms`,
          metrics: {
            current_value: metrics.latency_p95,
            threshold_value: config.performance_thresholds.latency_max_ms,
            historical_average: await this.getHistoricalAverage(modelId, 'latency_p95'),
            trend: await this.getTrend(modelId, 'latency_p95')
          },
          triggered_at: new Date().toISOString(),
          status: 'active'
        })
      }

      // Check error rate threshold
      if (metrics.error_rate > config.performance_thresholds.error_rate_max) {
        alerts.push({
          id: this.generateAlertId(),
          model_id: modelId,
          alert_type: 'error_rate_spike',
          severity: this.getSeverity(config.performance_thresholds.error_rate_max, metrics.error_rate),
          message: `Model error rate increased to ${(metrics.error_rate * 100).toFixed(2)}%, above threshold of ${(config.performance_thresholds.error_rate_max * 100).toFixed(2)}%`,
          metrics: {
            current_value: metrics.error_rate,
            threshold_value: config.performance_thresholds.error_rate_max,
            historical_average: await this.getHistoricalAverage(modelId, 'error_rate'),
            trend: await this.getTrend(modelId, 'error_rate')
          },
          triggered_at: new Date().toISOString(),
          status: 'active'
        })
      }

      // Check drift threshold
      if (metrics.drift_score > config.performance_thresholds.drift_threshold) {
        alerts.push({
          id: this.generateAlertId(),
          model_id: modelId,
          alert_type: 'drift_detected',
          severity: this.getSeverity(config.performance_thresholds.drift_threshold, metrics.drift_score),
          message: `Model drift detected with score ${metrics.drift_score.toFixed(3)}, above threshold of ${config.performance_thresholds.drift_threshold}`,
          metrics: {
            current_value: metrics.drift_score,
            threshold_value: config.performance_thresholds.drift_threshold,
            historical_average: await this.getHistoricalAverage(modelId, 'drift_score'),
            trend: await this.getTrend(modelId, 'drift_score')
          },
          triggered_at: new Date().toISOString(),
          status: 'active'
        })
      }

      // Store alerts
      for (const alert of alerts) {
        await this.storeAlert(alert)
        await this.sendAlertNotification(alert, config)
      }

    } catch (error) {
      console.error('Error checking for alerts:', error)
    }
  }

  private async updateModelHealth(modelId: string): Promise<void> {
    try {
      const healthStatus = await this.calculateModelHealth(modelId)
      this.healthStatusCache.set(modelId, healthStatus)

      // Store in database
      await supabase
        .from('model_health_status')
        .upsert({
          model_id: modelId,
          health_data: healthStatus,
          last_updated: healthStatus.last_updated
        })

    } catch (error) {
      console.error('Error updating model health:', error)
    }
  }

  private async calculateModelHealth(modelId: string): Promise<ModelHealthStatus> {
    try {
      const latestMetrics = await this.getLatestMetrics(modelId)
      const alerts = await this.getActiveAlerts(modelId)
      
      // Calculate health scores
      const performanceScore = this.calculatePerformanceScore(latestMetrics)
      const driftScore = latestMetrics.drift_score
      const latencyScore = this.calculateLatencyScore(latestMetrics.latency_p95)
      const accuracyScore = latestMetrics.accuracy

      // Determine overall health
      const overallHealth = this.determineOverallHealth(performanceScore, driftScore, latencyScore, accuracyScore, alerts)

      // Generate issues and recommendations
      const issues = this.generateIssues(latestMetrics, alerts)
      const recommendations = this.generateRecommendations(latestMetrics, alerts)

      return {
        model_id: modelId,
        overall_health: overallHealth,
        performance_score: performanceScore,
        drift_score: driftScore,
        latency_score: latencyScore,
        accuracy_score: accuracyScore,
        last_updated: new Date().toISOString(),
        issues,
        recommendations
      }

    } catch (error) {
      console.error('Error calculating model health:', error)
      return this.getDefaultHealthStatus(modelId)
    }
  }

  private calculatePerformanceScore(metrics: ModelMetrics): number {
    // Weighted combination of key metrics
    const accuracyWeight = 0.4
    const f1Weight = 0.3
    const errorRateWeight = 0.2
    const driftWeight = 0.1

    const accuracyScore = metrics.accuracy
    const f1Score = metrics.f1_score
    const errorRateScore = 1 - metrics.error_rate
    const driftScore = 1 - metrics.drift_score

    return (
      accuracyScore * accuracyWeight +
      f1Score * f1Weight +
      errorRateScore * errorRateWeight +
      driftScore * driftWeight
    )
  }

  private calculateLatencyScore(latencyP95: number): number {
    // Convert latency to score (lower is better)
    if (latencyP95 < 1000) return 1.0
    if (latencyP95 < 2000) return 0.8
    if (latencyP95 < 5000) return 0.6
    if (latencyP95 < 10000) return 0.4
    return 0.2
  }

  private determineOverallHealth(
    performanceScore: number,
    driftScore: number,
    latencyScore: number,
    accuracyScore: number,
    alerts: ModelPerformanceAlert[]
  ): ModelHealthStatus['overall_health'] {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length
    const highAlerts = alerts.filter(a => a.severity === 'high').length

    if (criticalAlerts > 0 || performanceScore < 0.3) return 'critical'
    if (highAlerts > 0 || performanceScore < 0.6 || driftScore > 0.7) return 'warning'
    if (performanceScore > 0.8 && driftScore < 0.3 && latencyScore > 0.7) return 'healthy'
    return 'unknown'
  }

  private generateIssues(metrics: ModelMetrics, alerts: ModelPerformanceAlert[]): string[] {
    const issues: string[] = []

    if (metrics.accuracy < 0.7) {
      issues.push(`Low accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`)
    }

    if (metrics.drift_score > 0.5) {
      issues.push(`High drift score: ${metrics.drift_score.toFixed(3)}`)
    }

    if (metrics.latency_p95 > 5000) {
      issues.push(`High latency: ${metrics.latency_p95}ms`)
    }

    if (metrics.error_rate > 0.1) {
      issues.push(`High error rate: ${(metrics.error_rate * 100).toFixed(2)}%`)
    }

    alerts.forEach(alert => {
      issues.push(alert.message)
    })

    return issues
  }

  private generateRecommendations(metrics: ModelMetrics, alerts: ModelPerformanceAlert[]): string[] {
    const recommendations: string[] = []

    if (metrics.accuracy < 0.7) {
      recommendations.push('Consider retraining the model with more recent data')
    }

    if (metrics.drift_score > 0.5) {
      recommendations.push('Model drift detected - schedule retraining or data validation')
    }

    if (metrics.latency_p95 > 5000) {
      recommendations.push('Optimize model for better performance or consider model compression')
    }

    if (metrics.error_rate > 0.1) {
      recommendations.push('Investigate error patterns and improve error handling')
    }

    if (alerts.length > 0) {
      recommendations.push('Review and address active alerts')
    }

    return recommendations
  }

  private generateComparisonRecommendations(models: Array<{
    model_id: string
    performance_score: number
    health_status: string
    key_metrics: ModelMetrics
    issues: string[]
  }>): string[] {
    const recommendations: string[] = []

    const bestModel = models.reduce((best, current) => 
      current.performance_score > best.performance_score ? current : best
    )

    const worstModel = models.reduce((worst, current) => 
      current.performance_score < worst.performance_score ? current : worst
    )

    if (bestModel.performance_score - worstModel.performance_score > 0.2) {
      recommendations.push(`Consider using ${bestModel.model_id} as primary model`)
    }

    models.forEach(model => {
      if (model.health_status === 'critical') {
        recommendations.push(`Model ${model.model_id} requires immediate attention`)
      }
    })

    return recommendations
  }

  private async getLatestMetrics(modelId: string): Promise<ModelMetrics> {
    try {
      const { data } = await supabase
        .from('model_metrics_history')
        .select('metrics')
        .eq('model_id', modelId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      return data?.metrics || this.getDefaultMetrics()

    } catch {
      return this.getDefaultMetrics()
    }
  }

  private async getHistoricalAverage(modelId: string, metric: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('model_metrics_history')
        .select('metrics')
        .eq('model_id', modelId)
        .gte('recorded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false })
        .limit(100)

      if (!data || data.length === 0) return 0

      const values = data.map(d => d.metrics[metric]).filter(v => v !== undefined)
      return values.reduce((sum, val) => sum + val, 0) / values.length

    } catch {
      return 0
    }
  }

  private async getTrend(modelId: string, metric: string): Promise<'increasing' | 'decreasing' | 'stable'> {
    try {
      const { data } = await supabase
        .from('model_metrics_history')
        .select('metrics')
        .eq('model_id', modelId)
        .order('recorded_at', { ascending: false })
        .limit(10)

      if (!data || data.length < 2) return 'stable'

      const recent = data.slice(0, 5).map(d => d.metrics[metric])
      const older = data.slice(5, 10).map(d => d.metrics[metric])

      const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
      const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length

      const change = (recentAvg - olderAvg) / olderAvg

      if (change > 0.1) return 'increasing'
      if (change < -0.1) return 'decreasing'
      return 'stable'

    } catch {
      return 'stable'
    }
  }

  private getSeverity(threshold: number, current: number): ModelPerformanceAlert['severity'] {
    const ratio = current / threshold
    
    if (ratio > 2) return 'critical'
    if (ratio > 1.5) return 'high'
    if (ratio > 1.2) return 'medium'
    return 'low'
  }

  private async storeAlert(alert: ModelPerformanceAlert): Promise<void> {
    try {
      await supabase
        .from('model_performance_alerts')
        .insert(alert)
    } catch (error) {
      console.error('Error storing alert:', error)
    }
  }

  private async sendAlertNotification(
    alert: ModelPerformanceAlert,
    config: MonitoringConfig
  ): Promise<void> {
    try {
      if (!config.alert_settings.enabled) return

      // Send email notification
      if (config.alert_settings.email_notifications) {
        await this.sendEmailAlert(alert)
      }

      // Send Slack notification
      if (config.alert_settings.slack_notifications) {
        await this.sendSlackAlert(alert)
      }

      // Send webhook notification
      if (config.alert_settings.webhook_url) {
        await this.sendWebhookAlert(alert, config.alert_settings.webhook_url)
      }

    } catch (error) {
      console.error('Error sending alert notification:', error)
    }
  }

  private async sendEmailAlert(alert: ModelPerformanceAlert): Promise<void> {
    // Implement email notification
    console.log(`Email alert sent for model ${alert.model_id}: ${alert.message}`)
  }

  private async sendSlackAlert(alert: ModelPerformanceAlert): Promise<void> {
    // Implement Slack notification
    console.log(`Slack alert sent for model ${alert.model_id}: ${alert.message}`)
  }

  private async sendWebhookAlert(alert: ModelPerformanceAlert, webhookUrl: string): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      })
    } catch (error) {
      console.error('Error sending webhook alert:', error)
    }
  }

  private async initializeModelHealth(modelId: string): Promise<void> {
    const defaultHealth = this.getDefaultHealthStatus(modelId)
    this.healthStatusCache.set(modelId, defaultHealth)
  }

  private getDefaultHealthStatus(modelId: string): ModelHealthStatus {
    return {
      model_id: modelId,
      overall_health: 'unknown',
      performance_score: 0.5,
      drift_score: 0,
      latency_score: 0.5,
      accuracy_score: 0.5,
      last_updated: new Date().toISOString(),
      issues: [],
      recommendations: []
    }
  }

  private getDefaultMetrics(): ModelMetrics {
    return {
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1_score: 0.5,
      latency_p50: 1000,
      latency_p95: 2000,
      latency_p99: 5000,
      error_rate: 0.1,
      throughput: 100,
      drift_score: 0,
      feature_importance: {},
      prediction_confidence_distribution: [0.5],
      timestamp: new Date().toISOString()
    }
  }

  private getTimeRangeMs(timeRange: string): number {
    switch (timeRange) {
      case '1h': return 60 * 60 * 1000
      case '24h': return 24 * 60 * 60 * 1000
      case '7d': return 7 * 24 * 60 * 60 * 1000
      case '30d': return 30 * 24 * 60 * 60 * 1000
      default: return 24 * 60 * 60 * 1000
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeDefaultConfigs(): void {
    // Initialize with default monitoring configurations
  }

  private startMonitoringLoop(): void {
    // Start background monitoring loop
    setInterval(async () => {
      await this.performPeriodicMonitoring()
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  private async performPeriodicMonitoring(): Promise<void> {
    try {
      for (const [modelId, config] of this.monitoringConfigs) {
        if (config.monitoring_frequency === 'realtime') {
          await this.checkModelHealth(modelId)
        }
      }
    } catch (error) {
      console.error('Error in periodic monitoring:', error)
    }
  }

  private async checkModelHealth(modelId: string): Promise<void> {
    try {
      const health = await this.getModelHealth(modelId)
      
      if (health.overall_health === 'critical') {
        // Trigger immediate alert
        console.log(`Critical health detected for model ${modelId}`)
      }
    } catch (error) {
      console.error(`Error checking health for model ${modelId}:`, error)
    }
  }
}

export const modelMonitoringSystem = ModelMonitoringSystem.getInstance()
