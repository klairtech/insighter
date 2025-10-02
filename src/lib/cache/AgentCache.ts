/**
 * Agent Cache Manager
 * 
 * Provides intelligent caching for agent results and query plans
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalEntries: number;
  memoryUsage: number;
}

export class AgentCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalEntries: 0,
    memoryUsage: 0
  };

  constructor(defaultTTL: number = 300000, maxSize: number = 1000) { // 5 minutes default, 1000 entries max
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    
    // Cleanup expired entries every 2 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 120000);
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.totalEntries--;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.stats.totalEntries++;
  }

  /**
   * Generate cache key for agent results
   */
  generateAgentKey(agentType: string, query: string, context?: any): string {
    const contextHash = context ? this.hashObject(context) : '';
    const queryHash = this.hashString(query.substring(0, 100));
    return `agent_${agentType}_${queryHash}_${contextHash}`;
  }

  /**
   * Generate cache key for query plans
   */
  generatePlanKey(query: string, sources: any[], userId?: string): string {
    const queryHash = this.hashString(query.substring(0, 100));
    const sourcesHash = this.hashObject(sources.map(s => ({ id: s.id, type: s.type })));
    const userHash = userId ? this.hashString(userId) : 'anonymous';
    return `plan_${queryHash}_${sourcesHash}_${userHash}`;
  }

  /**
   * Generate cache key for data source filtering
   */
  generateSourceKey(query: string, workspaceId: string, selectedSources?: string[]): string {
    const queryHash = this.hashString(query.substring(0, 100));
    const sourcesHash = selectedSources ? this.hashString(selectedSources.sort().join(',')) : 'all';
    return `sources_${workspaceId}_${queryHash}_${sourcesHash}`;
  }

  /**
   * Check if cache is valid (not expired)
   */
  isValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    return Date.now() - entry.timestamp <= entry.ttl;
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    if (this.cache.delete(key)) {
      this.stats.totalEntries--;
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
    this.stats.totalEntries = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get most frequently accessed entries
   */
  getTopEntries(limit: number = 10): Array<{ key: string; accessCount: number; lastAccessed: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return entries;
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.totalEntries -= cleanedCount;
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cache cleanup: Removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove 10% of entries (or at least 1)
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    this.stats.totalEntries -= toRemove;
    console.log(`🗑️ Cache eviction: Removed ${toRemove} least recently used entries`);
  }

  /**
   * Hash object to string
   */
  private hashObject(obj: any): string {
    try {
      return this.hashString(JSON.stringify(obj));
    } catch (error) {
      return this.hashString(String(obj));
    }
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry).length * 2;
    }
    
    return totalSize;
  }
}

// Export singleton instance
export const agentCache = new AgentCache();
