/**
 * Advanced Parallel Executor
 * 
 * Executes agents in parallel with intelligent dependency management and resource optimization
 */

import { AgentContext, AgentResponse } from '../agents/types';
import { BaseAgent } from '../agents/types';

export interface ParallelExecutionGroup {
  id: string;
  name: string;
  agents: Array<{
    agent: BaseAgent;
    name: string;
    priority: number;
    dependencies: string[];
    estimatedTime: number;
    resourceRequirements: {
      cpu: number;
      memory: number;
      network: number;
    };
  }>;
  maxConcurrency: number;
  timeout: number;
}

export interface ExecutionResult {
  agentName: string;
  result: AgentResponse;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface ParallelExecutionPlan {
  groups: ParallelExecutionGroup[];
  totalEstimatedTime: number;
  criticalPath: string[];
  resourceOptimization: {
    maxConcurrentAgents: number;
    memoryAllocation: Record<string, number>;
    cpuAllocation: Record<string, number>;
  };
}

export class AdvancedParallelExecutor {
  private executionHistory: Map<string, number> = new Map(); // agentName -> avgExecutionTime
  private resourceUsage: Map<string, { cpu: number; memory: number; network: number }> = new Map();
  private maxConcurrentExecutions: number = 10;
  private currentExecutions: number = 0;

  /**
   * Create an optimized parallel execution plan
   */
  createExecutionPlan(
    agents: Array<{
      agent: BaseAgent;
      name: string;
      dependencies: string[];
      context: AgentContext;
    }>,
    availableResources: {
      maxConcurrency: number;
      maxMemory: number;
      maxCpu: number;
    }
  ): ParallelExecutionPlan {
    // Analyze agent dependencies and create dependency graph
    const dependencyGraph = this.buildDependencyGraph(agents);
    
    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(dependencyGraph, agents);
    
    // Group agents for parallel execution
    const groups = this.createParallelGroups(agents, dependencyGraph, availableResources);
    
    // Optimize resource allocation
    const resourceOptimization = this.optimizeResourceAllocation(groups, availableResources);
    
    // Calculate total estimated time
    const totalEstimatedTime = this.calculateTotalExecutionTime(groups, criticalPath);

    return {
      groups,
      totalEstimatedTime,
      criticalPath,
      resourceOptimization
    };
  }

  /**
   * Execute agents according to the parallel plan
   */
  async executeParallelPlan(
    plan: ParallelExecutionPlan,
    context: AgentContext,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const startTime = Date.now();
    let completedAgents = 0;
    const totalAgents = plan.groups.reduce((sum, group) => sum + group.agents.length, 0);

    console.log(`🚀 Starting parallel execution of ${totalAgents} agents in ${plan.groups.length} groups`);

    // Execute groups sequentially, but agents within groups in parallel
    for (let groupIndex = 0; groupIndex < plan.groups.length; groupIndex++) {
      const group = plan.groups[groupIndex];
      console.log(`📦 Executing group ${groupIndex + 1}/${plan.groups.length}: ${group.name}`);

      // Execute agents in this group in parallel
      const groupResults = await this.executeGroup(group, context, progressCallback);
      results.push(...groupResults);
      
      completedAgents += group.agents.length;
      
      // Update progress
      if (progressCallback) {
        const progress = (completedAgents / totalAgents) * 100;
        progressCallback(progress, `Completed group ${group.name}: ${groupResults.length} agents`);
      }

      // Update execution history
      groupResults.forEach(result => {
        this.updateExecutionHistory(result.agentName, result.executionTime);
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Parallel execution completed in ${totalTime}ms`);
    
    return results;
  }

  /**
   * Execute a single group of agents in parallel
   */
  private async executeGroup(
    group: ParallelExecutionGroup,
    context: AgentContext,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<ExecutionResult[]> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    
    // Sort agents by priority (higher priority first)
    const sortedAgents = [...group.agents].sort((a, b) => b.priority - a.priority);
    
    // Execute agents in parallel with concurrency limit
    const semaphore = new Semaphore(group.maxConcurrency);
    
    const promises = sortedAgents.map(async (agentInfo) => {
      await semaphore.acquire();
      
      try {
        const agentStartTime = Date.now();
        console.log(`🤖 Executing ${agentInfo.name} (priority: ${agentInfo.priority})`);
        
        const result = await Promise.race([
          agentInfo.agent.execute(context),
          this.createTimeoutPromise(group.timeout, agentInfo.name)
        ]);
        
        const executionTime = Date.now() - agentStartTime;
        
        const executionResult: ExecutionResult = {
          agentName: agentInfo.name,
          result,
          executionTime,
          success: result.success
        };
        
        console.log(`✅ ${agentInfo.name} completed in ${executionTime}ms`);
        return executionResult;
        
      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`❌ ${agentInfo.name} failed:`, error);
        
        return {
          agentName: agentInfo.name,
          result: {
            success: false,
            data: {},
            error: error instanceof Error ? error.message : 'Unknown error'
          } as AgentResponse,
          executionTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        semaphore.release();
      }
    });
    
    const groupResults = await Promise.all(promises);
    results.push(...groupResults);
    
    const groupTime = Date.now() - startTime;
    console.log(`📦 Group ${group.name} completed in ${groupTime}ms`);
    
    return results;
  }

  /**
   * Build dependency graph from agents
   */
  private buildDependencyGraph(agents: Array<{ name: string; dependencies: string[] }>): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    agents.forEach(agent => {
      graph.set(agent.name, agent.dependencies);
    });
    
    return graph;
  }

  /**
   * Calculate critical path through dependency graph
   */
  private calculateCriticalPath(
    dependencyGraph: Map<string, string[]>,
    agents: Array<{ name: string; dependencies: string[] }>
  ): string[] {
    // Simple critical path calculation - in a real implementation,
    // this would use more sophisticated algorithms like CPM or PERT
    
    const visited = new Set<string>();
    const criticalPath: string[] = [];
    
    const dfs = (agentName: string, path: string[]): void => {
      if (visited.has(agentName)) return;
      
      visited.add(agentName);
      const newPath = [...path, agentName];
      
      const dependencies = dependencyGraph.get(agentName) || [];
      if (dependencies.length === 0) {
        // Leaf node - check if this is the longest path
        if (newPath.length > criticalPath.length) {
          criticalPath.length = 0;
          criticalPath.push(...newPath);
        }
      } else {
        dependencies.forEach(dep => dfs(dep, newPath));
      }
    };
    
    // Find all root nodes (agents with no dependencies)
    const rootNodes = agents.filter(agent => agent.dependencies.length === 0);
    rootNodes.forEach(root => dfs(root.name, []));
    
    return criticalPath;
  }

  /**
   * Create parallel execution groups
   */
  private createParallelGroups(
    agents: Array<{
      agent: BaseAgent;
      name: string;
      dependencies: string[];
      context: AgentContext;
    }>,
    dependencyGraph: Map<string, string[]>,
    availableResources: { maxConcurrency: number; maxMemory: number; maxCpu: number }
  ): ParallelExecutionGroup[] {
    const groups: ParallelExecutionGroup[] = [];
    const processed = new Set<string>();
    let groupIndex = 0;
    
    while (processed.size < agents.length) {
      // Find agents that can be executed in parallel (no unprocessed dependencies)
      const readyAgents = agents.filter(agent => 
        !processed.has(agent.name) &&
        agent.dependencies.every(dep => processed.has(dep))
      );
      
      if (readyAgents.length === 0) {
        // This shouldn't happen in a well-formed dependency graph
        console.warn('No ready agents found - possible circular dependency');
        break;
      }
      
      // Create group with ready agents
      const group: ParallelExecutionGroup = {
        id: `group_${groupIndex}`,
        name: `Execution Group ${groupIndex + 1}`,
        agents: readyAgents.map(agent => ({
          agent: agent.agent,
          name: agent.name,
          priority: this.calculateAgentPriority(agent.name),
          dependencies: agent.dependencies,
          estimatedTime: this.getEstimatedExecutionTime(agent.name),
          resourceRequirements: this.getResourceRequirements(agent.name)
        })),
        maxConcurrency: Math.min(readyAgents.length, availableResources.maxConcurrency),
        timeout: 30000 // 30 seconds default timeout
      };
      
      groups.push(group);
      
      // Mark agents as processed
      readyAgents.forEach(agent => processed.add(agent.name));
      groupIndex++;
    }
    
    return groups;
  }

  /**
   * Optimize resource allocation across groups
   */
  private optimizeResourceAllocation(
    groups: ParallelExecutionGroup[],
    availableResources: { maxConcurrency: number; maxMemory: number; maxCpu: number }
  ): {
    maxConcurrentAgents: number;
    memoryAllocation: Record<string, number>;
    cpuAllocation: Record<string, number>;
  } {
    const memoryAllocation: Record<string, number> = {};
    const cpuAllocation: Record<string, number> = {};
    
    // Distribute resources based on agent requirements and priorities
    groups.forEach(group => {
      group.agents.forEach(agent => {
        const resourceWeight = agent.priority / 100; // Normalize priority to 0-1
        memoryAllocation[agent.name] = agent.resourceRequirements.memory * resourceWeight;
        cpuAllocation[agent.name] = agent.resourceRequirements.cpu * resourceWeight;
      });
    });
    
    return {
      maxConcurrentAgents: availableResources.maxConcurrency,
      memoryAllocation,
      cpuAllocation
    };
  }

  /**
   * Calculate total execution time
   */
  private calculateTotalExecutionTime(groups: ParallelExecutionGroup[], criticalPath: string[]): number {
    // Sum up execution times along the critical path
    let totalTime = 0;
    
    groups.forEach(group => {
      const groupTime = Math.max(...group.agents.map(agent => agent.estimatedTime));
      totalTime += groupTime;
    });
    
    return totalTime;
  }

  /**
   * Calculate agent priority based on historical performance and importance
   */
  private calculateAgentPriority(agentName: string): number {
    const basePriorities: Record<string, number> = {
      'GreetingAgent': 10,
      'GuardrailsAgent': 100,
      'ValidationAgent': 80,
      'PromptEngineeringAgent': 70,
      'DataSourceFilterAgent': 90,
      'DatabaseExecutionAgent': 85,
      'FileExecutionAgent': 85,
      'ExternalExecutionAgent': 85,
      'MultiSourceQAAgent': 95,
      'VisualAgent': 60,
      'CrossValidationAgent': 75,
      'HallucinationDetectionAgent': 80,
      'SourceCredibilityAgent': 75
    };
    
    return basePriorities[agentName] || 50;
  }

  /**
   * Get estimated execution time for an agent
   */
  private getEstimatedExecutionTime(agentName: string): number {
    const historicalTime = this.executionHistory.get(agentName);
    if (historicalTime) {
      return historicalTime;
    }
    
    // Default estimates based on agent type
    const defaultEstimates: Record<string, number> = {
      'GreetingAgent': 100,
      'GuardrailsAgent': 200,
      'ValidationAgent': 300,
      'PromptEngineeringAgent': 500,
      'DataSourceFilterAgent': 800,
      'DatabaseExecutionAgent': 2000,
      'FileExecutionAgent': 1500,
      'ExternalExecutionAgent': 3000,
      'MultiSourceQAAgent': 1000,
      'VisualAgent': 600,
      'CrossValidationAgent': 400,
      'HallucinationDetectionAgent': 500,
      'SourceCredibilityAgent': 400
    };
    
    return defaultEstimates[agentName] || 1000;
  }

  /**
   * Get resource requirements for an agent
   */
  private getResourceRequirements(agentName: string): { cpu: number; memory: number; network: number } {
    const requirements: Record<string, { cpu: number; memory: number; network: number }> = {
      'GreetingAgent': { cpu: 1, memory: 10, network: 0 },
      'GuardrailsAgent': { cpu: 2, memory: 20, network: 0 },
      'ValidationAgent': { cpu: 3, memory: 30, network: 0 },
      'PromptEngineeringAgent': { cpu: 5, memory: 50, network: 10 },
      'DataSourceFilterAgent': { cpu: 4, memory: 40, network: 5 },
      'DatabaseExecutionAgent': { cpu: 8, memory: 100, network: 20 },
      'FileExecutionAgent': { cpu: 6, memory: 80, network: 15 },
      'ExternalExecutionAgent': { cpu: 7, memory: 90, network: 25 },
      'MultiSourceQAAgent': { cpu: 6, memory: 70, network: 15 },
      'VisualAgent': { cpu: 4, memory: 60, network: 10 },
      'CrossValidationAgent': { cpu: 3, memory: 40, network: 5 },
      'HallucinationDetectionAgent': { cpu: 4, memory: 50, network: 8 },
      'SourceCredibilityAgent': { cpu: 3, memory: 40, network: 5 }
    };
    
    return requirements[agentName] || { cpu: 5, memory: 50, network: 10 };
  }

  /**
   * Update execution history
   */
  private updateExecutionHistory(agentName: string, executionTime: number): void {
    const currentAvg = this.executionHistory.get(agentName) || executionTime;
    const newAvg = (currentAvg + executionTime) / 2;
    this.executionHistory.set(agentName, newAvg);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number, agentName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent ${agentName} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    executionHistory: Record<string, number>;
    currentExecutions: number;
    maxConcurrentExecutions: number;
  } {
    return {
      executionHistory: Object.fromEntries(this.executionHistory),
      currentExecutions: this.currentExecutions,
      maxConcurrentExecutions: this.maxConcurrentExecutions
    };
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}

// Export singleton instance
export const advancedParallelExecutor = new AdvancedParallelExecutor();
