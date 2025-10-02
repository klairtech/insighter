import { OpenAI } from 'openai';
import { BaseDataSource } from '../datasources/types';
import { ConversationContext } from '../ai-agents';
import { queryPlanCache } from '../cache/QueryPlanCache';

export interface ExecutionPlan {
  requiredAgents: AgentType[];
  parallelGroups: AgentType[][];
  skipAgents: AgentType[];
  dataSourceStrategy: DataSourceStrategy;
  validationLevel: 'light' | 'medium' | 'heavy';
  estimatedTime: number;
  confidence: number;
  reasoning: string;
}

export interface DataSourceStrategy {
  primarySources: BaseDataSource[];
  fallbackSources: BaseDataSource[];
  executionOrder: 'parallel' | 'sequential' | 'hybrid';
  timeoutStrategy: 'fail_fast' | 'wait_all' | 'partial_results';
  priorityWeights: Record<string, number>;
}

export type AgentType = 
  | 'GreetingAgent'
  | 'GuardrailsAgent' 
  | 'ValidationAgent'
  | 'PromptEngineeringAgent'
  | 'DataSourceFilterAgent'
  | 'DatabaseExecutionAgent'
  | 'FileExecutionAgent'
  | 'ExternalExecutionAgent'
  | 'MultiSourceQAAgent'
  | 'VisualAgent'
  | 'CrossValidationAgent'
  | 'HallucinationDetectionAgent'
  | 'SourceCredibilityAgent';

export interface QueryAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  queryType: 'factual' | 'analytical' | 'comparative' | 'predictive' | 'conversational';
  dataRequirements: {
    needsDatabase: boolean;
    needsFiles: boolean;
    needsExternal: boolean;
    needsVisualization: boolean;
  };
  estimatedTokens: number;
  confidence: number;
}

export class MasterPlanningAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Creates an optimized execution plan for the given query
   */
  async createExecutionPlan(
    query: string,
    availableSources: BaseDataSource[],
    conversationContext: ConversationContext,
    userId?: string
  ): Promise<ExecutionPlan> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cachedPlan = await queryPlanCache.getExecutionPlan(query, availableSources as unknown as Record<string, unknown>[], userId);
      if (cachedPlan) {
        console.log('🎯 Using cached execution plan');
        return cachedPlan;
      }

      // Check for cached query analysis
      let queryAnalysis = await queryPlanCache.getQueryAnalysis(query);
      if (!queryAnalysis) {
        queryAnalysis = await this.analyzeQuery(query, conversationContext);
        await queryPlanCache.setQueryAnalysis(query, queryAnalysis);
      }
      console.log('🔍 Query Analysis:', queryAnalysis);

      // Determine data source strategy
      const dataSourceStrategy = await this.createDataSourceStrategy(
        queryAnalysis,
        availableSources,
        conversationContext
      );

      // Create execution plan based on analysis
      const executionPlan = await this.generateExecutionPlan(
        queryAnalysis,
        dataSourceStrategy,
        conversationContext
      );

      // Cache the plan and analysis
      await queryPlanCache.setExecutionPlan(
        query,
        availableSources as unknown as Record<string, unknown>[],
        executionPlan,
        queryAnalysis,
        userId
      );

      const processingTime = Date.now() - startTime;
      console.log(`🎯 Master Planning completed in ${processingTime}ms`);

      return executionPlan;

    } catch (error) {
      console.error('Master Planning Agent error:', error);
      // Return fallback plan
      return this.createFallbackPlan(availableSources);
    }
  }

  /**
   * Analyzes the query to determine complexity and requirements
   */
  private async analyzeQuery(
    query: string,
    conversationContext: ConversationContext
  ): Promise<QueryAnalysis> {
    const systemPrompt = `You are a query analysis expert. Analyze the user query and determine:
1. Complexity level (simple/medium/complex)
2. Query type (factual/analytical/comparative/predictive/conversational)
3. Data requirements (database/files/external/visualization)
4. Estimated token usage
5. Confidence level

Consider conversation context and query patterns.`;

    const userPrompt = `Query: "${query}"
Conversation History: ${JSON.stringify(conversationContext.messages.slice(-3))}

Provide analysis in JSON format:
{
  "complexity": "simple|medium|complex",
  "queryType": "factual|analytical|comparative|predictive|conversational",
  "dataRequirements": {
    "needsDatabase": boolean,
    "needsFiles": boolean,
    "needsExternal": boolean,
    "needsVisualization": boolean
  },
  "estimatedTokens": number,
  "confidence": number
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    try {
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      return analysis as QueryAnalysis;
    } catch (error) {
      console.error('Failed to parse query analysis:', error);
      return this.getDefaultQueryAnalysis();
    }
  }

  /**
   * Creates data source strategy based on query analysis
   */
  private async createDataSourceStrategy(
    queryAnalysis: QueryAnalysis,
    availableSources: BaseDataSource[],
    _conversationContext: ConversationContext
  ): Promise<DataSourceStrategy> {
    const databaseSources = availableSources.filter(s => ['postgresql', 'mysql', 'redshift', 'sqlite'].includes(s.type));
    const fileSources = availableSources.filter(s => ['excel', 'csv', 'pdf', 'word', 'powerpoint', 'text'].includes(s.type));
    const externalSources = availableSources.filter(s => ['google-sheets', 'google-docs', 'web-url', 'google-analytics'].includes(s.type));

    // Determine execution strategy based on query requirements
    let executionOrder: 'parallel' | 'sequential' | 'hybrid' = 'parallel';
    let timeoutStrategy: 'fail_fast' | 'wait_all' | 'partial_results' = 'partial_results';

    if (queryAnalysis.complexity === 'simple') {
      executionOrder = 'parallel';
      timeoutStrategy = 'fail_fast';
    } else if (queryAnalysis.complexity === 'complex') {
      executionOrder = 'hybrid';
      timeoutStrategy = 'wait_all';
    }

    // Calculate priority weights based on query type
    const priorityWeights: Record<string, number> = {};
    
    if (queryAnalysis.dataRequirements.needsDatabase) {
      databaseSources.forEach(source => {
        priorityWeights[source.id] = 0.8;
      });
    }
    
    if (queryAnalysis.dataRequirements.needsFiles) {
      fileSources.forEach(source => {
        priorityWeights[source.id] = 0.6;
      });
    }
    
    if (queryAnalysis.dataRequirements.needsExternal) {
      externalSources.forEach(source => {
        priorityWeights[source.id] = 0.4;
      });
    }

    return {
      primarySources: availableSources.filter(source => 
        priorityWeights[source.id] >= 0.5
      ),
      fallbackSources: availableSources.filter(source => 
        priorityWeights[source.id] < 0.5
      ),
      executionOrder,
      timeoutStrategy,
      priorityWeights
    };
  }

  /**
   * Generates the final execution plan
   */
  private async generateExecutionPlan(
    queryAnalysis: QueryAnalysis,
    dataSourceStrategy: DataSourceStrategy,
    _conversationContext: ConversationContext
  ): Promise<ExecutionPlan> {
    const requiredAgents: AgentType[] = [];
    const skipAgents: AgentType[] = [];
    const parallelGroups: AgentType[][] = [];

    // Always include core agents
    requiredAgents.push('GreetingAgent', 'GuardrailsAgent');

    // Determine validation level based on complexity
    let validationLevel: 'light' | 'medium' | 'heavy' = 'light';
    if (queryAnalysis.complexity === 'medium') {
      validationLevel = 'medium';
    } else if (queryAnalysis.complexity === 'complex') {
      validationLevel = 'heavy';
    }

    // Add validation agents based on level
    if (validationLevel === 'light') {
      requiredAgents.push('ValidationAgent');
      skipAgents.push('CrossValidationAgent', 'HallucinationDetectionAgent');
    } else if (validationLevel === 'medium') {
      requiredAgents.push('ValidationAgent', 'CrossValidationAgent');
      skipAgents.push('HallucinationDetectionAgent');
    } else {
      requiredAgents.push('ValidationAgent', 'CrossValidationAgent', 'HallucinationDetectionAgent');
    }

    // Add prompt engineering for complex queries
    if (queryAnalysis.complexity !== 'simple') {
      requiredAgents.push('PromptEngineeringAgent');
    } else {
      skipAgents.push('PromptEngineeringAgent');
    }

    // Always include data source filtering
    requiredAgents.push('DataSourceFilterAgent');

    // Add execution agents based on data requirements
    if (queryAnalysis.dataRequirements.needsDatabase) {
      requiredAgents.push('DatabaseExecutionAgent');
    }
    if (queryAnalysis.dataRequirements.needsFiles) {
      requiredAgents.push('FileExecutionAgent');
    }
    if (queryAnalysis.dataRequirements.needsExternal) {
      requiredAgents.push('ExternalExecutionAgent');
    }

    // Always include Q&A agent
    requiredAgents.push('MultiSourceQAAgent');

    // Add visual agent if needed
    if (queryAnalysis.dataRequirements.needsVisualization) {
      requiredAgents.push('VisualAgent');
    } else {
      skipAgents.push('VisualAgent');
    }

    // Create parallel groups for optimization
    parallelGroups.push(['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent']);
    
    if (queryAnalysis.dataRequirements.needsDatabase || 
        queryAnalysis.dataRequirements.needsFiles || 
        queryAnalysis.dataRequirements.needsExternal) {
      const executionAgents = requiredAgents.filter(agent => 
        agent.includes('ExecutionAgent')
      );
      if (executionAgents.length > 0) {
        parallelGroups.push(executionAgents);
      }
    }

    // Estimate processing time
    const estimatedTime = this.estimateProcessingTime(
      queryAnalysis,
      requiredAgents,
      dataSourceStrategy
    );

    return {
      requiredAgents,
      parallelGroups,
      skipAgents,
      dataSourceStrategy,
      validationLevel,
      estimatedTime,
      confidence: queryAnalysis.confidence,
      reasoning: this.generateReasoning(queryAnalysis, dataSourceStrategy)
    };
  }

  /**
   * Estimates processing time based on plan
   */
  private estimateProcessingTime(
    queryAnalysis: QueryAnalysis,
    requiredAgents: AgentType[],
    dataSourceStrategy: DataSourceStrategy
  ): number {
    let baseTime = 2000; // 2 seconds base

    // Add time based on complexity
    if (queryAnalysis.complexity === 'medium') baseTime += 3000;
    else if (queryAnalysis.complexity === 'complex') baseTime += 6000;

    // Add time based on number of data sources
    const sourceCount = dataSourceStrategy.primarySources.length;
    baseTime += sourceCount * 1000;

    // Add time based on validation level
    if (requiredAgents.includes('CrossValidationAgent')) baseTime += 2000;
    if (requiredAgents.includes('HallucinationDetectionAgent')) baseTime += 3000;

    return Math.min(baseTime, 15000); // Cap at 15 seconds
  }

  /**
   * Generates reasoning for the execution plan
   */
  private generateReasoning(
    queryAnalysis: QueryAnalysis,
    dataSourceStrategy: DataSourceStrategy
  ): string {
    const reasons = [];
    
    reasons.push(`Query complexity: ${queryAnalysis.complexity}`);
    reasons.push(`Query type: ${queryAnalysis.queryType}`);
    reasons.push(`Data sources needed: ${dataSourceStrategy.primarySources.length}`);
    reasons.push(`Execution strategy: ${dataSourceStrategy.executionOrder}`);
    
    return reasons.join(', ');
  }

  /**
   * Creates a fallback plan when planning fails
   */
  private createFallbackPlan(availableSources: BaseDataSource[]): ExecutionPlan {
    return {
      requiredAgents: [
        'GreetingAgent',
        'GuardrailsAgent',
        'ValidationAgent',
        'DataSourceFilterAgent',
        'DatabaseExecutionAgent',
        'FileExecutionAgent',
        'ExternalExecutionAgent',
        'MultiSourceQAAgent'
      ],
      parallelGroups: [
        ['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent'],
        ['DatabaseExecutionAgent', 'FileExecutionAgent', 'ExternalExecutionAgent']
      ],
      skipAgents: ['PromptEngineeringAgent', 'VisualAgent', 'CrossValidationAgent', 'HallucinationDetectionAgent'],
      dataSourceStrategy: {
        primarySources: availableSources,
        fallbackSources: [],
        executionOrder: 'parallel',
        timeoutStrategy: 'partial_results',
        priorityWeights: {}
      },
      validationLevel: 'light',
      estimatedTime: 10000,
      confidence: 0.5,
      reasoning: 'Fallback plan due to planning error'
    };
  }


  /**
   * Default query analysis for error cases
   */
  private getDefaultQueryAnalysis(): QueryAnalysis {
    return {
      complexity: 'medium',
      queryType: 'factual',
      dataRequirements: {
        needsDatabase: true,
        needsFiles: true,
        needsExternal: false,
        needsVisualization: false
      },
      estimatedTokens: 1000,
      confidence: 0.5
    };
  }

  /**
   * Clears the planning cache
   */
  clearCache(): void {
    queryPlanCache.clearAll();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): any {
    return queryPlanCache.getCacheStats();
  }
}
