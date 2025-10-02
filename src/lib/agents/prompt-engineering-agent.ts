/**
 * Prompt Engineering Agent
 * 
 * Optimizes user queries for better AI processing and data analysis
 */

import { BaseAgent, AgentContext, AgentResponse, PromptEngineeringResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export class PromptEngineeringAgent implements BaseAgent {
  name = 'Prompt Engineering Agent';
  description = 'Optimizes user queries for better AI processing and data analysis';

  async execute(context: AgentContext): Promise<AgentResponse<PromptEngineeringResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔧 Prompt Engineering Agent: Optimizing query...');
      
      const { userQuery, conversationHistory } = context;
      
      // Get recent conversation context
      const recentConversation = conversationHistory
        .slice(-4)
        .map(msg => `${msg.sender_type}: ${msg.content}`)
        .join('\n');

      const promptEngineeringPrompt = `You are a Prompt Engineering Agent that optimizes user queries for data analysis.

ORIGINAL QUERY: "${userQuery}"

${recentConversation ? `CONVERSATION CONTEXT:\n${recentConversation}\n` : ''}

Your task is to:
1. **Optimize the query** for better AI understanding and data processing
2. **Analyze the intent** and categorize the query type
3. **Extract entities** and requirements
4. **Identify time references** and data needs
5. **Improve clarity** while preserving the original intent

OPTIMIZATION GUIDELINES:
- Make queries more specific and actionable
- Clarify ambiguous terms
- Add context where helpful
- Preserve the user's original intent
- Make queries more database-friendly

QUERY TYPES:
- analytical: "How many...", "What is the...", "Calculate..."
- exploratory: "Show me...", "Find...", "Discover..."
- comparative: "Compare...", "vs", "difference between..."
- temporal: "over time", "trends", "last 7 days"
- aggregation: "total", "sum", "average", "count"

Respond with JSON:
{
  "optimized_query": "Improved version of the query",
  "query_type": "analytical/exploratory/comparative/temporal/aggregation",
  "intent_analysis": {
    "primary_intent": "Main goal of the query",
    "secondary_intents": ["Additional goals"],
    "entities": ["Key entities mentioned"],
    "time_references": ["Time-related terms"],
    "data_requirements": ["What data is needed"]
  },
  "optimization_notes": "What was changed and why",
  "confidence": 0.0-1.0
}`;

      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a prompt engineering specialist. Optimize queries for better data analysis. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: promptEngineeringPrompt
        }
      ], {
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      
      // Validate and enhance the result
      const optimizedResult: PromptEngineeringResponse = {
        optimized_query: result.optimized_query || userQuery,
        query_type: result.query_type || 'analytical',
        intent_analysis: {
          primary_intent: result.intent_analysis?.primary_intent || 'Data analysis',
          secondary_intents: result.intent_analysis?.secondary_intents || [],
          entities: result.intent_analysis?.entities || [],
          time_references: result.intent_analysis?.time_references || [],
          data_requirements: result.intent_analysis?.data_requirements || []
        },
        optimization_notes: result.optimization_notes || 'Query processed',
        confidence: result.confidence || 0.8
      };

      const processingTime = Date.now() - startTime;
      
      console.log('🔧 Prompt Engineering Result:', {
        original: userQuery,
        optimized: optimizedResult.optimized_query,
        type: optimizedResult.query_type,
        confidence: optimizedResult.confidence
      });

      return {
        success: true,
        data: optimizedResult,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: response.tokens_used || 0,
          confidence_score: optimizedResult.confidence
        }
      };

    } catch (error) {
      console.error('Prompt Engineering Agent error:', error);
      
      // Fallback: Return original query with basic analysis
      return {
        success: true,
        data: {
          optimized_query: context.userQuery,
          query_type: 'analytical',
          intent_analysis: {
            primary_intent: 'Data analysis',
            secondary_intents: [],
            entities: [],
            time_references: [],
            data_requirements: []
          },
          optimization_notes: 'Fallback processing due to error',
          confidence: 0.5
        },
        metadata: {
          processing_time_ms: Date.now() - startTime,
          tokens_used: 0,
          confidence_score: 0.5
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
