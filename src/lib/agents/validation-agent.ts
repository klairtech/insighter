/**
 * Validation Agent
 * 
 * Handles query validation, intent classification, and relevance checking
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { AgentUtils } from './AgentUtils';

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
      
      // If lightweight validation is confident, use it; otherwise use AI
      let validationResult;
      let aiTokensUsed = 0;
      
      if (lightweightResult.confidence >= 0.8) {
        console.log('🔍 Using lightweight validation result');
        validationResult = lightweightResult;
      } else {
        console.log('🔍 Using AI validation for complex query');
        const aiResult = await this.performAIValidation(userQuery, conversationHistory);
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
      const fallbackData = AgentUtils.getDefaultFallbackData('ValidationAgent');
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

  private async performAIValidation(userQuery: string, conversationHistory: Array<{sender_type: string, content: string, created_at: string}>): Promise<ValidationAgentResponse & { tokensUsed: number }> {
    const recentConversation = AgentUtils.getRecentConversationContext(conversationHistory, 3);
    
    const validationPrompt = `You are a Query Validation Agent for a data analysis AI assistant. Your job is to validate user queries and classify their intent.

CONTEXT: This is a data analysis AI assistant that helps users analyze business data, create charts, run SQL queries, and generate insights.

USER QUERY: "${userQuery}"

RECENT CONVERSATION:
${recentConversation || 'No previous conversation'}

VALIDATION RULES:
1. **Valid Queries**: Data analysis requests, business questions, chart requests, SQL queries, insights
2. **Invalid Queries**: Abusive content, completely irrelevant topics, nonsensical text
3. **Ambiguous Queries**: Vague requests that need clarification
4. **Continuation Queries**: Follow-up questions that build on previous context

QUERY TYPES:
- "greeting": Social greetings and small talk
- "data_query": Requests for data analysis, insights, reports, metrics
- "abusive": Inappropriate, offensive, or harmful content
- "irrelevant": Topics completely unrelated to data analysis
- "ambiguous": Vague or unclear requests needing clarification
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
  "reasoning": "Clear data analysis request with specific metrics and time period"
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
            query_type: type as any,
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
}
