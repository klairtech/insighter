/**
 * Dynamic Load Balancer
 * 
 * Intelligently distributes agent execution across available resources
 */

import { BaseAgent } from '../agents/types';

export interface AgentInstance {
  id: string;
  agent: BaseAgent;
  status: 'idle' | 'busy' | 'error' | 'maintenance';
  currentLoad: number;
  maxLoad: number;
  responseTime: number;
  successRate: number;
  lastUsed: number;
  totalExecutions: number;
  errorCount: number;
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'least_response_time' | 'adaptive';
  parameters: Record<string, any>;
}

export interface LoadBalancingDecision {
  selectedInstance: AgentInstance;
  reasoning: string;
  confidence: number;
  estimatedWaitTime: number;
  fallbackInstances: AgentInstance[];
}

export interface SystemMetrics {
  totalInstances: number;
  activeInstances: number;
  averageResponseTime: number;
  averageLoad: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  bottlenecks: string[];
}

export class DynamicLoadBalancer {
  private agentInstances: Map<string, AgentInstance[]> = new Map(); // agentType -> instances
  private loadBalancingStrategies: Map<string, LoadBalancingStrategy> = new Map();
  private systemMetrics: SystemMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsHistory: Array<{ timestamp: number; metrics: SystemMetrics }> = [];

  constructor() {
    this.systemMetrics = {
      totalInstances: 0,
      activeInstances: 0,
      averageResponseTime: 0,
      averageLoad: 0,
      systemHealth: 'healthy',
      bottlenecks: []
    };

    this.initializeDefaultStrategies();
    this.startHealthMonitoring();
  }

  /**
   * Register an agent instance
   */
  registerAgentInstance(agentType: string, instance: AgentInstance): void {
    if (!this.agentInstances.has(agentType)) {
      this.agentInstances.set(agentType, []);
    }

    const instances = this.agentInstances.get(agentType)!;
    const existingIndex = instances.findIndex(i => i.id === instance.id);
    
    if (existingIndex >= 0) {
      instances[existingIndex] = instance;
    } else {
      instances.push(instance);
    }

    this.updateSystemMetrics();
    console.log(`📊 Registered agent instance: ${agentType}/${instance.id}`);
  }

  /**
   * Unregister an agent instance
   */
  unregisterAgentInstance(agentType: string, instanceId: string): void {
    const instances = this.agentInstances.get(agentType);
    if (instances) {
      const index = instances.findIndex(i => i.id === instanceId);
      if (index >= 0) {
        instances.splice(index, 1);
        this.updateSystemMetrics();
        console.log(`📊 Unregistered agent instance: ${agentType}/${instanceId}`);
      }
    }
  }

  /**
   * Select the best agent instance for execution
   */
  selectAgentInstance(
    agentType: string,
    context: {
      priority: number;
      estimatedExecutionTime: number;
      resourceRequirements: { cpu: number; memory: number; network: number };
      userId?: string;
      workspaceId?: string;
    }
  ): LoadBalancingDecision {
    const instances = this.agentInstances.get(agentType);
    
    if (!instances || instances.length === 0) {
      throw new Error(`No instances available for agent type: ${agentType}`);
    }

    const availableInstances = instances.filter(instance => 
      instance.status === 'idle' || instance.status === 'busy'
    );

    if (availableInstances.length === 0) {
      throw new Error(`No available instances for agent type: ${agentType}`);
    }

    const strategy = this.loadBalancingStrategies.get(agentType) || this.getDefaultStrategy();
    const selectedInstance = this.applyLoadBalancingStrategy(availableInstances, strategy, context);
    
    const reasoning = this.generateReasoning(selectedInstance, strategy, context);
    const confidence = this.calculateConfidence(selectedInstance, availableInstances);
    const estimatedWaitTime = this.estimateWaitTime(selectedInstance, context);
    const fallbackInstances = this.selectFallbackInstances(availableInstances, selectedInstance);

    return {
      selectedInstance,
      reasoning,
      confidence,
      estimatedWaitTime,
      fallbackInstances
    };
  }

  /**
   * Execute agent with load balancing
   */
  async executeWithLoadBalancing<T>(
    agentType: string,
    context: any,
    executionContext: {
      priority: number;
      estimatedExecutionTime: number;
      resourceRequirements: { cpu: number; memory: number; network: number };
      userId?: string;
      workspaceId?: string;
    }
  ): Promise<T> {
    const decision = this.selectAgentInstance(agentType, executionContext);
    const instance = decision.selectedInstance;

    // Mark instance as busy
    instance.status = 'busy';
    instance.currentLoad += executionContext.resourceRequirements.cpu;
    instance.lastUsed = Date.now();

    const startTime = Date.now();

    try {
      console.log(`🔄 Executing ${agentType} on instance ${instance.id} (${decision.reasoning})`);
      
      const result = await instance.agent.execute(context);
      
      // Update instance metrics
      const executionTime = Date.now() - startTime;
      instance.responseTime = (instance.responseTime + executionTime) / 2;
      instance.totalExecutions++;
      instance.successRate = (instance.successRate + 1) / 2;
      
      return result as T;
      
    } catch (error) {
      // Update error metrics
      instance.errorCount++;
      instance.successRate = (instance.successRate + 0) / 2;
      
      // If error rate is too high, mark instance as error
      if (instance.errorCount > 5 && instance.successRate < 0.5) {
        instance.status = 'error';
        console.warn(`⚠️ Agent instance ${instance.id} marked as error due to high failure rate`);
      }
      
      throw error;
      
    } finally {
      // Mark instance as idle
      instance.status = 'idle';
      instance.currentLoad = Math.max(0, instance.currentLoad - executionContext.resourceRequirements.cpu);
    }
  }

  /**
   * Apply load balancing strategy
   */
  private applyLoadBalancingStrategy(
    instances: AgentInstance[],
    strategy: LoadBalancingStrategy,
    context: any
  ): AgentInstance {
    switch (strategy.type) {
      case 'round_robin':
        return this.roundRobinSelection(instances);
      
      case 'least_connections':
        return this.leastConnectionsSelection(instances);
      
      case 'weighted_round_robin':
        return this.weightedRoundRobinSelection(instances, strategy.parameters);
      
      case 'least_response_time':
        return this.leastResponseTimeSelection(instances);
      
      case 'adaptive':
        return this.adaptiveSelection(instances, context);
      
      default:
        return this.roundRobinSelection(instances);
    }
  }

  /**
   * Round robin selection
   */
  private roundRobinSelection(instances: AgentInstance[]): AgentInstance {
    const sortedInstances = instances.sort((a, b) => a.lastUsed - b.lastUsed);
    return sortedInstances[0];
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(instances: AgentInstance[]): AgentInstance {
    return instances.reduce((best, current) => 
      current.currentLoad < best.currentLoad ? current : best
    );
  }

  /**
   * Weighted round robin selection
   */
  private weightedRoundRobinSelection(instances: AgentInstance[], parameters: any): AgentInstance {
    const weights = parameters.weights || {};
    
    // Calculate weighted scores
    const scoredInstances = instances.map(instance => {
      const weight = weights[instance.id] || 1;
      const loadFactor = 1 - (instance.currentLoad / instance.maxLoad);
      const healthFactor = instance.successRate;
      const score = weight * loadFactor * healthFactor;
      
      return { instance, score };
    });
    
    // Select instance with highest score
    scoredInstances.sort((a, b) => b.score - a.score);
    return scoredInstances[0].instance;
  }

  /**
   * Least response time selection
   */
  private leastResponseTimeSelection(instances: AgentInstance[]): AgentInstance {
    return instances.reduce((best, current) => 
      current.responseTime < best.responseTime ? current : best
    );
  }

  /**
   * Adaptive selection based on multiple factors
   */
  private adaptiveSelection(instances: AgentInstance[], context: any): AgentInstance {
    const scoredInstances = instances.map(instance => {
      let score = 0;
      
      // Load factor (lower is better)
      const loadFactor = 1 - (instance.currentLoad / instance.maxLoad);
      score += loadFactor * 0.3;
      
      // Response time factor (lower is better)
      const responseTimeFactor = 1 - Math.min(instance.responseTime / 5000, 1);
      score += responseTimeFactor * 0.25;
      
      // Success rate factor
      score += instance.successRate * 0.25;
      
      // Priority factor (higher priority gets better instances)
      const priorityFactor = Math.min(context.priority / 100, 1);
      score += priorityFactor * 0.1;
      
      // Resource availability factor
      const resourceFactor = this.calculateResourceAvailability(instance, context.resourceRequirements);
      score += resourceFactor * 0.1;
      
      return { instance, score };
    });
    
    scoredInstances.sort((a, b) => b.score - a.score);
    return scoredInstances[0].instance;
  }

  /**
   * Calculate resource availability
   */
  private calculateResourceAvailability(instance: AgentInstance, requirements: any): number {
    const availableCpu = instance.maxLoad - instance.currentLoad;
    const cpuAvailability = Math.min(availableCpu / requirements.cpu, 1);
    
    return Math.max(0, cpuAvailability);
  }

  /**
   * Generate reasoning for selection
   */
  private generateReasoning(instance: AgentInstance, strategy: LoadBalancingStrategy, context: any): string {
    const factors = [];
    
    if (strategy.type === 'adaptive') {
      factors.push(`load: ${(instance.currentLoad / instance.maxLoad * 100).toFixed(1)}%`);
      factors.push(`response time: ${instance.responseTime}ms`);
      factors.push(`success rate: ${(instance.successRate * 100).toFixed(1)}%`);
    } else {
      factors.push(`strategy: ${strategy.type}`);
    }
    
    return `Selected based on ${factors.join(', ')}`;
  }

  /**
   * Calculate confidence in selection
   */
  private calculateConfidence(selectedInstance: AgentInstance, availableInstances: AgentInstance[]): number {
    if (availableInstances.length === 1) return 1.0;
    
    const avgLoad = availableInstances.reduce((sum, i) => sum + i.currentLoad, 0) / availableInstances.length;
    const avgResponseTime = availableInstances.reduce((sum, i) => sum + i.responseTime, 0) / availableInstances.length;
    const avgSuccessRate = availableInstances.reduce((sum, i) => sum + i.successRate, 0) / availableInstances.length;
    
    let confidence = 0.5; // Base confidence
    
    // Adjust based on how much better the selected instance is
    if (selectedInstance.currentLoad < avgLoad) confidence += 0.2;
    if (selectedInstance.responseTime < avgResponseTime) confidence += 0.2;
    if (selectedInstance.successRate > avgSuccessRate) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Estimate wait time
   */
  private estimateWaitTime(instance: AgentInstance, context: any): number {
    if (instance.status === 'idle') return 0;
    
    const currentLoad = instance.currentLoad;
    const maxLoad = instance.maxLoad;
    const estimatedTime = context.estimatedExecutionTime;
    
    // Estimate based on current load and execution time
    const loadFactor = currentLoad / maxLoad;
    return Math.round(estimatedTime * loadFactor);
  }

  /**
   * Select fallback instances
   */
  private selectFallbackInstances(instances: AgentInstance[], selectedInstance: AgentInstance): AgentInstance[] {
    return instances
      .filter(i => i.id !== selectedInstance.id)
      .sort((a, b) => a.currentLoad - b.currentLoad)
      .slice(0, 2); // Top 2 fallback instances
  }

  /**
   * Initialize default load balancing strategies
   */
  private initializeDefaultStrategies(): void {
    const defaultStrategies: Record<string, LoadBalancingStrategy> = {
      'GreetingAgent': { type: 'round_robin', parameters: {} },
      'GuardrailsAgent': { type: 'least_response_time', parameters: {} },
      'ValidationAgent': { type: 'adaptive', parameters: {} },
      'PromptEngineeringAgent': { type: 'weighted_round_robin', parameters: { weights: {} } },
      'DataSourceFilterAgent': { type: 'adaptive', parameters: {} },
      'DatabaseExecutionAgent': { type: 'least_connections', parameters: {} },
      'FileExecutionAgent': { type: 'least_connections', parameters: {} },
      'ExternalExecutionAgent': { type: 'least_response_time', parameters: {} },
      'MultiSourceQAAgent': { type: 'adaptive', parameters: {} },
      'VisualAgent': { type: 'weighted_round_robin', parameters: { weights: {} } },
      'CrossValidationAgent': { type: 'round_robin', parameters: {} },
      'HallucinationDetectionAgent': { type: 'least_response_time', parameters: {} },
      'SourceCredibilityAgent': { type: 'round_robin', parameters: {} }
    };

    for (const [agentType, strategy] of Object.entries(defaultStrategies)) {
      this.loadBalancingStrategies.set(agentType, strategy);
    }
  }

  /**
   * Get default strategy
   */
  private getDefaultStrategy(): LoadBalancingStrategy {
    return { type: 'adaptive', parameters: {} };
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const allInstances = Array.from(this.agentInstances.values()).flat();
    
    this.systemMetrics.totalInstances = allInstances.length;
    this.systemMetrics.activeInstances = allInstances.filter(i => i.status === 'idle' || i.status === 'busy').length;
    
    if (allInstances.length > 0) {
      this.systemMetrics.averageResponseTime = allInstances.reduce((sum, i) => sum + i.responseTime, 0) / allInstances.length;
      this.systemMetrics.averageLoad = allInstances.reduce((sum, i) => sum + i.currentLoad, 0) / allInstances.length;
    }
    
    // Determine system health
    const errorRate = allInstances.filter(i => i.status === 'error').length / allInstances.length;
    const avgSuccessRate = allInstances.reduce((sum, i) => sum + i.successRate, 0) / allInstances.length;
    
    if (errorRate > 0.3 || avgSuccessRate < 0.7) {
      this.systemMetrics.systemHealth = 'critical';
    } else if (errorRate > 0.1 || avgSuccessRate < 0.9) {
      this.systemMetrics.systemHealth = 'degraded';
    } else {
      this.systemMetrics.systemHealth = 'healthy';
    }
    
    // Identify bottlenecks
    this.systemMetrics.bottlenecks = allInstances
      .filter(i => i.currentLoad > i.maxLoad * 0.8)
      .map(i => i.id);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const allInstances = Array.from(this.agentInstances.values()).flat();
    
    allInstances.forEach(instance => {
      // Reset error status if instance has been idle for a while
      if (instance.status === 'error' && Date.now() - instance.lastUsed > 300000) { // 5 minutes
        instance.status = 'idle';
        instance.errorCount = 0;
        console.log(`🔄 Agent instance ${instance.id} recovered from error state`);
      }
      
      // Mark instances as maintenance if they've been busy too long
      if (instance.status === 'busy' && Date.now() - instance.lastUsed > 60000) { // 1 minute
        instance.status = 'maintenance';
        console.warn(`⚠️ Agent instance ${instance.id} marked for maintenance`);
      }
    });
    
    this.updateSystemMetrics();
    
    // Store metrics history
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics: { ...this.systemMetrics }
    });
    
    // Keep only last 100 metrics entries
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.splice(0, this.metricsHistory.length - 100);
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): Array<{ timestamp: number; metrics: SystemMetrics }> {
    return [...this.metricsHistory];
  }

  /**
   * Get agent instances for a type
   */
  getAgentInstances(agentType: string): AgentInstance[] {
    return [...(this.agentInstances.get(agentType) || [])];
  }

  /**
   * Set load balancing strategy for an agent type
   */
  setLoadBalancingStrategy(agentType: string, strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategies.set(agentType, strategy);
    console.log(`📊 Set load balancing strategy for ${agentType}: ${strategy.type}`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance
export const dynamicLoadBalancer = new DynamicLoadBalancer();
