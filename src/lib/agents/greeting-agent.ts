/**
 * Greeting Agent
 * 
 * Handles greetings, small talk, and conversational responses
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export interface GreetingAgentResponse {
  isGreeting: boolean;
  response?: string;
  greetingType?: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none';
  confidence: number;
  reasoning?: string;
}

export class GreetingAgent implements BaseAgent {
  name = 'Greeting Agent';
  description = 'Handles greetings, small talk, and conversational responses';

  async execute(context: AgentContext): Promise<AgentResponse<GreetingAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('👋 Greeting Agent: Analyzing message for greetings...');
      
      const { userQuery, conversationHistory } = context;
      
      // Check for greeting patterns using pattern matching first
      const greetingAnalysis = this.analyzeGreetingPatterns(userQuery);
      
      // If pattern matching suggests it's a greeting, use AI for final confirmation
      let finalAnalysis = greetingAnalysis;
      let aiTokensUsed = 0;
      if (greetingAnalysis.isGreeting) {
        const aiResult = await this.performAIGreetingAnalysis(userQuery, conversationHistory);
        finalAnalysis = aiResult.analysis;
        aiTokensUsed = aiResult.tokensUsed;
      }
      
      const result: GreetingAgentResponse = {
        isGreeting: finalAnalysis.isGreeting,
        response: finalAnalysis.isGreeting && finalAnalysis.greetingType && finalAnalysis.greetingType !== 'none' ? this.generateGreetingResponse(finalAnalysis.greetingType) : undefined,
        greetingType: finalAnalysis.greetingType,
        confidence: finalAnalysis.confidence,
        reasoning: finalAnalysis.reasoning || undefined
      };
      
      const processingTime = Date.now() - startTime;
      
      console.log('👋 Greeting Agent Result:', {
        isGreeting: result.isGreeting,
        greetingType: result.greetingType,
        confidence: result.confidence
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: aiTokensUsed,
          confidence_score: result.confidence
        }
      };
      
    } catch (error) {
      console.error('Greeting Agent error:', error);
      
      return {
        success: true,
        data: {
          isGreeting: false,
          confidence: 0.3,
          reasoning: 'Error occurred during greeting analysis'
        },
        metadata: {
          processing_time_ms: Date.now() - startTime,
          tokens_used: 0,
          confidence_score: 0.3
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private analyzeGreetingPatterns(userQuery: string): { isGreeting: boolean; greetingType?: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none'; confidence: number; reasoning?: string } {
    const lowerMessage = userQuery.toLowerCase().trim();
    
    // Check for greeting patterns
    const greetingPatterns = {
      hello: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'],
      goodbye: ['bye', 'goodbye', 'see you', 'farewell', 'take care', 'have a good day'],
      thanks: ['thank you', 'thanks', 'appreciate', 'grateful', 'much obliged'],
      small_talk: ['how are you', 'how do you do', 'what\'s up', 'how\'s it going', 'nice to meet you']
    };
    
    // Check for greeting types using pattern matching first
    let greetingType: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none' = 'none';
    let confidence = 0;
    
    for (const [type, patterns] of Object.entries(greetingPatterns)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          greetingType = type as 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none';
          confidence = 0.8;
          break;
        }
      }
      if (greetingType !== 'none') break;
    }
    
    // Safety check: If the message contains data analysis keywords, force it to be 'none'
    const dataAnalysisKeywords = [
      'analyze', 'show', 'display', 'find', 'get', 'list', 'top', 'bottom', 'highest', 'lowest',
      'revenue', 'sales', 'performance', 'metrics', 'trends', 'reports', 'attendance', 'districts',
      'students', 'percentage', 'statistics', 'chart', 'graph', 'plot', 'visualize', 'data',
      'sql', 'query', 'table', 'database', 'insights', 'business', 'compare', 'rank'
    ];
    
    const hasDataKeywords = dataAnalysisKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (hasDataKeywords) {
      return { isGreeting: false, greetingType: 'none', confidence: 0.9, reasoning: 'Contains data analysis keywords' };
    }
    
    return { 
      isGreeting: greetingType !== 'none', 
      greetingType: greetingType === 'none' ? undefined : greetingType, 
      confidence,
      reasoning: greetingType !== 'none' ? `Detected ${greetingType} pattern` : 'No greeting pattern detected'
    };
  }

  private async performAIGreetingAnalysis(userQuery: string, conversationHistory: Array<{sender_type: string, content: string, created_at: string}>): Promise<{ analysis: { isGreeting: boolean; greetingType?: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none'; confidence: number; reasoning?: string }; tokensUsed: number }> {
    const greetingPrompt = `You are an intelligent conversation classifier for a data analysis AI assistant. Your job is to determine if a user message is a social greeting/conversation or a data analysis request.

CONTEXT: This is a data analysis AI assistant that helps users analyze their business data, create charts, run SQL queries, and generate insights.

User Message: "${userQuery}"

Recent Conversation Context:
${conversationHistory.slice(-3).map(msg => `${msg.sender_type}: ${msg.content}`).join('\n') || 'No previous conversation'}

CLASSIFICATION RULES:
- "hello": ONLY pure social greetings like "hello", "hi", "hey", "good morning" with ZERO data analysis intent
- "goodbye": ONLY farewells like "bye", "goodbye", "see you later", "thanks, that's all"
- "thanks": ONLY gratitude like "thank you", "thanks", "appreciate it", "perfect, thanks"
- "small_talk": ONLY casual conversation like "how are you", "what's up", "nice to meet you"
- "none": ANY message that requests data analysis, insights, charts, reports, business information, or contains ANY data-related keywords

CRITICAL: If a message contains ANY of these, classify as "none":
- Data analysis requests (analyze, show, display, find, get, list, top, bottom, highest, lowest)
- Business questions (revenue, sales, performance, metrics, trends, reports)
- Data queries (attendance, districts, students, percentage, statistics)
- Chart/visualization requests (chart, graph, plot, visualize)
- Database queries (SQL, query, table, data)

Examples:
- "hello, show me sales data" → none (contains data request)
- "hi there, what's our revenue trend?" → none (contains business question)
- "hey, can you analyze this data?" → none (contains analysis request)
- "Can you give district wise attendance" → none (data analysis request)
- "top 5 districts" → none (data analysis request)
- "hello" → hello (pure greeting)
- "thanks for the chart" → thanks (gratitude)
- "bye, see you later" → goodbye (farewell)

Respond with JSON:
{
  "greetingType": "none",
  "confidence": 0.95,
  "reasoning": "Message contains data analysis request despite greeting words"
}`;

    try {
      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a conversation classifier for a data analysis AI assistant. Classify messages as greetings or data analysis requests. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: greetingPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      
      return {
        analysis: {
          isGreeting: result.greetingType !== 'none',
          greetingType: result.greetingType,
          confidence: result.confidence || 0.8,
          reasoning: result.reasoning
        },
        tokensUsed: response.tokens_used
      };
    } catch (error) {
      console.warn('AI greeting analysis failed, using pattern matching result:', error);
      return {
        analysis: {
          isGreeting: false,
          greetingType: 'none',
          confidence: 0.5,
          reasoning: 'AI analysis failed, defaulting to non-greeting'
        },
        tokensUsed: 0
      };
    }
  }

  private generateGreetingResponse(greetingType: 'hello' | 'goodbye' | 'thanks' | 'small_talk'): string {
    const responses = {
      hello: [
        "Hello! I'm your AI data analysis assistant. How can I help you analyze your data today?",
        "Hi there! Ready to dive into some data analysis? What would you like to explore?",
        "Hey! I'm here to help you understand your data better. What questions do you have?"
      ],
      goodbye: [
        "You're welcome! Feel free to ask if you need any more help analyzing your data.",
        "Goodbye! I'm here whenever you need help with your data analysis.",
        "Take care! Don't hesitate to reach out for more data insights."
      ],
      thanks: [
        "You're very welcome! I'm glad I could help with your data analysis.",
        "Happy to help! Feel free to ask if you need more insights.",
        "You're welcome! I'm here whenever you need assistance with your data."
      ],
      small_talk: [
        "I'm doing well, thank you! I'm ready to help you analyze your data. What would you like to explore?",
        "I'm here and ready to assist! What data questions can I help you with today?",
        "I'm doing great! Let's focus on your data analysis needs. What would you like to know?"
      ]
    };
    
    const typeResponses = responses[greetingType];
    return typeResponses[Math.floor(Math.random() * typeResponses.length)];
  }
}
