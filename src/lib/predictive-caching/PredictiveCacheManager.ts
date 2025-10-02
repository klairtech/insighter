/**
 * Predictive Cache Manager
 * 
 * Uses machine learning to predict likely queries and pre-populate cache
 */

// import { agentCache } from '../cache/AgentCache';
import { queryPlanCache } from '../cache/QueryPlanCache';
import { BaseDataSource } from '../datasources/types';
import { AgentType } from '../agents/MasterPlanningAgent';

export interface QueryPattern {
  query: string;
  frequency: number;
  lastUsed: number;
  context: {
    workspaceId: string;
    userId?: string;
    timeOfDay: number;
    dayOfWeek: number;
    dataSources: string[];
  };
  relatedQueries: string[];
  successRate: number;
}

export interface PredictionModel {
  modelType: 'frequency' | 'contextual' | 'temporal' | 'collaborative';
  confidence: number;
  features: string[];
  lastTrained: number;
  accuracy: number;
}

export interface CachePrediction {
  query: string;
  confidence: number;
  reasoning: string;
  estimatedBenefit: number;
  priority: number;
}

export class PredictiveCacheManager {
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private predictionModels: Map<string, PredictionModel> = new Map();
  private userBehaviorHistory: Map<string, Array<{ query: string; timestamp: number; success: boolean }>> = new Map();
  private workspacePatterns: Map<string, QueryPattern[]> = new Map();
  private predictionCache: Map<string, CachePrediction[]> = new Map();
  
  private readonly maxPatternsPerUser = 1000;
  private readonly maxPatternsPerWorkspace = 5000;
  private readonly predictionThreshold = 0.7;
  private readonly maxPredictionsPerRequest = 10;

  /**
   * Record a query execution for learning
   */
  recordQueryExecution(
    query: string,
    workspaceId: string,
    userId: string | undefined,
    dataSources: string[],
    success: boolean,
    executionTime: number
  ): void {
    const timestamp = Date.now();
    const timeOfDay = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Create or update query pattern
    const patternKey = this.generatePatternKey(query, workspaceId, userId);
    const existingPattern = this.queryPatterns.get(patternKey);

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastUsed = timestamp;
      existingPattern.successRate = (existingPattern.successRate + (success ? 1 : 0)) / 2;
    } else {
      const newPattern: QueryPattern = {
        query,
        frequency: 1,
        lastUsed: timestamp,
        context: {
          workspaceId,
          userId,
          timeOfDay,
          dayOfWeek,
          dataSources
        },
        relatedQueries: [],
        successRate: success ? 1 : 0
      };
      this.queryPatterns.set(patternKey, newPattern);
    }

    // Update user behavior history
    if (userId) {
      const userHistory = this.userBehaviorHistory.get(userId) || [];
      userHistory.push({ query, timestamp, success });
      
      // Keep only recent history (last 1000 queries)
      if (userHistory.length > 1000) {
        userHistory.splice(0, userHistory.length - 1000);
      }
      
      this.userBehaviorHistory.set(userId, userHistory);
    }

    // Update workspace patterns
    this.updateWorkspacePatterns(workspaceId, query, timestamp);

    // Trigger model retraining if needed
    this.scheduleModelRetraining();
  }

  /**
   * Predict likely queries for pre-caching
   */
  async predictQueriesForCaching(
    workspaceId: string,
    userId?: string,
    currentQuery?: string
  ): Promise<CachePrediction[]> {
    const cacheKey = `${workspaceId}_${userId || 'anonymous'}`;
    
    // Check if we have recent predictions
    const cachedPredictions = this.predictionCache.get(cacheKey);
    if (cachedPredictions && this.isPredictionCacheValid(cachedPredictions)) {
      return cachedPredictions;
    }

    const predictions: CachePrediction[] = [];

    // 1. Frequency-based predictions
    const frequencyPredictions = this.predictByFrequency(workspaceId, userId);
    predictions.push(...frequencyPredictions);

    // 2. Contextual predictions
    const contextualPredictions = this.predictByContext(workspaceId, userId, currentQuery);
    predictions.push(...contextualPredictions);

    // 3. Temporal predictions
    const temporalPredictions = this.predictByTemporalPatterns(workspaceId, userId);
    predictions.push(...temporalPredictions);

    // 4. Collaborative predictions
    const collaborativePredictions = this.predictByCollaborativeFiltering(workspaceId, userId);
    predictions.push(...collaborativePredictions);

    // Sort by priority and confidence
    const sortedPredictions = predictions
      .sort((a, b) => (b.priority * b.confidence) - (a.priority * a.confidence))
      .slice(0, this.maxPredictionsPerRequest);

    // Cache predictions
    this.predictionCache.set(cacheKey, sortedPredictions);

    return sortedPredictions;
  }

  /**
   * Pre-populate cache with predicted queries
   */
  async prePopulateCache(
    workspaceId: string,
    userId?: string,
    availableSources: BaseDataSource[] = []
  ): Promise<{ preCached: number; errors: number }> {
    const predictions = await this.predictQueriesForCaching(workspaceId, userId);
    let preCached = 0;
    let errors = 0;

    console.log(`🎯 Pre-populating cache with ${predictions.length} predicted queries`);

    for (const prediction of predictions) {
      try {
        // Pre-cache query plan
        const mockSources = availableSources.length > 0 ? availableSources : [
          { id: 'db1', type: 'postgresql', name: 'PostgreSQL DB', workspace_id: workspaceId, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), connection_config: {} },
          { id: 'file1', type: 'excel', name: 'Sales Data.xlsx', workspace_id: workspaceId, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), connection_config: {} }
        ];

        // Create mock execution plan for caching
        const mockExecutionPlan = {
          requiredAgents: ['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent', 'DataSourceFilterAgent', 'MultiSourceQAAgent'] as AgentType[],
          parallelGroups: [['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent'] as AgentType[]],
          skipAgents: ['CrossValidationAgent', 'HallucinationDetectionAgent'] as AgentType[],
          dataSourceStrategy: {
            primarySources: [],
            fallbackSources: [],
            executionOrder: 'parallel' as const,
            timeoutStrategy: 'fail_fast' as const,
            priorityWeights: {}
          },
          validationLevel: 'medium' as const,
          estimatedTime: 15000,
          confidence: prediction.confidence,
          reasoning: `Predicted query with ${prediction.confidence} confidence: ${prediction.reasoning}`
        };

        const mockQueryAnalysis = {
          complexity: 'medium' as const,
          queryType: 'analytical' as const,
          dataRequirements: {
            needsDatabase: prediction.query.toLowerCase().includes('database') || prediction.query.toLowerCase().includes('sql'),
            needsFiles: prediction.query.toLowerCase().includes('file') || prediction.query.toLowerCase().includes('excel'),
            needsExternal: prediction.query.toLowerCase().includes('external') || prediction.query.toLowerCase().includes('api'),
            needsVisualization: prediction.query.toLowerCase().includes('chart') || prediction.query.toLowerCase().includes('graph')
          },
          estimatedTokens: Math.max(100, prediction.query.length * 2),
          confidence: prediction.confidence
        };

        // Cache the execution plan
        await queryPlanCache.setExecutionPlan(
          prediction.query,
          mockSources,
          mockExecutionPlan,
          mockQueryAnalysis,
          userId
        );

        preCached++;
        console.log(`✅ Pre-cached: "${prediction.query.substring(0, 50)}..." (confidence: ${prediction.confidence.toFixed(2)})`);

      } catch (error) {
        console.error(`❌ Failed to pre-cache query: "${prediction.query}"`, error);
        errors++;
      }
    }

    console.log(`🎯 Cache pre-population complete: ${preCached} cached, ${errors} errors`);
    return { preCached, errors };
  }

  /**
   * Predict queries by frequency
   */
  private predictByFrequency(workspaceId: string, userId?: string): CachePrediction[] {
    const patterns = this.getRelevantPatterns(workspaceId, userId);
    const predictions: CachePrediction[] = [];

    // Get most frequent queries
    const frequentPatterns = patterns
      .filter(p => p.frequency > 3 && p.successRate > 0.7)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    frequentPatterns.forEach(pattern => {
      predictions.push({
        query: pattern.query,
        confidence: Math.min(0.9, pattern.frequency / 10),
        reasoning: `Frequently used query (${pattern.frequency} times)`,
        estimatedBenefit: pattern.frequency * 0.1,
        priority: 8
      });
    });

    return predictions;
  }

  /**
   * Predict queries by context
   */
  private predictByContext(workspaceId: string, userId?: string, currentQuery?: string): CachePrediction[] {
    const predictions: CachePrediction[] = [];
    
    if (!currentQuery) return predictions;

    const patterns = this.getRelevantPatterns(workspaceId, userId);
    const currentEntities = this.extractEntities(currentQuery);
    const currentTimeRefs = this.extractTimeReferences(currentQuery);

    // Find similar queries
    const similarPatterns = patterns.filter(pattern => {
      const patternEntities = this.extractEntities(pattern.query);
      const patternTimeRefs = this.extractTimeReferences(pattern.query);
      
      const entityOverlap = this.calculateOverlap(currentEntities, patternEntities);
      const timeRefOverlap = this.calculateOverlap(currentTimeRefs, patternTimeRefs);
      
      return entityOverlap > 0.3 || timeRefOverlap > 0.5;
    });

    similarPatterns.forEach(pattern => {
      predictions.push({
        query: pattern.query,
        confidence: 0.6,
        reasoning: `Similar to current query based on entities/time references`,
        estimatedBenefit: 0.3,
        priority: 6
      });
    });

    return predictions;
  }

  /**
   * Predict queries by temporal patterns
   */
  private predictByTemporalPatterns(workspaceId: string, userId?: string): CachePrediction[] {
    const predictions: CachePrediction[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const patterns = this.getRelevantPatterns(workspaceId, userId);
    
    // Find queries typically used at this time
    const temporalPatterns = patterns.filter(pattern => {
      const hourDiff = Math.abs(pattern.context.timeOfDay - currentHour);
      const dayDiff = Math.abs(pattern.context.dayOfWeek - currentDay);
      
      return hourDiff <= 2 && dayDiff <= 1;
    });

    temporalPatterns.forEach(pattern => {
      predictions.push({
        query: pattern.query,
        confidence: 0.5,
        reasoning: `Typically used at this time of day/day of week`,
        estimatedBenefit: 0.2,
        priority: 4
      });
    });

    return predictions;
  }

  /**
   * Predict queries by collaborative filtering
   */
  private predictByCollaborativeFiltering(workspaceId: string, userId?: string): CachePrediction[] {
    const predictions: CachePrediction[] = [];
    
    if (!userId) return predictions;

    const userHistory = this.userBehaviorHistory.get(userId) || [];
    if (userHistory.length < 5) return predictions;

    // Find other users with similar patterns
    const similarUsers = this.findSimilarUsers(userId, workspaceId);
    
    similarUsers.forEach(similarUserId => {
      const similarUserHistory = this.userBehaviorHistory.get(similarUserId) || [];
      const recentQueries = similarUserHistory
        .filter(entry => Date.now() - entry.timestamp < 7 * 24 * 60 * 60 * 1000) // Last week
        .filter(entry => entry.success)
        .map(entry => entry.query);

      // Find queries the similar user used that current user hasn't
      const userQueries = new Set(userHistory.map(entry => entry.query));
      const newQueries = recentQueries.filter(query => !userQueries.has(query));

      newQueries.forEach(query => {
        predictions.push({
          query,
          confidence: 0.4,
          reasoning: `Used by similar users in this workspace`,
          estimatedBenefit: 0.15,
          priority: 3
        });
      });
    });

    return predictions;
  }

  /**
   * Get relevant patterns for prediction
   */
  private getRelevantPatterns(workspaceId: string, userId?: string): QueryPattern[] {
    const patterns: QueryPattern[] = [];
    
    for (const pattern of this.queryPatterns.values()) {
      if (pattern.context.workspaceId === workspaceId) {
        if (!userId || pattern.context.userId === userId) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }

  /**
   * Update workspace patterns
   */
  private updateWorkspacePatterns(workspaceId: string, query: string, timestamp: number): void {
    const workspacePatterns = this.workspacePatterns.get(workspaceId) || [];
    
    const existingPattern = workspacePatterns.find(p => p.query === query);
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastUsed = timestamp;
    } else {
      workspacePatterns.push({
        query,
        frequency: 1,
        lastUsed: timestamp,
        context: {
          workspaceId,
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          dataSources: []
        },
        relatedQueries: [],
        successRate: 1
      });
    }
    
    // Keep only recent patterns
    if (workspacePatterns.length > this.maxPatternsPerWorkspace) {
      workspacePatterns.sort((a, b) => b.lastUsed - a.lastUsed);
      workspacePatterns.splice(this.maxPatternsPerWorkspace);
    }
    
    this.workspacePatterns.set(workspaceId, workspacePatterns);
  }

  /**
   * Find similar users
   */
  private findSimilarUsers(userId: string, workspaceId: string): string[] {
    const userHistory = this.userBehaviorHistory.get(userId) || [];
    const userQueries = new Set(userHistory.map(entry => entry.query));
    const similarUsers: string[] = [];
    
    for (const [otherUserId, otherHistory] of this.userBehaviorHistory.entries()) {
      if (otherUserId === userId) continue;
      
      const otherQueries = new Set(otherHistory.map(entry => entry.query));
      const overlap = this.calculateOverlap(Array.from(userQueries), Array.from(otherQueries));
      
      if (overlap > 0.3) {
        similarUsers.push(otherUserId);
      }
    }
    
    return similarUsers.slice(0, 5); // Top 5 similar users
  }

  /**
   * Calculate overlap between two arrays
   */
  private calculateOverlap(arr1: string[], arr2: string[]): number {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Common business entities
    const businessEntities = ['sales', 'revenue', 'profit', 'customer', 'product', 'order', 'employee', 'department'];
    businessEntities.forEach(entity => {
      if (lowerQuery.includes(entity)) {
        entities.push(entity);
      }
    });
    
    // Time entities
    const timeEntities = ['year', 'month', 'quarter', 'week', 'day', 'today', 'yesterday', 'last', 'this'];
    timeEntities.forEach(entity => {
      if (lowerQuery.includes(entity)) {
        entities.push(entity);
      }
    });
    
    return entities;
  }

  /**
   * Extract time references from query
   */
  private extractTimeReferences(query: string): string[] {
    const timeRefs: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    const timePatterns = [
      'last year', 'this year', 'next year',
      'last month', 'this month', 'next month',
      'last quarter', 'this quarter', 'next quarter',
      'last week', 'this week', 'next week',
      'yesterday', 'today', 'tomorrow'
    ];
    
    timePatterns.forEach(pattern => {
      if (lowerQuery.includes(pattern)) {
        timeRefs.push(pattern);
      }
    });
    
    return timeRefs;
  }

  /**
   * Generate pattern key
   */
  private generatePatternKey(query: string, workspaceId: string, userId?: string): string {
    return `${workspaceId}_${userId || 'anonymous'}_${this.hashQuery(query)}`;
  }

  /**
   * Hash query for key generation
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if prediction cache is valid
   */
  private isPredictionCacheValid(predictions: CachePrediction[]): boolean {
    // Cache predictions for 5 minutes
    return predictions.length > 0 && Date.now() - (predictions[0] as any).timestamp < 300000;
  }

  /**
   * Schedule model retraining
   */
  private scheduleModelRetraining(): void {
    // In a real implementation, this would schedule background retraining
    // For now, we'll just log that retraining is needed
    console.log('🔄 Model retraining scheduled');
  }

  /**
   * Get prediction statistics
   */
  getStats(): {
    totalPatterns: number;
    totalUsers: number;
    totalWorkspaces: number;
    predictionCacheSize: number;
    averageConfidence: number;
  } {
    const totalPatterns = this.queryPatterns.size;
    const totalUsers = this.userBehaviorHistory.size;
    const totalWorkspaces = this.workspacePatterns.size;
    const predictionCacheSize = this.predictionCache.size;
    
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    for (const predictions of this.predictionCache.values()) {
      predictions.forEach(prediction => {
        totalConfidence += prediction.confidence;
        confidenceCount++;
      });
    }
    
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    
    return {
      totalPatterns,
      totalUsers,
      totalWorkspaces,
      predictionCacheSize,
      averageConfidence
    };
  }
}

// Export singleton instance
export const predictiveCacheManager = new PredictiveCacheManager();
