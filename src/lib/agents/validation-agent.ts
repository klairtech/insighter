/**
 * Validation Agent
 * 
 * Handles query validation, intent classification, and relevance checking
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { AgentUtils } from './AgentUtils';
import { supabase } from '../supabase-auth';

export interface ValidationAgentResponse {
  is_valid: boolean;
  query_type: 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation' | 'clarification';
  confidence: number;
  intent_analysis: {
    primary_intent: string;
    secondary_intents: string[];
    entities: string[];
    time_references: string[];
    data_requirements: string[];
  };
  requires_follow_up?: boolean;
  follow_up_context?: string;
  reasoning?: string;
}

export class ValidationAgent implements BaseAgent {
  name = 'Validation Agent';
  description = 'Handles query validation, intent classification, and relevance checking';

  async execute(context: AgentContext): Promise<AgentResponse<ValidationAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Validation Agent: Validating query and classifying intent...');
      
      const { userQuery, conversationHistory } = context;
      
      // First, perform lightweight validation using pattern matching
      const lightweightResult = this.performLightweightValidation(userQuery);
      
      // Always use AI validation for context-aware decision making
      // Lightweight validation is only used for obvious cases like greetings
      let validationResult;
      let aiTokensUsed = 0;
      
      if (lightweightResult.query_type === 'greeting' && lightweightResult.confidence >= 0.9) {
        console.log('🔍 Using lightweight validation for greeting');
        validationResult = lightweightResult;
      } else {
        console.log('🔍 Using AI validation for context-aware analysis');
        // Get data source summaries for better validation
        const dataSourceSummaries = await this.getDataSourceSummaries(context.workspaceId);
        const aiResult = await this.performAIValidation(userQuery, conversationHistory, context.contextAnalysis, dataSourceSummaries);
        validationResult = aiResult;
        aiTokensUsed = aiResult.tokensUsed;
      }
      
      const result: ValidationAgentResponse = {
        is_valid: validationResult.is_valid,
        query_type: validationResult.query_type,
        confidence: validationResult.confidence,
        intent_analysis: validationResult.intent_analysis,
        requires_follow_up: validationResult.requires_follow_up,
        follow_up_context: validationResult.follow_up_context,
        reasoning: validationResult.reasoning
      };
      
      const _processingTime = Date.now() - startTime;
      
      console.log('🔍 Validation Agent Result:', {
        is_valid: result.is_valid,
        query_type: result.query_type,
        confidence: result.confidence,
        primary_intent: result.intent_analysis.primary_intent
      });
      
      return AgentUtils.createSuccessResponse(
        result,
        startTime,
        aiTokensUsed,
        result.confidence
      );
      
    } catch (error) {
      const fallbackData = AgentUtils.getDefaultFallbackData('ValidationAgent') as unknown as ValidationAgentResponse;
      return AgentUtils.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        startTime,
        fallbackData,
        0,
        0.5,
        'Validation Agent'
      );
    }
  }

  private async performAIValidation(userQuery: string, conversationHistory: Array<{sender_type: string, content: string, created_at: string}>, contextAnalysis?: any, dataSourceSummaries?: any[]): Promise<ValidationAgentResponse & { tokensUsed: number }> {
    const recentConversation = AgentUtils.getRecentConversationContext(conversationHistory, 5);
    
    // Create AI summary from context analysis if available
    const aiContextSummary = contextAnalysis ? `
AI CONTEXT ANALYSIS:
- Previous Topic: ${contextAnalysis.previous_topic || 'None'}
- Current Topic: ${contextAnalysis.current_topic || userQuery}
- Context Relevance: ${contextAnalysis.context_relevance || 'Unknown'}
- Context Entities: ${contextAnalysis.context_entities?.join(', ') || 'None'}
- Topic Continuity: ${contextAnalysis.topic_continuity || 0}
- Reasoning: ${contextAnalysis.reasoning || 'No reasoning provided'}
- Is Follow-up: ${contextAnalysis.is_follow_up || false}
- Is New Topic: ${contextAnalysis.is_new_topic || false}
` : '';

    // Create data source summaries if available
    const dataSourceSummary = dataSourceSummaries && dataSourceSummaries.length > 0 ? `
AVAILABLE DATA SOURCES:
${dataSourceSummaries.map(source => `
- ${source.name} (${source.type}): ${source.ai_summary || 'No summary available'}
  Key Points: ${source.key_points?.join(', ') || 'None'}
  Tags: ${source.tags?.join(', ') || 'None'}
  Question Types: ${source.agent_definition?.question_types?.join(', ') || 'None'}
  Use Cases: ${source.agent_definition?.use_cases?.join(', ') || 'None'}
  Key Entities: ${source.agent_definition?.key_entities?.join(', ') || 'None'}
  Key Topics: ${source.agent_definition?.key_topics?.join(', ') || 'None'}
`).join('\n')}
` : '';
    
    const validationPrompt = `You are a Query Validation Agent for a data analysis AI assistant. Your job is to validate user queries and classify their intent using conversation context and AI reasoning.

CONTEXT: This is a data analysis AI assistant that helps users analyze business data, create charts, run SQL queries, generate insights, and analyze documents/reports.

USER QUERY: "${userQuery}"

RECENT CONVERSATION:
${recentConversation || 'No previous conversation'}

${aiContextSummary}

${dataSourceSummary}

VALIDATION APPROACH:
Use AI reasoning to understand the user's intent based on:
1. **AI Context Analysis**: Use the provided AI context analysis to understand conversation flow, topics, and entities
2. **Data Source Analysis**: Use the available data source summaries to understand what types of questions can be answered
3. **Conversation Context**: What has been discussed previously - look for references to documents, visits, meetings, reports, data sources
4. **Query Intent**: What the user is trying to achieve - even if the query seems vague, use context to understand
5. **Data Requirements**: What type of information they need - consider both structured data and document analysis
6. **Context Clues**: References like "our visit", "the meeting", "findings", "summary", "report" should be understood from conversation context
7. **Business Context**: This assistant handles business data analysis, so queries about business activities, meetings, visits, reports are valid
8. **Topic Continuity**: Use the topic continuity score and context entities to understand if this is a follow-up or new topic
9. **Data Source Matching**: Check if the query matches any of the available data sources' question types, use cases, or key topics

VALIDATION RULES:
1. **Valid Queries**: Any request that can be answered using available data sources, documents, or business context
2. **Invalid Queries**: Abusive content, completely irrelevant topics, nonsensical text
3. **Ambiguous Queries**: Only truly vague requests that cannot be understood even with context
4. **Context-Aware**: Consider conversation history to understand references like "our visit", "the meeting", "findings", etc.

QUERY TYPES:
- "greeting": Social greetings and small talk
- "data_query": Any request for information, analysis, insights, reports, document analysis, meeting summaries, visit findings, etc.
- "abusive": Inappropriate, offensive, or harmful content
- "irrelevant": Topics completely unrelated to data analysis or business context
- "ambiguous": Only truly vague requests that cannot be understood even with conversation context
- "closing": Farewells and conversation endings
- "continuation": Follow-up questions building on previous context
- "clarification": Responses to previous clarification requests

INTENT ANALYSIS:
- Extract primary intent (what the user wants to achieve)
- Identify secondary intents (additional goals)
- Extract entities (people, places, things, metrics)
- Find time references (dates, periods, time ranges)
- Determine data requirements (what data is needed)

Respond with JSON:
{
  "is_valid": true/false,
  "query_type": "data_query",
  "confidence": 0.0-1.0,
  "intent_analysis": {
    "primary_intent": "Analyze sales performance",
    "secondary_intents": ["Compare with previous period", "Identify trends"],
    "entities": ["sales", "performance", "revenue"],
    "time_references": ["last quarter", "Q3 2024"],
    "data_requirements": ["sales data", "revenue metrics", "time series data"]
  },
  "requires_follow_up": false,
  "follow_up_context": null,
  "reasoning": "Use conversation context and AI reasoning to explain why this query is valid or invalid. Consider references to previous discussions, documents, visits, meetings, etc."
}`;

    try {
      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a query validation expert for a data analysis AI assistant. Validate queries and classify intent. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: validationPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      
      return {
        is_valid: result.is_valid !== false, // Default to true if not specified
        query_type: result.query_type || 'data_query',
        confidence: result.confidence || 0.7,
        intent_analysis: result.intent_analysis || {
          primary_intent: 'Data analysis',
          secondary_intents: [],
          entities: [],
          time_references: [],
          data_requirements: []
        },
        requires_follow_up: result.requires_follow_up || false,
        follow_up_context: result.follow_up_context,
        reasoning: result.reasoning,
        tokensUsed: response.tokens_used
      };
    } catch (error) {
      console.warn('AI validation failed, using fallback:', error);
      return {
        is_valid: true,
        query_type: 'data_query',
        confidence: 0.5,
        intent_analysis: {
          primary_intent: 'Data analysis',
          secondary_intents: [],
          entities: [],
          time_references: [],
          data_requirements: []
        },
        requires_follow_up: false,
        reasoning: 'AI validation failed, defaulting to valid data query',
        tokensUsed: 0
      };
    }
  }

  private performLightweightValidation(query: string): ValidationAgentResponse {
    const lowerQuery = query.toLowerCase().trim();
    
    // Define validation patterns
    const validationPatterns = {
      data_query: [
        /^(show|display|find|get|list|analyze|compare|calculate)/i,
        /^(what is|how many|how much|which|where|when)/i,
        /^(top|bottom|highest|lowest|best|worst)/i,
        /(revenue|sales|performance|metrics|data|chart|graph)/i
      ],
      greeting: [
        /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
        /^(how are you|what's up|how's it going)/i
      ],
      abusive: [
        /(stupid|idiot|dumb|hate|kill|die)/i,
        /(fuck|shit|damn|hell)/i
      ],
      irrelevant: [
        /^(tell me a joke|what's the weather|play music)/i,
        /^(cook|recipe|travel|sports|politics)/i
      ],
      ambiguous: [
        /^(help|assist|support)/i,
        /^(what can you do|how do you work)/i
      ]
    };
    
    // Check for obvious patterns
    for (const [type, patterns] of Object.entries(validationPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuery)) {
          const isDataQuery = type === 'data_query';
          return {
            is_valid: isDataQuery || type === 'greeting' || type === 'ambiguous',
            query_type: type as 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation' | 'clarification',
            confidence: 0.9,
            intent_analysis: {
              primary_intent: isDataQuery ? 'Data analysis' : type,
              secondary_intents: [],
              entities: this.extractSimpleEntities(query),
              time_references: this.extractTimeReferences(query),
              data_requirements: isDataQuery ? ['data_source'] : []
            },
            requires_follow_up: type === 'ambiguous',
            reasoning: `Lightweight validation detected ${type} pattern`
          };
        }
      }
    }
    
    // Check query length and complexity
    if (lowerQuery.length < 5) {
      return {
        is_valid: false,
        query_type: 'ambiguous',
        confidence: 0.8,
        intent_analysis: {
          primary_intent: 'Unclear',
          secondary_intents: [],
          entities: [],
          time_references: [],
          data_requirements: []
        },
        requires_follow_up: true,
        reasoning: 'Query too short to understand'
      };
    }
    
    // Default to data query for medium-length queries
    if (lowerQuery.length > 10) {
      return {
        is_valid: true,
        query_type: 'data_query',
        confidence: 0.7,
        intent_analysis: {
          primary_intent: 'Data analysis',
          secondary_intents: [],
          entities: this.extractSimpleEntities(query),
          time_references: this.extractTimeReferences(query),
          data_requirements: ['data_source']
        },
        requires_follow_up: false,
        reasoning: 'Default classification as data query'
      };
    }
    
    // Fallback for short queries
    return {
      is_valid: true,
      query_type: 'ambiguous',
      confidence: 0.6,
      intent_analysis: {
        primary_intent: 'Unclear',
        secondary_intents: [],
        entities: [],
        time_references: [],
        data_requirements: []
      },
      requires_follow_up: true,
      reasoning: 'Query requires clarification'
    };
  }

  private extractSimpleEntities(query: string): string[] {
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Simple entity extraction
    const entityPatterns = [
      /\b(sales|revenue|profit|cost|price)\b/g,
      /\b(customer|user|client|employee)\b/g,
      /\b(product|item|service)\b/g,
      /\b(month|year|quarter|week|day)\b/g
    ];
    
    for (const pattern of entityPatterns) {
      const matches = lowerQuery.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  private extractTimeReferences(query: string): string[] {
    const timeRefs: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    const timePatterns = [
      /\b(last|previous|past)\s+(month|year|quarter|week|day)\b/g,
      /\b(this|current)\s+(month|year|quarter|week|day)\b/g,
      /\b(2024|2023|2022|2021|2020)\b/g,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g
    ];
    
    for (const pattern of timePatterns) {
      const matches = lowerQuery.match(pattern);
      if (matches) {
        timeRefs.push(...matches);
      }
    }
    
    return [...new Set(timeRefs)]; // Remove duplicates
  }

  private async getDataSourceSummaries(workspaceId: string): Promise<any[]> {
    try {
      // Get database connections
      const { data: databaseConnections } = await supabase
        .from('database_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);
      
      // Get file uploads
      const { data: fileUploads } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('processing_status', 'completed');
      
      // Get file summaries
      const fileIds = fileUploads?.map((f: Record<string, unknown>) => f.id) || [];
      const { data: fileSummaries } = await supabase
        .from('file_summaries')
        .select('*')
        .in('file_id', fileIds);
      
      // Get external connections
      const { data: externalConnections } = await supabase
        .from('external_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);
      
      // Combine and format data sources
      const dataSources = [];
      
      // Add database sources
      if (databaseConnections) {
        for (const db of databaseConnections) {
          dataSources.push({
            id: db.id,
            name: db.connection_name || `Database ${db.id}`,
            type: 'database',
            connection_type: db.database_type,
            ai_summary: `Database connection: ${db.connection_name || db.database_type}`,
            key_points: [`Database type: ${db.database_type}`, `Connection: ${db.connection_name}`],
            tags: ['database', db.database_type],
            agent_definition: {
              question_types: ['data_analysis', 'sql_queries', 'database_insights'],
              use_cases: ['business_intelligence', 'data_analysis', 'reporting'],
              key_entities: [],
              key_topics: ['data', 'database', 'analysis']
            }
          });
        }
      }
      
      // Add file sources
      if (fileUploads && fileSummaries) {
        for (const file of fileUploads) {
          const summary = fileSummaries.find((s: Record<string, unknown>) => s.file_id === file.id);
          if (summary) {
            dataSources.push({
              id: file.id,
              name: file.original_name || `File ${file.id}`,
              type: 'file',
              connection_type: file.file_type,
              ai_summary: summary.summary || summary.summary_encrypted,
              key_points: summary.key_points || summary.key_points_encrypted,
              tags: summary.tags || summary.tags_encrypted,
              agent_definition: summary.agent_definition || {
                question_types: ['document_analysis', 'content_summary'],
                use_cases: ['document_review', 'content_analysis'],
                key_entities: [],
                key_topics: ['document', 'content']
              }
            });
          }
        }
      }
      
      // Add external sources
      if (externalConnections) {
        for (const ext of externalConnections) {
          dataSources.push({
            id: ext.id,
            name: ext.connection_name || `External ${ext.id}`,
            type: 'external',
            connection_type: ext.connection_type,
            ai_summary: `External connection: ${ext.connection_name || ext.connection_type}`,
            key_points: [`Connection type: ${ext.connection_type}`, `Name: ${ext.connection_name}`],
            tags: ['external', ext.connection_type],
            agent_definition: {
              question_types: ['external_data', 'api_queries'],
              use_cases: ['data_integration', 'external_analysis'],
              key_entities: [],
              key_topics: ['external', 'api', 'integration']
            }
          });
        }
      }
      
      return dataSources;
    } catch (error) {
      console.error('Error getting data source summaries:', error);
      return [];
    }
  }
}
