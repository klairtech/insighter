// import { OpenAI } from 'openai';
// import Anthropic from '@anthropic-ai/sdk';

interface RateLimitInfo {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: number;
}

interface LLMRateLimitConfig {
  openai: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  claude: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export class LLMRateLimiter {
  private static instance: LLMRateLimiter;
  private rateLimitCache: Map<string, RateLimitInfo> = new Map();
  private requestQueues: Map<string, Array<() => Promise<any>>> = new Map();
  private readonly config: LLMRateLimitConfig;

  private constructor() {
    this.config = {
      openai: {
        requestsPerMinute: 3500, // OpenAI GPT-4 rate limit
        tokensPerMinute: 90000
      },
      claude: {
        requestsPerMinute: 1000, // Claude rate limit
        tokensPerMinute: 40000
      }
    };
  }

  static getInstance(): LLMRateLimiter {
    if (!LLMRateLimiter.instance) {
      LLMRateLimiter.instance = new LLMRateLimiter();
    }
    return LLMRateLimiter.instance;
  }

  /**
   * Check if we can make a request to the specified LLM
   */
  async canMakeRequest(
    provider: 'openai' | 'claude',
    estimatedTokens: number = 1000
  ): Promise<{ allowed: boolean; waitTime?: number; reason?: string }> {
    const key = `${provider}_${this.getCurrentMinute()}`;
    const current = this.rateLimitCache.get(key);
    const limits = this.config[provider];

    if (!current) {
      // First request this minute
      this.rateLimitCache.set(key, {
        requestsPerMinute: limits.requestsPerMinute,
        tokensPerMinute: limits.tokensPerMinute,
        requestsRemaining: limits.requestsPerMinute - 1,
        tokensRemaining: limits.tokensPerMinute - estimatedTokens,
        resetTime: Date.now() + 60000
      });
      return { allowed: true };
    }

    // Check request limit
    if (current.requestsRemaining <= 0) {
      return {
        allowed: false,
        waitTime: current.resetTime - Date.now(),
        reason: 'Request rate limit exceeded'
      };
    }

    // Check token limit
    if (current.tokensRemaining < estimatedTokens) {
      return {
        allowed: false,
        waitTime: current.resetTime - Date.now(),
        reason: 'Token rate limit exceeded'
      };
    }

    // Update counters
    current.requestsRemaining--;
    current.tokensRemaining -= estimatedTokens;

    return { allowed: true };
  }

  /**
   * Queue a request if rate limited
   */
  async queueRequest<T>(
    provider: 'openai' | 'claude',
    requestFn: () => Promise<T>,
    estimatedTokens: number = 1000
  ): Promise<T> {
    const canMake = await this.canMakeRequest(provider, estimatedTokens);

    if (canMake.allowed) {
      return await requestFn();
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const queueKey = `${provider}_queue`;
      if (!this.requestQueues.has(queueKey)) {
        this.requestQueues.set(queueKey, []);
      }

      this.requestQueues.get(queueKey)!.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Process queue if this is the first queued request
      if (this.requestQueues.get(queueKey)!.length === 1) {
        this.processQueue(queueKey, provider);
      }
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(queueKey: string, provider: 'openai' | 'claude'): Promise<void> {
    const queue = this.requestQueues.get(queueKey);
    if (!queue || queue.length === 0) return;

    const request = queue.shift()!;
    
    try {
      await request();
    } catch (error) {
      console.error(`Request in queue failed:`, error);
    }

    // Wait before processing next request
    const waitTime = provider === 'openai' ? 100 : 200; // ms between requests
    setTimeout(() => {
      this.processQueue(queueKey, provider);
    }, waitTime);
  }

  /**
   * Handle rate limit errors from API responses
   */
  handleRateLimitError(error: any, provider: 'openai' | 'claude'): {
    isRateLimit: boolean;
    retryAfter?: number;
    shouldFallback: boolean;
  } {
    const isRateLimit = 
      error?.status === 429 || 
      error?.message?.includes('rate limit') ||
      error?.message?.includes('quota exceeded');

    if (!isRateLimit) {
      return { isRateLimit: false, shouldFallback: false };
    }

    // Extract retry-after header or estimate
    const retryAfter = error?.headers?.['retry-after'] || 
                      error?.headers?.['x-ratelimit-reset-requests'] ||
                      60; // Default 1 minute

    return {
      isRateLimit: true,
      retryAfter: parseInt(retryAfter) * 1000, // Convert to milliseconds
      shouldFallback: true
    };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(provider: 'openai' | 'claude'): RateLimitInfo | null {
    const key = `${provider}_${this.getCurrentMinute()}`;
    return this.rateLimitCache.get(key) || null;
  }

  /**
   * Clear expired rate limit data
   */
  clearExpiredData(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitCache.entries()) {
      if (now > data.resetTime) {
        this.rateLimitCache.delete(key);
      }
    }
  }

  private getCurrentMinute(): string {
    return Math.floor(Date.now() / 60000).toString();
  }
}

/**
 * Enhanced AI call with rate limiting
 */
export async function callAIWithRateLimit(
  provider: 'openai' | 'claude',
  requestFn: () => Promise<any>,
  estimatedTokens: number = 1000,
  fallbackProvider?: 'openai' | 'claude',
  fallbackRequestFn?: () => Promise<any>
): Promise<any> {
  const rateLimiter = LLMRateLimiter.getInstance();

  try {
    // Try primary provider with rate limiting
    return await rateLimiter.queueRequest(provider, requestFn, estimatedTokens);
  } catch (error) {
    const rateLimitInfo = rateLimiter.handleRateLimitError(error, provider);
    
    if (rateLimitInfo.isRateLimit && fallbackProvider && fallbackRequestFn) {
      console.warn(`⚠️ ${provider} rate limited, trying ${fallbackProvider} fallback`);
      
      try {
        return await rateLimiter.queueRequest(fallbackProvider, fallbackRequestFn, estimatedTokens);
      } catch (fallbackError) {
        const fallbackRateLimitInfo = rateLimiter.handleRateLimitError(fallbackError, fallbackProvider);
        
        if (fallbackRateLimitInfo.isRateLimit) {
          throw new Error(`Both ${provider} and ${fallbackProvider} are rate limited. Please try again later.`);
        }
        
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * Cleanup expired data every 5 minutes
 */
setInterval(() => {
  LLMRateLimiter.getInstance().clearExpiredData();
}, 5 * 60 * 1000);
