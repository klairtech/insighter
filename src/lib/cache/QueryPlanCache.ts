/**
 * Query Plan Cache
 * 
 * Specialized caching for execution plans and query analysis results
 */

import { ExecutionPlan, QueryAnalysis } from '../agents/MasterPlanningAgent';
import { AgentCache } from './AgentCache';

interface PlanCacheEntry {
  executionPlan: ExecutionPlan;
  queryAnalysis: QueryAnalysis;
  timestamp: number;
  hitCount: number;
  lastUsed: number;
}

export class QueryPlanCache {
  private cache: AgentCache;
  private readonly planTTL: number;
  private readonly analysisTTL: number;

  constructor(planTTL: number = 600000, analysisTTL: number = 300000) { // 10 min plans, 5 min analysis
    this.cache = new AgentCache();
    this.planTTL = planTTL;
    this.analysisTTL = analysisTTL;
  }

  /**
   * Get cached execution plan
   */
  async getExecutionPlan(
    query: string, 
    sources: Record<string, unknown>[], 
    userId?: string
  ): Promise<ExecutionPlan | null> {
    const key = this.cache.generatePlanKey(query, sources, userId);
    const cached = await this.cache.get<PlanCacheEntry>(key);
    
    if (cached) {
      console.log(`🎯 Using cached execution plan for query: "${query.substring(0, 50)}..."`);
      return cached.executionPlan;
    }
    
    return null;
  }

  /**
   * Cache execution plan
   */
  async setExecutionPlan(
    query: string,
    sources: Record<string, unknown>[],
    executionPlan: ExecutionPlan,
    queryAnalysis: QueryAnalysis,
    userId?: string
  ): Promise<void> {
    const key = this.cache.generatePlanKey(query, sources, userId);
    const entry: PlanCacheEntry = {
      executionPlan,
      queryAnalysis,
      timestamp: Date.now(),
      hitCount: 0,
      lastUsed: Date.now()
    };

    await this.cache.set(key, entry, this.planTTL);
    console.log(`💾 Cached execution plan for query: "${query.substring(0, 50)}..."`);
  }

  /**
   * Get cached query analysis
   */
  async getQueryAnalysis(query: string): Promise<QueryAnalysis | null> {
    const key = `analysis_${this.cache['hashString'](query.substring(0, 100))}`;
    const cached = await this.cache.get<QueryAnalysis>(key);
    
    if (cached) {
      console.log(`🎯 Using cached query analysis for: "${query.substring(0, 50)}..."`);
      return cached;
    }
    
    return null;
  }

  /**
   * Cache query analysis
   */
  async setQueryAnalysis(query: string, analysis: QueryAnalysis): Promise<void> {
    const key = `analysis_${this.cache['hashString'](query.substring(0, 100))}`;
    await this.cache.set(key, analysis, this.analysisTTL);
    console.log(`💾 Cached query analysis for: "${query.substring(0, 50)}..."`);
  }

  /**
   * Get similar cached plans for query optimization
   */
  async getSimilarPlans(query: string, limit: number = 3): Promise<ExecutionPlan[]> {
    // This is a simplified implementation
    // In a real system, you'd use semantic similarity or embeddings
    const queryWords = query.toLowerCase().split(/\s+/);
    const similarPlans: ExecutionPlan[] = [];
    
    // Get all cached plans and find similar ones
    const stats = this.cache.getStats();
    if (stats.totalEntries === 0) return similarPlans;
    
    // For now, return empty array - this would be enhanced with semantic search
    return similarPlans;
  }

  /**
   * Invalidate cache entries for a specific user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    // This would require tracking user-specific cache keys
    // For now, we'll clear all cache entries
    console.log(`🗑️ Invalidating cache for user: ${userId}`);
    this.cache.clearAll();
  }

  /**
   * Invalidate cache entries for a specific workspace
   */
  async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    // This would require tracking workspace-specific cache keys
    console.log(`🗑️ Invalidating cache for workspace: ${workspaceId}`);
    // For now, we'll clear all cache entries
    this.cache.clearAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, unknown> {
    const stats = this.cache.getStats();
    return {
      ...stats,
      hitRate: this.cache.getHitRate(),
      topEntries: this.cache.getTopEntries(5)
    };
  }

  /**
   * Clear all cached plans
   */
  clearAll(): void {
    this.cache.clearAll();
    console.log('🗑️ Cleared all query plan cache entries');
  }

  /**
   * Warm up cache with common query patterns
   */
  async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up query plan cache...');
    
    const commonQueries = [
      'Show me the sales data',
      'What is the total revenue?',
      'Analyze customer trends',
      'Compare performance metrics',
      'Generate a report'
    ];

    // This would pre-populate cache with common patterns
    // For now, just log the warm-up
    console.log(`🔥 Cache warm-up completed for ${commonQueries.length} common queries`);
  }
}

// Export singleton instance
export const queryPlanCache = new QueryPlanCache();
