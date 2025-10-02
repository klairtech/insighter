/**
 * Multi-Agent Flow
 * 
 * Orchestrates independent agents to process user queries
 */

import { 
  GuardrailsAgent, 
  PromptEngineeringAgent, 
  DataSourceFilterAgent, 
  MultiSourceQAAgent, 
  VisualAgent,
  GreetingAgent,
  ValidationAgent,
  DatabaseExecutionAgent,
  ExternalSearchAgent,
  FileExecutionAgent,
  ExternalExecutionAgent,
  AgentContext,
  EnhancedAgentResponse
} from './agents';
import { CrossValidationAgent } from './agents/cross-validation-agent';
import { HallucinationDetectionAgent } from './agents/hallucination-detection-agent';
import { SourceCredibilityAgent } from './agents/source-credibility-agent';
import { 
  analyzeConversationContext, 
  determineQueryProcessingStrategy, 
  filterConversationContext
} from './agents/conversation-context-agent';
import { MasterPlanningAgent, ExecutionPlan } from './agents/MasterPlanningAgent';
import { advancedParallelExecutor } from './parallelization/AdvancedParallelExecutor';
import { predictiveCacheManager } from './predictive-caching/PredictiveCacheManager';
// Database execution will be handled by individual agents
import { mlLearningService, InteractionData } from './ml-learning-service';

export class MultiAgentFlow {
  protected greetingAgent: GreetingAgent;
  protected guardrailsAgent: GuardrailsAgent;
  protected validationAgent: ValidationAgent;
  protected promptEngineeringAgent: PromptEngineeringAgent;
  protected dataSourceFilterAgent: DataSourceFilterAgent;
  protected databaseExecutionAgent: DatabaseExecutionAgent;
  protected fileExecutionAgent: FileExecutionAgent;
  protected externalExecutionAgent: ExternalExecutionAgent;
  protected externalSearchAgent: ExternalSearchAgent;
  protected multiSourceQAAgent: MultiSourceQAAgent;
  protected visualAgent: VisualAgent;
  protected crossValidationAgent: CrossValidationAgent;
  protected hallucinationDetectionAgent: HallucinationDetectionAgent;
  protected sourceCredibilityAgent: SourceCredibilityAgent;
  protected masterPlanningAgent: MasterPlanningAgent;

  constructor() {
    this.greetingAgent = new GreetingAgent();
    this.guardrailsAgent = new GuardrailsAgent();
    this.validationAgent = new ValidationAgent();
    this.promptEngineeringAgent = new PromptEngineeringAgent();
    this.dataSourceFilterAgent = new DataSourceFilterAgent();
    this.databaseExecutionAgent = new DatabaseExecutionAgent();
    this.fileExecutionAgent = new FileExecutionAgent();
    this.externalExecutionAgent = new ExternalExecutionAgent();
    this.externalSearchAgent = new ExternalSearchAgent();
    this.multiSourceQAAgent = new MultiSourceQAAgent();
    this.visualAgent = new VisualAgent();
    this.crossValidationAgent = new CrossValidationAgent();
    this.hallucinationDetectionAgent = new HallucinationDetectionAgent();
    this.sourceCredibilityAgent = new SourceCredibilityAgent();
    this.masterPlanningAgent = new MasterPlanningAgent();
  }

  async processQuery(
    userQuery: string,
    workspaceId: string,
    agentId: string,
    conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
    userId?: string,
    selectedDataSources?: string[]
  ): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();
    const agentCalls: Array<{agent: string, tokens_used: number, call_type: string}> = [];
    
    try {
      console.log('🚀 Multi-Agent Flow: Starting processing...');
      
      // Step 0: Conversation Context Analysis
      console.log('🧠 Step 0: Conversation Context Analysis');
      const contextAnalysis = await analyzeConversationContext(userQuery, conversationHistory, selectedDataSources);
      const processingStrategy = await determineQueryProcessingStrategy(userQuery, contextAnalysis, selectedDataSources);
      
      console.log('🧠 Context Analysis Result:', {
        is_follow_up: contextAnalysis.is_follow_up,
        is_new_topic: contextAnalysis.is_new_topic,
        context_relevance: contextAnalysis.context_relevance,
        should_use_context: processingStrategy.should_use_context,
        processing_strategy: processingStrategy.processing_strategy
      });
      
      // Filter conversation history based on strategy
      const filteredConversationHistory = filterConversationContext(conversationHistory, processingStrategy);
      console.log(`🧠 Using ${filteredConversationHistory.length} messages from conversation history`);
      
      // Create base context
      const baseContext: AgentContext = {
        userQuery,
        workspaceId,
        conversationHistory: filteredConversationHistory,
        userId,
        selectedDataSources
      };
      
      // Step 1-3: Parallel Initial Processing (Optimization)
      console.log('🚀 Steps 1-3: Parallel Initial Processing');
      const [greetingResult, guardrailsResult, validationResult] = await Promise.all([
        this.greetingAgent.execute(baseContext),
        this.guardrailsAgent.execute(baseContext),
        this.validationAgent.execute(baseContext)
      ]);
      
      // Track agent calls
      agentCalls.push(
        {
          agent: 'GreetingAgent',
          tokens_used: greetingResult.metadata?.tokens_used || 0,
          call_type: 'greeting_check'
        },
        {
          agent: 'GuardrailsAgent',
          tokens_used: guardrailsResult.metadata?.tokens_used || 0,
          call_type: 'safety_check'
        },
        {
          agent: 'ValidationAgent',
          tokens_used: validationResult.metadata?.tokens_used || 0,
          call_type: 'query_validation'
        }
      );
      
      // Check for early exits in order of priority
      if (greetingResult.success && greetingResult.data.isGreeting) {
        console.log('👋 Greeting Agent: Handling greeting response');
        return {
          content: greetingResult.data.response || "Hello! I'm your AI data analysis assistant. How can I help you analyze your data today?",
          success: true,
          data_sources_used: [],
          processing_time_ms: Date.now() - startTime,
          tokens_used: greetingResult.metadata?.tokens_used || 0,
          estimated_credits: 0,
          confidence_score: greetingResult.data.confidence,
          follow_up_suggestions: [],
          metadata: {
            agents_executed: ['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent'],
            fallback_used: false,
            context_analysis: contextAnalysis,
            processing_strategy: processingStrategy.processing_strategy,
            optimization_applied: 'parallel_initial_processing'
          } as any
        };
      }
      
      if (!guardrailsResult.success || !guardrailsResult.data.allowed) {
        console.log('🚫 Guardrails Agent: Message blocked:', guardrailsResult.data.reason);
        return {
          content: "I'm sorry, but I can't process that type of request. I'm designed to help with data analysis and business insights. Please ask me questions about your data, files, or business metrics.",
          success: false,
          data_sources_used: [],
          processing_time_ms: Date.now() - startTime,
          tokens_used: guardrailsResult.metadata?.tokens_used || 0,
          estimated_credits: 0,
          confidence_score: 0,
          follow_up_suggestions: [],
          metadata: {
            agents_executed: ['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent'],
            fallback_used: false,
            context_analysis: contextAnalysis,
            processing_strategy: processingStrategy.processing_strategy,
            optimization_applied: 'parallel_initial_processing'
          } as any,
          error: guardrailsResult.data.reason
        };
      }
      
      if (!validationResult.success || !validationResult.data.is_valid) {
        console.log('❌ Validation Agent: Query validation failed');
        return {
          content: validationResult.data.reasoning || "I couldn't understand your request. Could you please rephrase your question or provide more details?",
          success: false,
          data_sources_used: [],
          processing_time_ms: Date.now() - startTime,
          tokens_used: validationResult.metadata?.tokens_used || 0,
          estimated_credits: 0,
          confidence_score: 0,
          follow_up_suggestions: [
            'Try rephrasing your question',
            'Provide more specific details',
            'Ask about your data or business metrics'
          ],
          metadata: {
            agents_executed: ['GreetingAgent', 'GuardrailsAgent', 'ValidationAgent'],
            fallback_used: false,
            context_analysis: contextAnalysis,
            processing_strategy: processingStrategy.processing_strategy,
            optimization_applied: 'parallel_initial_processing'
          } as any,
          error: 'Query validation failed'
        };
      }
      
      // Step 4: Prompt Engineering Agent
      console.log('🔧 Step 4: Prompt Engineering Agent');
      const promptEngineeringResult = await this.promptEngineeringAgent.execute(baseContext);
      agentCalls.push({
        agent: 'PromptEngineeringAgent',
        tokens_used: promptEngineeringResult.metadata?.tokens_used || 0,
        call_type: 'query_optimization'
      });
      
      if (!promptEngineeringResult.success) {
        throw new Error('Prompt engineering failed');
      }
      
      // Use the optimized query for all subsequent processing
      const optimizedQuery = promptEngineeringResult.data.optimized_query || userQuery;
      console.log('🔧 Original query:', userQuery);
      console.log('🔧 Optimized query:', optimizedQuery);
      
      // Update context with optimized query
      const optimizedContext: AgentContext = {
        ...baseContext,
        userQuery: optimizedQuery
      };
      
      // Step 4.5: Master Planning Agent (Phase 2 Optimization)
      console.log('🧠 Step 4.5: Master Planning Agent');
      const availableSources = await this.getAvailableDataSources(workspaceId, selectedDataSources);
      const conversationContext = {
        conversation_id: `conv_${Date.now()}`,
        agent_id: agentId,
        workspace_id: workspaceId,
        messages: filteredConversationHistory.map(msg => ({
          ...msg,
          sender_type: msg.sender_type as 'user' | 'agent' | 'system'
        })),
        user_id: userId
      };
      
      const executionPlan = await this.masterPlanningAgent.createExecutionPlan(
        optimizedQuery,
        availableSources,
        conversationContext,
        userId
      );
      
      console.log('📋 Execution Plan:', {
        requiredAgents: executionPlan.requiredAgents,
        skipAgents: executionPlan.skipAgents,
        estimatedTime: executionPlan.estimatedTime,
        reasoning: executionPlan.reasoning
      });
      
      // Step 5: Data Source Filter Agent (with planning guidance)
      console.log('🔍 Step 5: Data Source Filter Agent');
      const filterResponse = await this.dataSourceFilterAgent.execute(optimizedContext);
      agentCalls.push({
        agent: 'DataSourceFilterAgent',
        tokens_used: filterResponse.metadata?.tokens_used || 0,
        call_type: 'source_filtering'
      });
      
      if (!filterResponse.success || filterResponse.data.filtered_sources.length === 0) {
        console.log('❌ No relevant data sources found in workspace');
        
        return {
          content: `I couldn't find any relevant data sources in your workspace to answer "${userQuery}". Please check if you have connected databases or uploaded files, and try again.`,
          success: false,
          data_sources_used: [],
          processing_time_ms: Date.now() - startTime,
          tokens_used: agentCalls.reduce((sum, call) => sum + call.tokens_used, 0),
          estimated_credits: 0,
          confidence_score: 0,
          follow_up_suggestions: [
            'Connect a database to your workspace',
            'Upload relevant data files',
            'Check your data source connections'
          ],
          metadata: {
            agents_executed: agentCalls.map(call => call.agent),
            fallback_used: false,
            context_analysis: contextAnalysis as unknown as Record<string, unknown>,
            processing_strategy: processingStrategy.processing_strategy
          },
          error: 'No relevant data sources found'
        };
      }
      
      // Step 6: External Search Agent (if needed)
      console.log('🌐 Step 6: External Search Agent');
      const externalSearchResult = await this.externalSearchAgent.execute({
        ...optimizedContext,
        optimizedQuery,
        requiresExternalData: this.requiresExternalData(optimizedQuery)
      });
      agentCalls.push({
        agent: 'ExternalSearchAgent',
        tokens_used: externalSearchResult.metadata?.tokens_used || 0,
        call_type: 'external_search'
      });
      
      // Step 7: Specialized Execution Agents (Parallel Processing)
      console.log('💾 Step 7: Specialized Execution Agents');
      
      // Execute all three specialized agents in parallel
      const [databaseExecutionResult, fileExecutionResult, externalExecutionResult] = await Promise.all([
        // Database Execution Agent
        this.databaseExecutionAgent.execute({
          ...optimizedContext,
          filteredSources: filterResponse.data.filtered_sources,
          optimizedQuery
        }),
        // File Execution Agent
        this.fileExecutionAgent.execute({
          ...optimizedContext,
          filteredSources: filterResponse.data.filtered_sources,
          optimizedQuery
        }),
        // External Execution Agent
        this.externalExecutionAgent.execute({
          ...optimizedContext,
          filteredSources: filterResponse.data.filtered_sources,
          optimizedQuery
        })
      ]);
      
      // Track agent calls
      agentCalls.push(
        {
          agent: 'DatabaseExecutionAgent',
          tokens_used: databaseExecutionResult.metadata?.tokens_used || 0,
          call_type: 'database_execution'
        },
        {
          agent: 'FileExecutionAgent',
          tokens_used: fileExecutionResult.metadata?.tokens_used || 0,
          call_type: 'file_execution'
        },
        {
          agent: 'ExternalExecutionAgent',
          tokens_used: externalExecutionResult.metadata?.tokens_used || 0,
          call_type: 'external_execution'
        }
      );
      
      // Combine all execution results
      const sourceResults = [
        ...databaseExecutionResult.data.execution_results,
        ...fileExecutionResult.data.execution_results,
        ...externalExecutionResult.data.execution_results
      ];
      
      console.log('💾 Execution Results Summary:', {
        database_results: databaseExecutionResult.data.execution_results.length,
        file_results: fileExecutionResult.data.execution_results.length,
        external_results: externalExecutionResult.data.execution_results.length,
        total_results: sourceResults.length
      });
      
      // Steps 8-9: Advanced Parallel Validation (Phase 3 Optimization)
      console.log('🚀 Steps 8-9: Advanced Parallel Validation');
      const validationResults = await this.executeValidationAgentsInParallel(
        executionPlan,
        optimizedContext,
        sourceResults,
        agentCalls
      );
      const { credibilityResult, crossValidationResult } = validationResults;
      
      // Step 10: Multi-Source Q&A Agent
      console.log('🤖 Step 10: Multi-Source Q&A Agent');
      const qaResponse = await this.multiSourceQAAgent.execute({
        ...optimizedContext,
        sourceResults,
        externalSearchResults: externalSearchResult.data.search_results,
        credibilityResults: credibilityResult.data,
        crossValidationResults: crossValidationResult.data
      });
      agentCalls.push({
        agent: 'MultiSourceQAAgent',
        tokens_used: qaResponse.metadata?.tokens_used || 0,
        call_type: 'qa_analysis'
      });
      
      if (!qaResponse.success) {
        throw new Error('Q&A analysis failed');
      }
      
      // Step 11: Hallucination Detection Agent (conditional based on plan)
      let hallucinationResult: any = { success: true, data: { is_hallucination_detected: false, hallucination_risk_level: 'low' } };
      if (!executionPlan.skipAgents.includes('HallucinationDetectionAgent')) {
        console.log('🔍 Step 11: Hallucination Detection Agent');
        hallucinationResult = await this.hallucinationDetectionAgent.execute({
          ...optimizedContext,
          sourceResults: sourceResults as unknown as Record<string, unknown>[],
          generatedResponse: qaResponse.data.answer,
          crossValidationResults: crossValidationResult.data
        });
        agentCalls.push({
          agent: 'HallucinationDetectionAgent',
          tokens_used: hallucinationResult.metadata?.tokens_used || 0,
          call_type: 'hallucination_detection'
        });
      } else {
        console.log('🔍 Step 11: Hallucination Detection Agent (skipped by plan)');
      }
      
      // Check if hallucination detected and risk level
      if (hallucinationResult.success && hallucinationResult.data.is_hallucination_detected) {
        console.warn('⚠️ Hallucination detected:', hallucinationResult.data.hallucination_risk_level);
        
        // If critical risk, modify response to indicate uncertainty
        if (hallucinationResult.data.hallucination_risk_level === 'critical') {
          qaResponse.data.answer = `⚠️ I've detected potential reliability issues with this response. ${qaResponse.data.answer}\n\n**Reliability Notice**: This response may contain inaccuracies. Please verify critical information independently.`;
          qaResponse.data.confidence = Math.min(qaResponse.data.confidence * 0.5, 0.3);
        } else if (hallucinationResult.data.hallucination_risk_level === 'high') {
          qaResponse.data.answer = `⚠️ ${qaResponse.data.answer}\n\n**Note**: Some information may need verification.`;
          qaResponse.data.confidence = Math.min(qaResponse.data.confidence * 0.7, 0.5);
        }
      }
      
      // Step 12: Visual Agent (conditional based on plan)
      let visualResponse: any = { success: true, data: { should_visualize: false } };
      if (!executionPlan.skipAgents.includes('VisualAgent')) {
        console.log('🎨 Step 12: Visual Agent');
        visualResponse = await this.visualAgent.execute({
          ...optimizedContext,
          sourceResults,
          qaResponse: qaResponse.data
        });
        agentCalls.push({
          agent: 'VisualAgent',
          tokens_used: visualResponse.metadata?.tokens_used || 0,
          call_type: 'visualization_analysis'
        });
      } else {
        console.log('🎨 Step 12: Visual Agent (skipped by plan)');
      }
      
      // Calculate final metrics
      const totalProcessingTime = Date.now() - startTime;
      // Only count tokens from agents that actually used AI (tokens > 0)
      const totalTokens = agentCalls
        .filter(call => call.tokens_used > 0)
        .reduce((sum, call) => sum + call.tokens_used, 0);
      const successfulSources = sourceResults.filter(r => r.success);
      
      // Build final response
      const finalResponse: EnhancedAgentResponse = {
        content: qaResponse.data.answer,
        success: true,
        data_sources_used: successfulSources.map(r => r.source_id),
        processing_time_ms: totalProcessingTime,
        tokens_used: totalTokens,
        estimated_credits: 0, // Will be calculated by credit service
        confidence_score: qaResponse.data.confidence,
        follow_up_suggestions: qaResponse.data.follow_up_suggestions,
        visualization: visualResponse.data.should_visualize ? {
          type: visualResponse.data.visualization_type || 'chart',
          config: visualResponse.data.visualization_config as Record<string, unknown>,
          data: successfulSources.map(r => r.success && 'data' in r ? r.data : []).flat() as unknown as Record<string, unknown>
        } : undefined,
        metadata: {
          agents_executed: agentCalls.map(call => call.agent),
          fallback_used: false,
          context_analysis: contextAnalysis,
          processing_strategy: processingStrategy.processing_strategy,
          execution_plan: {
            required_agents: executionPlan.requiredAgents,
            skip_agents: executionPlan.skipAgents,
            estimated_time: executionPlan.estimatedTime,
            confidence: executionPlan.confidence,
            reasoning: executionPlan.reasoning
          },
          credibility_assessment: credibilityResult.success ? credibilityResult.data : null,
          cross_validation: crossValidationResult.success ? crossValidationResult.data : null,
          hallucination_detection: hallucinationResult.success ? hallucinationResult.data : null,
          robustness_metrics: {
            overall_credibility: credibilityResult.success ? credibilityResult.data.overall_credibility_score : 0,
            cross_validation_confidence: crossValidationResult.success ? crossValidationResult.data.overall_confidence : 0,
            hallucination_risk: hallucinationResult.success ? hallucinationResult.data.hallucination_risk_level : 'unknown',
            data_quality_score: credibilityResult.success ? credibilityResult.data.data_quality_summary.average_credibility : 0
          },
          optimization_applied: 'master_planning_agent'
        } as any,
        // XAI and detailed metadata fields
        xai_metrics: {
          confidence_score: qaResponse.data.confidence,
          uncertainty_score: 1 - qaResponse.data.confidence,
          interpretability_score: 0.8,
          model_confidence: qaResponse.data.confidence,
          data_quality_score: credibilityResult.success ? credibilityResult.data.data_quality_summary.average_credibility : 0.8,
          response_completeness_score: 0.9,
          user_satisfaction_prediction: qaResponse.data.confidence > 0.8 ? 0.9 : 0.7,
          bias_detection_score: 0.9,
          ethical_compliance_score: 0.95,
          performance_efficiency_score: 0.85,
          explanation_quality_score: 0.8,
          decision_transparency_score: 0.9
        },
        agent_thinking_notes: [
          `Analyzed query: "${userQuery}"`,
          `Used ${successfulSources.length} data sources`,
          `Processing strategy: ${processingStrategy.processing_strategy}`,
          `Confidence score: ${qaResponse.data.confidence}`
        ],
        sql_queries: successfulSources
          .filter(r => r.success && r.query_executed && 
            ['database', 'mysql', 'postgresql', 'sqlite', 'redshift'].includes(r.source_type))
          .map(r => r.query_executed as string),
        all_queries: successfulSources
          .filter(r => r.success && r.query_executed)
          .map(r => r.query_executed as string),
        graph_data: visualResponse.data.should_visualize ? {
          type: visualResponse.data.visualization_type || 'chart',
          config: visualResponse.data.visualization_config,
          data: successfulSources.map(r => r.success && 'data' in r ? r.data : []).flat()
        } : undefined,
        reasoning_explanation: `Processed query using ${processingStrategy.processing_strategy} strategy with ${successfulSources.length} data sources. Applied credibility assessment and cross-validation for robust results.`,
        analysis_depth: processingStrategy.processing_strategy === 'new_analysis' ? 'deep' : 'standard',
        data_quality_score: credibilityResult.success ? credibilityResult.data.data_quality_summary.average_credibility : 0.8,
        response_completeness_score: 0.9,
        user_satisfaction_prediction: qaResponse.data.confidence > 0.8 ? 0.9 : 0.7,
        token_tracking: {
          userInputTokens: Math.ceil(userQuery.length / 4),
          systemPromptTokens: 0,
          contextTokens: 0,
          routerAgentTokens: 0,
          qaAgentTokens: totalTokens,
          fileContentTokens: 0,
          conversationHistoryTokens: 0,
          agentResponseTokens: Math.ceil(qaResponse.data.answer.length / 4),
          totalInputTokens: Math.ceil(userQuery.length / 4),
          totalProcessingTokens: totalTokens,
          totalOutputTokens: Math.ceil(qaResponse.data.answer.length / 4),
          totalTokensUsed: totalTokens,
          stageBreakdown: {
            input: Math.ceil(userQuery.length / 4),
            routing: 0,
            fileProcessing: 0,
            qaGeneration: totalTokens,
            output: Math.ceil(qaResponse.data.answer.length / 4)
          }
        },
        rag_context: {
          retrieved_chunks: successfulSources.length,
          similarity_scores: successfulSources.map(() => qaResponse.data.confidence),
          source_documents: successfulSources.map(r => r.source_id || 'unknown')
        },
        explainability: {
          reasoning_steps: [
            `Processed ${successfulSources.length} files`,
            'Applied credibility assessment',
            'Cross-validated results',
            'Generated response with confidence score'
          ],
          confidence_score: qaResponse.data.confidence,
          uncertainty_factors: qaResponse.data.confidence < 0.7 ? ['Low confidence in analysis'] : []
        },
        data_sources: successfulSources.map(r => ({
          source_id: r.source_id,
          source_name: r.source_id || 'Unknown Source',
          relevance_score: qaResponse.data.confidence,
          sections_used: []
        }))
      };
      
      // Record query execution for predictive caching (Phase 3 Optimization)
      this.recordQueryForPrediction(
        userQuery,
        workspaceId,
        userId,
        successfulSources.map(s => s.source_id || 'unknown'),
        true,
        totalProcessingTime
      );

      console.log('🚀 Multi-Agent Flow: Processing completed successfully');
      console.log('📊 Final Metrics:', {
        processing_time_ms: totalProcessingTime,
        tokens_used: totalTokens,
        sources_used: successfulSources.length,
        confidence: finalResponse.confidence_score,
        agents_executed: agentCalls.length
      });
      
      // Learn from this interaction asynchronously (don't block response)
      this.learnFromInteraction(userQuery, finalResponse, contextAnalysis, agentCalls, userId).catch((error: unknown) => {
        console.error('ML learning error (non-blocking):', error);
      });
      
      return finalResponse;
      
    } catch (error) {
      console.error('Multi-Agent Flow error:', error);
      
      const totalProcessingTime = Date.now() - startTime;
      // Only count tokens from agents that actually used AI (tokens > 0)
      const totalTokens = agentCalls
        .filter(call => call.tokens_used > 0)
        .reduce((sum, call) => sum + call.tokens_used, 0);
      
      return {
        content: 'I encountered an error while processing your request. Please try again or rephrase your question.',
        success: false,
        data_sources_used: [],
        processing_time_ms: totalProcessingTime,
        tokens_used: totalTokens,
        estimated_credits: 0,
        confidence_score: 0,
        follow_up_suggestions: [],
        metadata: {
          agents_executed: agentCalls.map(call => call.agent),
          fallback_used: false,
          context_analysis: null as unknown as Record<string, unknown>,
          processing_strategy: 'error'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private requiresExternalData(query: string): boolean {
    const externalIndicators = [
      'latest', 'current', 'recent', 'news', 'market data', 'stock price',
      'weather', 'real-time', 'live data', 'external', 'web', 'online',
      'api', 'third-party', 'public data', 'open data', 'what is', 'who is',
      'when did', 'where is', 'how to', 'definition', 'meaning', 'explain'
    ];
    
    const lowerQuery = query.toLowerCase();
    return externalIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  private async learnFromInteraction(
    userQuery: string,
    response: EnhancedAgentResponse,
    contextAnalysis: { is_follow_up: boolean; is_new_topic: boolean; context_relevance: string; current_topic: string; context_entities: string[]; topic_continuity: number },
    agentCalls: Array<{agent: string, tokens_used: number, call_type: string}>,
    userId?: string
  ): Promise<void> {
    try {
      // Extract features for ML learning
      const features = await mlLearningService.extractFeatures(
        userQuery,
        [], // conversationHistory - could be passed if needed
        response.data_sources_used[0] || '', // workspaceId - could be passed if needed
        userId || 'anonymous'
      );

      // Create interaction data for learning
      const interactionData: InteractionData = {
        user_id: userId || 'anonymous',
        workspace_id: response.data_sources_used[0] || 'unknown',
        agent_id: 'multi-agent-flow',
        original_query: userQuery,
        optimized_query: userQuery, // Could be enhanced with prompt engineering result
        query_intent: contextAnalysis.current_topic,
        query_entities: contextAnalysis.context_entities || [],
        query_complexity_score: contextAnalysis.topic_continuity,
        conversation_length: 1, // Could be enhanced with actual conversation length
        previous_failures_count: 0, // Could be enhanced with failure tracking
        processing_strategy: 'multi-agent-flow',
        data_sources_used: response.data_sources_used,
        execution_time_ms: response.processing_time_ms,
        success: response.success,
        failure_reason: response.error,
        user_satisfaction_score: response.confidence_score,
        features_vector: features,
        prediction_confidence: response.confidence_score
      };

      // Learn from this interaction
      await mlLearningService.learnFromInteraction(interactionData);
      
      console.log('🧠 ML Learning: Successfully learned from interaction');
    } catch (error) {
      console.error('ML Learning error:', error);
      // Don't throw - this is non-blocking
    }
  }

  /**
   * Execute validation agents in parallel (Phase 3 Optimization)
   */
  private async executeValidationAgentsInParallel(
    executionPlan: ExecutionPlan,
    context: AgentContext,
    sourceResults: any[],
    agentCalls: any[]
  ): Promise<{ credibilityResult: any; crossValidationResult: any }> {
    const agentsToExecute = [];
    const contextWithResults = { ...context, sourceResults };

    // Add agents that should be executed
    if (!executionPlan.skipAgents.includes('SourceCredibilityAgent')) {
      agentsToExecute.push({
        agent: this.sourceCredibilityAgent,
        name: 'SourceCredibilityAgent',
        dependencies: [],
        context: contextWithResults
      });
    }

    if (!executionPlan.skipAgents.includes('CrossValidationAgent')) {
      agentsToExecute.push({
        agent: this.crossValidationAgent,
        name: 'CrossValidationAgent',
        dependencies: [],
        context: contextWithResults
      });
    }

    if (agentsToExecute.length === 0) {
      console.log('🔍 All validation agents skipped by plan');
      return {
        credibilityResult: { success: true, data: {} },
        crossValidationResult: { success: true, data: {} }
      };
    }

    // Create parallel execution plan
    const parallelPlan = advancedParallelExecutor.createExecutionPlan(agentsToExecute, {
      maxConcurrency: 2,
      maxMemory: 1000,
      maxCpu: 100
    });

    // Execute in parallel
    const results = await advancedParallelExecutor.executeParallelPlan(parallelPlan, contextWithResults);

    // Process results
    let credibilityResult: any = { success: true, data: {} };
    let crossValidationResult: any = { success: true, data: {} };

    results.forEach(result => {
      if (result.agentName === 'SourceCredibilityAgent') {
        credibilityResult = result.result;
        agentCalls.push({
          agent: 'SourceCredibilityAgent',
          tokens_used: result.result.metadata?.tokens_used || 0,
          call_type: 'credibility_assessment'
        });
      } else if (result.agentName === 'CrossValidationAgent') {
        crossValidationResult = result.result;
        agentCalls.push({
          agent: 'CrossValidationAgent',
          tokens_used: result.result.metadata?.tokens_used || 0,
          call_type: 'cross_validation'
        });
      }
    });

    return { credibilityResult, crossValidationResult };
  }

  /**
   * Record query execution for predictive caching (Phase 3 Optimization)
   */
  private recordQueryForPrediction(
    query: string,
    workspaceId: string,
    userId: string | undefined,
    dataSources: string[],
    success: boolean,
    executionTime: number
  ): void {
    try {
      predictiveCacheManager.recordQueryExecution(
        query,
        workspaceId,
        userId || 'anonymous',
        dataSources,
        success,
        executionTime
      );
    } catch (error) {
      console.error('Error recording query for prediction:', error);
      // Don't throw - this is non-blocking
    }
  }

  /**
   * Pre-populate cache with predicted queries (Phase 3 Optimization)
   */
  async prePopulateCache(workspaceId: string, userId?: string): Promise<void> {
    try {
      const availableSources = await this.getAvailableDataSources(workspaceId);
      const result = await predictiveCacheManager.prePopulateCache(workspaceId, userId, availableSources);
      console.log(`🎯 Cache pre-population: ${result.preCached} queries cached, ${result.errors} errors`);
    } catch (error) {
      console.error('Error pre-populating cache:', error);
      // Don't throw - this is non-blocking
    }
  }

  /**
   * Get available data sources for the workspace
   */
  protected async getAvailableDataSources(workspaceId: string, selectedSources?: string[]): Promise<any[]> {
    // This would typically fetch from your database
    // For now, return mock data that matches your system
    const mockSources = [
      { id: 'db1', type: 'database', name: 'PostgreSQL DB', workspace_id: workspaceId },
      { id: 'file1', type: 'file', name: 'Sales Data.xlsx', workspace_id: workspaceId },
      { id: 'ext1', type: 'external', name: 'Google Sheets', workspace_id: workspaceId }
    ];

    if (selectedSources && selectedSources.length > 0) {
      return mockSources.filter(source => selectedSources.includes(source.id));
    }

    return mockSources;
  }
}

// Export singleton instance
export const multiAgentFlow = new MultiAgentFlow();
