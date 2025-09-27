import OpenAI from 'openai'
import { decryptText, decryptObject } from './encryption'
import { supabaseServer as supabase } from './server-utils'
import { Client } from 'pg'
import mysql from 'mysql2/promise'
import { 
  calculateComprehensiveTokenUsage,
  TokenTrackingData 
} from './token-utils'
import { generateEmbedding, calculateCosineSimilarity } from './embeddings'
import { schemaAnswerAgent } from './schema-answer-agent'

interface DatabaseAISummary {
  summary?: string;
  key_points?: string[];
  tags?: string[];
  description?: string;
  business_purpose?: string;
  key_entities?: string[];
  common_use_cases?: string[];
  data_relationships?: string[];
  table_summary?: string;
  overall_architecture?: string;
  data_flow_analysis?: string;
}

interface XAIMetrics {
  confidence_score: number;
  reasoning_steps: string[];
  uncertainty_factors: string[];
  data_quality_score: number;
  response_completeness_score: number;
  user_satisfaction_prediction: number;
  processing_efficiency?: number;
  source_reliability?: number;
}

interface RAGContext {
  retrieved_chunks: number;
  similarity_scores: number[];
  source_documents: string[];
}

interface Explainability {
  reasoning_steps: string[];
  confidence_score: number;
  uncertainty_factors: string[];
}

// Removed duplicate DataSource interface - using the exported one below

/**
 * Helper function to find the most relevant table based on user query
 */
function findRelevantTable(userQuery: string, tables: Array<{name: string, columns?: Array<{name: string}>}>): {name: string, columns?: Array<{name: string}>} | null {
  const lowerQuery = userQuery.toLowerCase()
  
  // Keywords that might indicate specific tables
  const tableKeywords = {
    'donation': ['donation', 'donor', 'blood', 'donate'],
    'user': ['user', 'person', 'member', 'account'],
    'order': ['order', 'purchase', 'transaction', 'payment'],
    'product': ['product', 'item', 'inventory', 'catalog'],
    'event': ['event', 'activity', 'meeting', 'session'],
    'report': ['report', 'log', 'audit', 'history']
  }
  
  // Score each table based on relevance
  let bestMatch = null
  let bestScore = 0
  
  for (const table of tables) {
    let score = 0
    const tableName = table.name.toLowerCase()
    
    // Direct table name match
    if (lowerQuery.includes(tableName)) {
      score += 10
    }
    
    // Check against keyword patterns
    for (const [category, keywords] of Object.entries(tableKeywords)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          if (tableName.includes(category) || tableName.includes(keyword)) {
            score += 5
          }
        }
      }
    }
    
    // Check column names for relevance
    if (table.columns) {
      for (const column of table.columns) {
        const columnName = column.name.toLowerCase()
        for (const [category, keywords] of Object.entries(tableKeywords)) {
          for (const keyword of keywords) {
            if (lowerQuery.includes(keyword) && (columnName.includes(category) || columnName.includes(keyword))) {
              score += 3
            }
          }
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score
      bestMatch = table
    }
  }
  
  // Return the best match if score is above threshold
  return bestScore > 0 ? bestMatch : null
}

// Enhanced Multi-Agent Flow Types
export interface DataSource {
  id: string;
  name: string;
  type: 'database' | 'file' | 'url' | 'google_docs' | 'api_endpoint';
  connection_type: string;
  content_type: string;
  confidence_score: number;
  relevance_score: number;
  processing_strategy: 'single_source' | 'multi_source_parallel' | 'multi_source_sequential';
  estimated_processing_time_ms: number;
  metadata: Record<string, unknown>;
  ai_summary?: DatabaseAISummary;
  embedding?: number[]; // Vector embedding for semantic search
  semantic_similarity?: number; // Added for similarity scoring
  rank?: number; // Added for ranking
  // Additional properties for compatibility with API routes
  source_id?: string;
  source_name?: string;
  sections_used?: string[];
  processing_priority?: string; // Added for processing priority
}

export interface DataSourceFilterResponse {
  filtered_sources: DataSource[];
  filter_metadata: {
    total_sources_analyzed: number;
    sources_filtered: number;
    filter_criteria: string[];
    processing_time_ms: number;
    tokens_used: number;
    estimated_credits: number;
  };
  confidence_score: number;
}

export interface DataSourceRankingResponse {
  ranked_sources: DataSource[];
  processing_strategy: 'single_source' | 'multi_source_parallel' | 'multi_source_sequential';
  source_combination_approach: 'complementary' | 'verification' | 'comprehensive';
  optimization_recommendations: string[];
  metadata: {
    ranking_algorithm: string;
    sources_ranked: number;
    processing_time_ms: number;
    optimization_applied: boolean;
    tokens_used: number;
    estimated_credits: number;
  };
}

export interface DatabaseExecutionResult {
  success: boolean;
  data: Array<Record<string, unknown>> | null;
  query_executed?: string;
  execution_time_ms: number;
  rows_affected?: number;
  error_message?: string;
  metadata: {
    database_id: string;
    database_type: string;
    tables_accessed: string[];
    confidence_score: number;
    processing_status: string;
  };
  tokens_used: number;
  processing_time_ms: number;
}

export interface ExternalAPIResult {
  success: boolean;
  data: Array<Record<string, unknown>> | null;
  api_endpoint: string;
  execution_time_ms: number;
  response_status: number;
  error_message?: string;
  metadata: {
    source_type: string;
    source_id: string;
    confidence_score: number;
    processing_status: string;
  };
  tokens_used: number;
  processing_time_ms: number;
}

export interface MultiSourceQAResponse {
  content: string;
  source_attributions: Array<{
    source_type: 'database' | 'file' | 'url' | 'google_docs' | 'api_endpoint';
    source_id: string;
    contribution: string;
    confidence_score: number;
    data_points_used?: number;
    processing_time_ms?: number;
  }>;
  data_synthesis: {
    primary_insights: string[];
    supporting_evidence: string[];
    conflicting_information?: string[];
    gaps_identified?: string[];
    cross_source_validation: boolean;
    confidence_assessment: string;
  };
  follow_up_questions: string[];
  clarification_needed: boolean;
  uncertainty_reasons: string[];
  tokens_used: number;
  processing_time_ms: number;
  metadata: {
    total_sources_processed: number;
    processing_strategy: string;
    confidence_score: number;
    response_quality_score: number;
  };
}

export interface EnhancedAgentResponse {
  content: string;
  metadata: {
    processing_status: string;
    agent_id: string;
    workspace_id: string;
    data_sources_used: string[];
    confidence_score: number;
    follow_up_questions?: string[];
    source_attributions?: Array<{
      source_type: string;
      source_id: string;
      contribution: string;
      confidence_score: number;
    }>;
    data_synthesis?: {
      primary_insights: string[];
      supporting_evidence: string[];
      conflicting_information?: string[];
      gaps_identified?: string[];
    };
  };
  tokens_used: number;
  tokens_rounded: number;
  credits_used: number;
  processing_time_ms: number;
  token_tracking?: TokenTrackingData;
  // XAI and detailed metadata fields
  xai_metrics?: XAIMetrics;
  agent_thinking_notes?: string[];
  sql_queries?: string[];
  graph_data?: Record<string, unknown>;
  reasoning_explanation?: string;
  analysis_depth?: string;
  data_quality_score?: number;
  response_completeness_score?: number;
  user_satisfaction_prediction?: number;
  rag_context?: RAGContext;
  explainability?: Explainability;
  data_sources?: DataSource[];
  sql_query?: string;
}

// New Agent Interfaces for Modular Architecture
export interface GreetingAgentResponse {
  isGreeting: boolean;
  response?: string;
  confidence: number;
  greetingType: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none';
  tokens_used: number;
  processing_time_ms: number;
}

export interface GuardrailsAgentResponse {
  allowed: boolean;
  reason?: string;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
  tokens_used: number;
  processing_time_ms: number;
}

export interface ValidationAgentResponse {
  is_valid: boolean;
  query_type: 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation' | 'clarification';
  confidence: number;
  requires_follow_up?: boolean;
  follow_up_context?: string;
  intent_classification: {
    intent: string;
    confidence: number;
    entities: string[];
    context: string;
  };
  relevance_check: {
    is_relevant: boolean;
    reason: string;
    confidence: number;
  };
  tokens_used: number;
  processing_time_ms: number;
}

export interface FollowUpAgentResponse {
  follow_up_questions: string[];
  contextual_suggestions: string[];
  conversation_continuation: boolean;
  confidence: number;
  tokens_used: number;
  processing_time_ms: number;
}


// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Greeting Agent - Handles greetings, small talk, and conversational responses
 */
export async function greetingAgent(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<GreetingAgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('👋 Greeting Agent: Analyzing message for greetings...')
    
    const lowerMessage = userMessage.toLowerCase().trim()
    
    // Check for greeting patterns
    const greetingPatterns = {
      hello: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'],
      goodbye: ['bye', 'goodbye', 'see you', 'farewell', 'take care', 'have a good day'],
      thanks: ['thank you', 'thanks', 'appreciate', 'grateful', 'much obliged'],
      small_talk: ['how are you', 'how do you do', 'what\'s up', 'how\'s it going', 'nice to meet you']
    }
    
    // Check for greeting types
    let greetingType: 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none' = 'none'
    let confidence = 0
    
    for (const [type, patterns] of Object.entries(greetingPatterns)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          greetingType = type as 'hello' | 'goodbye' | 'thanks' | 'small_talk' | 'none'
          confidence = 0.8
          break
        }
      }
      if (greetingType !== 'none') break
    }
    
    // Use AI for more sophisticated greeting detection
    if (greetingType === 'none' && lowerMessage.length < 50) {
      const greetingPrompt = `Determine if this message is a greeting, goodbye, thanks, or small talk.

User Message: "${userMessage}"

Recent Conversation:
${conversationHistory.slice(-3).map(msg => `${msg.sender_type}: ${msg.content}`).join('\n') || 'No previous conversation'}

Classify as:
- "hello": Greetings, introductions, starting conversations
- "goodbye": Farewells, ending conversations
- "thanks": Gratitude, appreciation
- "small_talk": Casual conversation, "how are you", etc.
- "none": Not a greeting/social message

Respond with JSON:
{
  "greetingType": "hello",
  "confidence": 0.9,
  "reasoning": "Message contains greeting words"
}`

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a greeting classifier. Respond with valid JSON only.' },
          { role: 'user', content: greetingPrompt }
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0]?.message?.content || '{}')
      greetingType = result.greetingType || 'none'
      confidence = result.confidence || 0.5
    }
    
    // Generate appropriate response
    let response: string | undefined
    if (greetingType !== 'none') {
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
      }
      
      const typeResponses = responses[greetingType]
      response = typeResponses[Math.floor(Math.random() * typeResponses.length)]
    }
    
    return {
      isGreeting: greetingType !== 'none',
      response,
      confidence,
      greetingType,
      tokens_used: 50,
      processing_time_ms: Date.now() - startTime
    }
    
  } catch (error) {
    console.error('Greeting Agent error:', error)
    return {
      isGreeting: false,
      confidence: 0,
      greetingType: 'none',
      tokens_used: 0,
      processing_time_ms: Date.now() - startTime
    }
  }
}

/**
 * Guardrails Agent - Handles content safety and appropriateness checks
 */
export async function guardrailsAgent(
  userMessage: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<GuardrailsAgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🛡️ Guardrails Agent: Checking content safety...')
    
    // Import the existing guardrails function
    const { checkContentSafety } = await import('./guardrails')
    const guardrailResult = checkContentSafety(userMessage)
    
    // Enhanced risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (!guardrailResult.allowed) {
      riskLevel = 'high'
    } else {
      // Additional checks for medium risk
      const lowerMessage = userMessage.toLowerCase()
      const mediumRiskPatterns = [
        'personal information', 'private data', 'confidential',
        'hack', 'exploit', 'vulnerability', 'security',
        'illegal', 'unlawful', 'fraud', 'scam'
      ]
      
      if (mediumRiskPatterns.some(pattern => lowerMessage.includes(pattern))) {
        riskLevel = 'medium'
      }
    }
    
    return {
      allowed: guardrailResult.allowed,
      reason: guardrailResult.reason,
      confidence: 0.9,
      risk_level: riskLevel,
      tokens_used: 20,
      processing_time_ms: Date.now() - startTime
    }
    
  } catch (error) {
    console.error('Guardrails Agent error:', error)
    return {
      allowed: true, // Default to allowing if guardrails fail
      reason: 'Guardrails check failed, defaulting to allow',
      confidence: 0.5,
      risk_level: 'medium',
      tokens_used: 0,
      processing_time_ms: Date.now() - startTime
    }
  }
}

/**
 * Helper function to classify query intent
 */
export async function classifyQueryIntent(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<{
  intent: string;
  confidence: number;
  entities: string[];
  context: string;
}> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    
    const recentHistory = conversationHistory.slice(-3).map(msg => 
      `${msg.sender_type}: ${msg.content}`
    ).join('\n')
    
    const intentPrompt = `Classify the intent of this user message in the context of a data analysis assistant.

User Message: "${userMessage}"

Recent Conversation:
${recentHistory || 'No previous conversation'}

Classify the intent as one of:
- "greeting": Hello, hi, good morning, etc.
- "closing": Goodbye, thanks, bye, etc.
- "data_query": Questions about data, analysis, metrics, etc.
- "continuation": Following up on previous topic
- "clarification": Providing clarification to previous question
- "small_talk": How are you, what's up, etc.

Respond with JSON:
{
  "intent": "data_query",
  "confidence": 0.9,
  "entities": ["donations", "blood bridges"],
  "context": "User asking about donation metrics"
}`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an intent classifier for a data analysis assistant. Respond with valid JSON only.' },
        { role: 'user', content: intentPrompt }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    
    return {
      intent: result.intent || 'data_query',
      confidence: result.confidence || 0.5,
      entities: result.entities || [],
      context: result.context || 'No context provided'
    }
    
  } catch (error) {
    console.error('Error in intent classification:', error)
    return {
      intent: 'data_query',
      confidence: 0.5,
      entities: [],
      context: 'Classification failed, defaulting to data query'
    }
  }
}

/**
 * Helper function to check message relevance
 */
export async function checkMessageRelevance(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<{
  isIrrelevant: boolean;
  reason?: string;
  confidence: number;
}> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    
    const recentHistory = conversationHistory.slice(-3).map(msg => 
      `${msg.sender_type}: ${msg.content}`
    ).join('\n')
    
    const relevancePrompt = `Determine if the user's message is relevant to data analysis, business insights, or data-related questions.

User Message: "${userMessage}"

Recent Conversation:
${recentHistory || 'No previous conversation'}

A message is RELEVANT if it's about:
- Data analysis, trends, patterns, insights
- Business metrics, KPIs, performance
- File analysis, document processing
- Database queries, data exploration
- Charts, visualizations, reports
- Statistical analysis, comparisons
- Data quality, validation
- Business intelligence, reporting
- Questions asking "how many", "how much", "what is the count", "what are the numbers"
- Donation data, charity metrics, fundraising statistics
- Any quantitative questions about organizations, programs, or activities
- Questions about specific data points, counts, or measurements
- Analysis of organizational performance, impact, or outcomes

A message is IRRELEVANT if it's about:
- Personal conversations, small talk
- Technical support for other systems
- General knowledge questions unrelated to data
- Entertainment, jokes, casual chat
- Personal advice, relationships
- News, politics, sports (unless data-related)
- Programming help (unless data analysis related)
- General AI assistance outside data analysis
- Philosophical or abstract questions without data context

IMPORTANT: Questions asking for specific numbers, counts, or quantitative data (like "How many donations", "What is the total", "How much was raised") should ALWAYS be considered RELEVANT, even if they seem simple.

Respond with JSON:
{
  "isIrrelevant": false,
  "reason": "Message is about data analysis",
  "confidence": 0.9
}`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a relevance classifier for a data analysis assistant. Respond with valid JSON only.' },
        { role: 'user', content: relevancePrompt }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    
    return {
      isIrrelevant: result.isIrrelevant || false,
      reason: result.reason,
      confidence: result.confidence || 0.5
    }
    
  } catch (error) {
    console.error('Error in message relevance check:', error)
    
    // Fallback: Check for obvious off-topic patterns
    const lowerMessage = userMessage.toLowerCase()
    const offTopicPatterns = [
      'weather', 'recipe', 'joke', 'story', 'movie', 'music', 'sports',
      'politics', 'news', 'gossip', 'personal', 'relationship', 'dating',
      'health advice', 'medical', 'legal advice', 'financial advice'
    ]
    
    // Check for data-related patterns that should be considered relevant
    const dataRelatedPatterns = [
      'how many', 'how much', 'what is the count', 'what are the numbers',
      'donations', 'donors', 'fundraising', 'charity', 'metrics', 'statistics',
      'total', 'sum', 'average', 'percentage', 'ratio', 'trend', 'analysis'
    ]
    
    const isDataRelated = dataRelatedPatterns.some(pattern => lowerMessage.includes(pattern))
    const isOffTopic = offTopicPatterns.some(pattern => lowerMessage.includes(pattern))
    
    // If it contains data-related patterns, consider it relevant
    if (isDataRelated) {
      return {
        isIrrelevant: false,
        reason: 'Message contains data-related keywords',
        confidence: 0.8
      }
    }
    
    if (isOffTopic) {
      return {
        isIrrelevant: true,
        reason: 'Message appears to be off-topic for a data analysis assistant',
        confidence: 0.7
      }
    }
    
    return {
      isIrrelevant: false,
      confidence: 0.5
    }
  }
}

/**
 * Validation Agent - Handles query validation, intent classification, and relevance checking
 */
export async function validationAgent(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<ValidationAgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🔍 Validation Agent: Validating query and classifying intent...')
    
    // Implement intent classification directly
    const intentResult = await classifyQueryIntent(userMessage, conversationHistory)
    
    // Implement relevance check directly
    const relevanceResult = await checkMessageRelevance(userMessage, conversationHistory)
    
    // Determine query type based on intent and relevance
    let queryType: 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation' | 'clarification' = 'data_query'
    
    if (intentResult.intent === 'greeting') {
      queryType = 'greeting'
    } else if (intentResult.intent === 'closing') {
      queryType = 'closing'
    } else if (intentResult.intent === 'continuation') {
      queryType = 'continuation'
    } else if (intentResult.intent === 'clarification') {
      queryType = 'clarification'
    } else if (relevanceResult.isIrrelevant) {
      queryType = 'irrelevant'
    } else if (intentResult.confidence < 0.5) {
      queryType = 'ambiguous'
    }
    
    // Determine if follow-up is needed
    const requiresFollowUp = queryType === 'ambiguous' || 
                           (intentResult.intent === 'data_query' && intentResult.confidence < 0.7) ||
                           relevanceResult.isIrrelevant
    
    return {
      is_valid: queryType === 'data_query' || queryType === 'greeting' || queryType === 'closing' || queryType === 'continuation' || queryType === 'clarification',
      query_type: queryType,
      confidence: Math.min(intentResult.confidence, relevanceResult.confidence),
      requires_follow_up: requiresFollowUp,
      follow_up_context: requiresFollowUp ? 'Query needs clarification or is ambiguous' : undefined,
      intent_classification: {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        entities: intentResult.entities,
        context: intentResult.context
      },
      relevance_check: {
        is_relevant: !relevanceResult.isIrrelevant,
        reason: relevanceResult.reason || 'Message is relevant to data analysis',
        confidence: relevanceResult.confidence
      },
      tokens_used: 100,
      processing_time_ms: Date.now() - startTime
    }
    
  } catch (error) {
    console.error('Validation Agent error:', error)
    return {
      is_valid: true, // Default to valid if validation fails
      query_type: 'data_query',
      confidence: 0.5,
      requires_follow_up: false,
      intent_classification: {
        intent: 'data_query',
        confidence: 0.5,
        entities: [],
        context: 'Validation failed, defaulting to data query'
      },
      relevance_check: {
        is_relevant: true,
        reason: 'Validation failed, defaulting to relevant',
        confidence: 0.5
      },
      tokens_used: 0,
      processing_time_ms: Date.now() - startTime
    }
  }
}

/**
 * Follow-up Agent - Generates contextual follow-up questions and suggestions
 */
export async function followUpAgent(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
  currentResponse?: string,
  dataContext?: {
    data_sources_used: string[];
    primary_insights: string[];
    supporting_evidence: string[];
  }
): Promise<FollowUpAgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('💭 Follow-up Agent: Generating contextual follow-up questions...')
    
    const recentConversation = conversationHistory.slice(-4).map(msg => 
      `${msg.sender_type}: ${msg.content}`
    ).join('\n')
    
    const followUpPrompt = `Generate contextual follow-up questions and suggestions based on the conversation and data context.

User's Current Question: "${userMessage}"

Recent Conversation:
${recentConversation || 'No previous conversation'}

Current Response Context:
${currentResponse ? `Response: ${currentResponse.substring(0, 500)}...` : 'No current response'}

Data Context:
${dataContext ? `
- Data Sources Used: ${dataContext.data_sources_used.join(', ')}
- Primary Insights: ${dataContext.primary_insights.join(', ')}
- Supporting Evidence: ${dataContext.supporting_evidence.slice(0, 3).join(', ')}
` : 'No data context available'}

Generate 2-3 relevant follow-up questions that:
1. Build naturally on the current topic
2. Are specific to the data or insights presented
3. Help the user explore deeper or related areas
4. Are actionable and clear

Also provide 1-2 contextual suggestions for:
- Related data exploration
- Alternative analysis approaches
- Additional insights to consider

Respond with JSON:
{
  "follow_up_questions": [
    "What about the trends over time?",
    "How do these numbers compare to other regions?"
  ],
  "contextual_suggestions": [
    "You might want to explore seasonal patterns",
    "Consider analyzing by demographic segments"
  ],
  "conversation_continuation": true,
  "confidence": 0.8
}`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a follow-up question generator for a data analysis assistant. Respond with valid JSON only.' },
        { role: 'user', content: followUpPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    
    return {
      follow_up_questions: result.follow_up_questions || [],
      contextual_suggestions: result.contextual_suggestions || [],
      conversation_continuation: result.conversation_continuation || false,
      confidence: result.confidence || 0.7,
      tokens_used: 150,
      processing_time_ms: Date.now() - startTime
    }
    
  } catch (error) {
    console.error('Follow-up Agent error:', error)
    return {
      follow_up_questions: [],
      contextual_suggestions: [],
      conversation_continuation: false,
      confidence: 0,
      tokens_used: 0,
      processing_time_ms: Date.now() - startTime
    }
  }
}

/**
 * Detect if the current user message is providing clarification to a previous question
 */
async function detectClarificationResponse(
  userQuery: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<{
  isClarification: boolean;
  previousAgentResponse?: string;
  confidence: number;
  clarificationType?: 'parameter_specification' | 'context_addition' | 'query_refinement';
}> {
  try {
    // Look for recent agent messages that asked for clarification
    const recentMessages = conversationHistory.slice(-6) // Last 6 messages
    const lastAgentMessage = recentMessages
      .filter(msg => msg.sender_type === 'agent')
      .slice(-1)[0]
    
    if (!lastAgentMessage) {
      return { isClarification: false, confidence: 0.0 }
    }

    // Check if the last agent message was asking for clarification
    const clarificationKeywords = [
      'clarification', 'clarify', 'specify', 'more specific', 'which', 'what exactly',
      'could you clarify', 'to provide the most accurate', 'I need to know',
      'please provide more', 'more details', 'specific details'
    ]
    
    const isAgentAskingForClarification = clarificationKeywords.some(keyword => 
      lastAgentMessage.content.toLowerCase().includes(keyword)
    )

    if (!isAgentAskingForClarification) {
      return { isClarification: false, confidence: 0.0 }
    }

    // Use AI to determine if this is a clarification response
    const clarificationPrompt = `Analyze if the user's message is providing clarification to the agent's previous question.

Agent's Previous Message: "${lastAgentMessage.content}"

User's Current Message: "${userQuery}"

Determine if the user is:
1. Providing clarification/answer to the agent's question
2. Adding more context or parameters
3. Refining their original question
4. Or just asking a new unrelated question

Respond with JSON:
{
  "isClarification": true/false,
  "confidence": 0.0-1.0,
  "clarificationType": "parameter_specification" | "context_addition" | "query_refinement" | null,
  "reasoning": "Brief explanation"
}`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a conversation analysis expert. Analyze if user messages are clarifications to previous agent questions. Respond with valid JSON only.' },
        { role: 'user', content: clarificationPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    
    return {
      isClarification: result.isClarification || false,
      previousAgentResponse: lastAgentMessage.content,
      confidence: result.confidence || 0.0,
      clarificationType: result.clarificationType
    }

  } catch (error) {
    console.error('Error detecting clarification response:', error)
    return { isClarification: false, confidence: 0.0 }
  }
}

/**
 * Convert tokens to credits based on environment variable
 * Rounds tokens to nearest multiple of TOKENS_PER_CREDIT before calculating credits
 */
function tokensToCredits(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000')
  // Round tokens to nearest multiple of tokensPerCredit
  const roundedTokens = Math.ceil(tokens / tokensPerCredit) * tokensPerCredit
  return roundedTokens / tokensPerCredit
}

/**
 * Get rounded tokens for display purposes
 */
function getRoundedTokens(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000')
  return Math.ceil(tokens / tokensPerCredit) * tokensPerCredit
}

/**
 * Execute database query using the actual database connection system
 */
async function executeDatabaseQuery(dbConnection: {type: string, connection_config_encrypted: string, password_encrypted: string}, query: string): Promise<{
  rows: Array<Record<string, unknown>>;
  execution_time: number;
  tables_accessed: string[];
}> {
  const startTime = Date.now()
    
  try {
    console.log(`🔍 Executing database query: ${query}`)
    
    // Decrypt connection configuration
    const connectionConfig = decryptObject(dbConnection.connection_config_encrypted)
    const password = dbConnection.password_encrypted ? decryptText(dbConnection.password_encrypted) : ''
    
    // Extract table names from query for metadata
    const tableMatches = query.match(/FROM\s+(\w+)/gi) || []
    const tablesAccessed = tableMatches.map(match => match.replace(/FROM\s+/i, ''))
    
    let rows: Array<Record<string, unknown>> = []
    
    // Execute query based on database type
    switch (dbConnection.type) {
      case 'postgresql':
        rows = await executePostgreSQLQuery(connectionConfig, password, query)
        break
      case 'mysql':
        rows = await executeMySQLQuery(connectionConfig, password, query)
        break
      default:
        throw new Error(`Unsupported database type: ${dbConnection.type}`)
    }
    
    const executionTime = Date.now() - startTime
    
    console.log(`✅ Query executed successfully in ${executionTime}ms, returned ${rows.length} rows`)
    
    return {
      rows,
      execution_time: executionTime,
      tables_accessed: tablesAccessed
    }
  } catch (error) {
    console.error('Database query execution error:', error)
    throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Execute PostgreSQL query
 */
async function executePostgreSQLQuery(config: Record<string, unknown>, password: string, query: string): Promise<Array<Record<string, unknown>>> {
  const client = new Client({
    host: config.host as string,
    port: parseInt(config.port as string) || 5432,
    database: config.database as string,
    user: config.username as string,
    password: password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    const result = await client.query(query)
    return result.rows
  } finally {
    await client.end()
  }
}

/**
 * Execute MySQL query
 */
async function executeMySQLQuery(config: Record<string, unknown>, password: string, query: string): Promise<Array<Record<string, unknown>>> {
  const connection = await mysql.createConnection({
    host: config.host as string,
    port: parseInt(config.port as string) || 3306,
    database: config.database as string,
    user: config.username as string,
    password: password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  })

  try {
    const [rows] = await connection.execute(query)
    return rows as Array<Record<string, unknown>>
  } finally {
    await connection.end()
  }
}

/**
 * Data Source Filter Agent - Filters available data sources to top candidates
 */
export async function dataSourceFilterAgent(
  userQuery: string,
  workspaceId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<DataSourceFilterResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🔍 Data Source Filter Agent: Starting source filtering...')
    
    // Get all available data sources in the workspace with AI summaries
    // First check workspace_data_sources to see what's registered
      const { data: workspaceDataSources } = await supabase
      .from('workspace_data_sources')
      .select('*')
      .eq('workspace_id', workspaceId)
    
    console.log(`🔍 Found ${workspaceDataSources?.length || 0} data sources in workspace_data_sources`)
    
    const { data: databaseConnections, error: dbError } = await supabase
      .from('database_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
    
    const { data: fileUploads, error: fileError } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('processing_status', 'completed')
    
    // Get file summaries
    const fileIds = fileUploads?.map((f: {id: string}) => f.id) || []
    const { data: fileSummaries } = await supabase
      .from('file_summaries')
      .select('*')
      .in('file_id', fileIds)
    
    if (dbError) console.error('Database connections error:', dbError)
    if (fileError) console.error('File uploads error:', fileError)
    
    console.log(`🔍 Found ${databaseConnections?.length || 0} database connections`)
    console.log(`🔍 Found ${fileUploads?.length || 0} file uploads`)
    
    // Create data source candidates
    const dataSources: DataSource[] = []
    
    // Create file summary lookup map
    const fileSummaryMap = new Map()
      fileSummaries?.forEach((summary: {file_id: string}) => {
      fileSummaryMap.set(summary.file_id, summary)
    })

    // Add database connections with AI summaries
    databaseConnections?.forEach((db: {id: string, name: string, type: string, connection_type?: string, connection_string?: string, schema_info?: string, schema_info_encrypted?: string, ai_summary_encrypted?: string}) => {
      let aiSummary = undefined
      
      // Check for AI summary in schema_info_encrypted (new format)
      if (db.schema_info_encrypted) {
        try {
          console.log(`🔍 Attempting to decrypt schema for database ${db.name}...`)
          const decryptedSchema = decryptObject(db.schema_info_encrypted) as { schema: { ai_definition?: DatabaseAISummary } }
          console.log(`✅ Successfully decrypted schema for ${db.name}`)
          if (decryptedSchema.schema?.ai_definition) {
            aiSummary = decryptedSchema.schema.ai_definition
            console.log(`✅ Found AI definition in schema for ${db.name}`)
          } else {
            console.log(`❌ No AI definition found in schema for ${db.name}`)
          }
        } catch (error) {
          console.error(`❌ Error decrypting database schema for ${db.id}:`, error)
        }
      }
      
      // Fallback to old format (ai_summary_encrypted)
      if (!aiSummary && db.ai_summary_encrypted) {
        try {
          aiSummary = decryptObject(db.ai_summary_encrypted)
        } catch (error) {
          console.error(`Error decrypting database summary for ${db.id}:`, error)
        }
      }

      dataSources.push({
        id: db.id,
        name: db.name,
        type: 'database',
        connection_type: db.type || db.connection_type || 'unknown',
        content_type: 'database',
        confidence_score: aiSummary ? 0.9 : 0.7, // Higher confidence if AI summary is available
        relevance_score: 0.0, // Will be calculated
        processing_strategy: 'single_source',
        estimated_processing_time_ms: 2000,
        metadata: {
          database_type: db.type || db.connection_type || 'unknown',
          connection_string: db.connection_string || null,
          schema_info: db.schema_info_encrypted || db.schema_info
        },
        ai_summary: aiSummary
      })
    })
    
    // Add file uploads with AI summaries
    fileUploads?.forEach((file: {id: string, name: string, original_name?: string, file_type: string, file_size?: number, processing_status?: string}) => {
      const fileSummary = fileSummaryMap.get(file.id)
      let aiSummary = undefined
      
      if (fileSummary) {
        try {
          // Decrypt file summary
          if (fileSummary.encryption_version === 'v1') {
            aiSummary = {
              summary: fileSummary.summary_encrypted ? decryptText(fileSummary.summary_encrypted) : fileSummary.summary || '',
              key_points: fileSummary.key_points_encrypted ? JSON.parse(decryptText(fileSummary.key_points_encrypted)) : fileSummary.key_points || [],
              tags: fileSummary.tags_encrypted ? JSON.parse(decryptText(fileSummary.tags_encrypted)) : fileSummary.tags || []
            }
          } else {
            aiSummary = {
              summary: fileSummary.summary || '',
              key_points: fileSummary.key_points || [],
              tags: fileSummary.tags || []
            }
          }
        } catch (error) {
          console.error(`Error decrypting file summary for ${file.id}:`, error)
        }
      }

      dataSources.push({
        id: file.id,
        name: file.original_name || file.name,
        type: 'file',
        connection_type: 'file_upload',
        content_type: file.file_type,
        confidence_score: aiSummary ? 0.8 : 0.6, // Higher confidence if AI summary is available
        relevance_score: 0.0, // Will be calculated
        processing_strategy: 'single_source',
        estimated_processing_time_ms: 1500,
        metadata: {
          file_type: file.file_type,
          file_size: file.file_size || 0,
          processing_status: file.processing_status || 'unknown'
        },
        ai_summary: aiSummary
      })
    })
    
    console.log(`📊 Data Source Filter Agent: Found ${dataSources.length} potential sources`)
    console.log('🔍 Data sources details:', dataSources.map(ds => ({
      id: ds.id,
      name: ds.name,
      type: ds.type,
      connection_type: ds.connection_type,
      has_ai_summary: !!ds.ai_summary
    })))
    
    if (dataSources.length === 0) {
      throw new Error('No data sources available in workspace')
    }
    
    // Generate embedding for user query
    const queryEmbedding = await generateEmbedding(userQuery)
    
    // Generate embeddings for data sources and calculate semantic similarity
    console.log('🔍 Generating embeddings for data sources...')
    const sourcesWithEmbeddings = await Promise.all(
      dataSources.map(async (source, index) => {
        try {
          console.log(`📝 Processing source ${index + 1}: ${source.name} (${source.type})`)
          let sourceText = `${source.name} ${source.type} ${source.connection_type}`
          
          // Add AI summary if available
          if (source.ai_summary) {
            console.log(`   - Has AI summary: ${!!source.ai_summary.summary || !!source.ai_summary.description}`)
            // Handle both file summaries and database summaries
            if (source.ai_summary.summary) {
              // File summary format
              sourceText += ` ${source.ai_summary.summary}`
              if (source.ai_summary.key_points && Array.isArray(source.ai_summary.key_points)) {
                sourceText += ` ${source.ai_summary.key_points.join(' ')}`
              }
              if (source.ai_summary.tags && Array.isArray(source.ai_summary.tags)) {
                sourceText += ` ${source.ai_summary.tags.join(' ')}`
              }
            } else {
              // Database summary format - combine all available fields
              const dbSummary = source.ai_summary
              if (dbSummary.description) sourceText += ` ${dbSummary.description}`
              if (dbSummary.business_purpose) sourceText += ` ${dbSummary.business_purpose}`
              if (dbSummary.key_entities) sourceText += ` ${dbSummary.key_entities}`
              if (dbSummary.common_use_cases) sourceText += ` ${dbSummary.common_use_cases}`
              if (dbSummary.data_relationships) sourceText += ` ${dbSummary.data_relationships}`
              if (dbSummary.table_summary) sourceText += ` ${dbSummary.table_summary}`
              if (dbSummary.overall_architecture) sourceText += ` ${dbSummary.overall_architecture}`
              if (dbSummary.data_flow_analysis) sourceText += ` ${dbSummary.data_flow_analysis}`
            }
          } else {
            console.log(`   - No AI summary available`)
          }
          
          console.log(`   - Source text length: ${sourceText.length}`)
          const embedding = await generateEmbedding(sourceText)
          const similarity = calculateCosineSimilarity(queryEmbedding.embedding, embedding.embedding)
          console.log(`   - Similarity score: ${similarity}`)
          
          return {
            ...source,
            embedding: embedding.embedding,
            semantic_similarity: similarity
          }
        } catch (error) {
          console.error(`❌ Error generating embedding for source ${source.id}:`, error)
          return {
            ...source,
            semantic_similarity: 0.0
          }
        }
      })
    )

    console.log(`✅ Generated embeddings for ${sourcesWithEmbeddings.length} sources`)

    // Sort by semantic similarity
    const sortedSources = sourcesWithEmbeddings
      .sort((a, b) => b.semantic_similarity - a.semantic_similarity)
    
    console.log(`📊 Filtered to top ${sortedSources.length} sources:`)
    sortedSources.forEach((source, index) => {
      console.log(`   ${index + 1}. ${source.name} (${source.type}) - Similarity: ${source.semantic_similarity.toFixed(3)}`)
    })

    // Use lightweight AI analysis for final filtering
    const filterPrompt = `Select all relevant data sources for: "${userQuery}"

Sources (pre-ranked by similarity):
${sortedSources.map((source, index) => `${index + 1}. ID: ${source.id} | Name: ${source.name} (${source.type}) - Similarity: ${source.semantic_similarity.toFixed(3)}`).join('\n')}

IMPORTANT: Use the exact ID from the list above, not the name.

Return JSON:
{
  "filtered_sources": [
    {
      "id": "exact_id_from_list_above",
      "relevance_score": 0.8,
      "reasoning": "Brief reason"
    }
  ],
  "filter_criteria": ["semantic_similarity"],
  "confidence_score": 0.8
}`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Data Source Filter Agent. Respond with valid JSON only.' },
        { role: 'user', content: filterPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    let filterResult
    const tokensUsed = response.usage?.total_tokens || 0
    
    try {
      const responseContent = response.choices[0]?.message?.content || '{}'
      console.log('🔍 AI Filter Response:', responseContent.substring(0, 200) + '...')
      filterResult = JSON.parse(responseContent)
      
      // Debug: Log the filter result
      console.log('🔍 Filter result:', JSON.stringify(filterResult, null, 2))
      console.log('🔍 Available source IDs:', dataSources.map(s => s.id))
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError)
      throw new Error(`AI filtering failed due to JSON parsing error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    // Ensure we always have a valid filter result
    if (!filterResult || !filterResult.filtered_sources) {
      throw new Error('Data source filtering completely failed - no valid result returned')
    }
    
    // Apply filtering results to data sources
    console.log('🔍 Filtering sources...')
    console.log('🔍 Filter result filtered_sources:', filterResult.filtered_sources)
    console.log('🔍 Available data sources:', dataSources.map(s => ({ id: s.id, name: s.name })))
    
    const filteredSources = dataSources
      .filter(source => {
        const isIncluded = filterResult.filtered_sources?.some((f: {id: string}) => f.id === source.id)
        console.log(`🔍 Source ${source.id} (${source.name}) included: ${isIncluded}`)
        return isIncluded
      })
      .map(source => {
        const filterInfo = filterResult.filtered_sources?.find((f: {id: string, relevance_score?: number}) => f.id === source.id)
        return {
          ...source,
          relevance_score: filterInfo?.relevance_score || 0.0
        }
      })
      .sort((a, b) => b.relevance_score - a.relevance_score)
    
    console.log('🔍 Final filtered sources count:', filteredSources.length)
    
    const processingTime = Date.now() - startTime
    
    return {
      filtered_sources: filteredSources,
      filter_metadata: {
        total_sources_analyzed: dataSources.length,
        sources_filtered: filteredSources.length,
        filter_criteria: filterResult.filter_criteria || [],
        processing_time_ms: processingTime,
        tokens_used: tokensUsed + queryEmbedding.tokens_used, // Include embedding tokens
        estimated_credits: tokensToCredits(tokensUsed + queryEmbedding.tokens_used)
      },
      confidence_score: filterResult.confidence_score || 0.7
    }
    
  } catch (error) {
    console.error('Data Source Filter Agent error:', error)
    throw error
  }
}

/**
 * Data Source Ranking Agent - Ranks filtered sources and determines processing strategy
 */
export async function dataSourceRankingAgent(
  userQuery: string,
  filteredSources: DataSource[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<DataSourceRankingResponse> {
  const startTime = Date.now()
  
  try {
    console.log('📊 Data Source Ranking Agent: Starting source ranking...')
    
    if (filteredSources.length === 0) {
      throw new Error('No filtered sources available for ranking')
    }
    
    // Use AI to rank sources and determine processing strategy
    const rankingPrompt = `You are a Data Source Ranking Agent. Analyze the filtered data sources and determine the optimal processing strategy.

User Query: "${userQuery}"

Filtered Data Sources:
${filteredSources.map((source, index) => `
${index + 1}. ${source.name}
   Type: ${source.type}
   Relevance Score: ${source.relevance_score}
   Confidence Score: ${source.confidence_score}
   Processing Strategy: ${source.processing_strategy}
   Estimated Time: ${source.estimated_processing_time_ms}ms
`).join('\n')}

Your task:
1. Rank sources by optimal processing order
2. Determine processing strategy (single_source, multi_source_parallel, multi_source_sequential)
3. Choose source combination approach (complementary, verification, comprehensive)
4. Provide optimization recommendations

Processing Strategies:
- single_source: Use only the highest-ranked source
- multi_source_parallel: Process multiple sources simultaneously
- multi_source_sequential: Process sources in order of importance

Source Combination Approaches:
- complementary: Sources provide different but related information
- verification: Sources provide similar information for cross-validation
- comprehensive: Sources provide comprehensive coverage of the topic

Respond with JSON:
{
  "ranked_sources": [
    {
      "id": "source_id",
      "rank": 1,
      "processing_priority": "high",
      "reasoning": "Primary data source for the query"
    }
  ],
  "processing_strategy": "multi_source_parallel",
  "source_combination_approach": "complementary",
  "optimization_recommendations": ["Use parallel processing for faster results"]
}`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Data Source Ranking Agent. Respond with valid JSON only.' },
        { role: 'user', content: rankingPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const rankingResult = JSON.parse(response.choices[0]?.message?.content || '{}')
    const tokensUsed = response.usage?.total_tokens || 0
    
    // Apply ranking results
    const rankedSources = filteredSources
      .map(source => {
        const rankInfo = rankingResult.ranked_sources?.find((r: {id: string, rank?: number, processing_priority?: string}) => r.id === source.id)
        return {
          ...source,
          rank: rankInfo?.rank || 999,
          processing_priority: rankInfo?.processing_priority || 'low'
        }
      })
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    
    const processingTime = Date.now() - startTime
    
    return {
      ranked_sources: rankedSources,
      processing_strategy: rankingResult.processing_strategy || 'single_source',
      source_combination_approach: rankingResult.source_combination_approach || 'complementary',
      optimization_recommendations: rankingResult.optimization_recommendations || [],
      metadata: {
        ranking_algorithm: 'ai_enhanced_ranking',
        sources_ranked: rankedSources.length,
        processing_time_ms: processingTime,
        optimization_applied: true,
        tokens_used: tokensUsed,
        estimated_credits: tokensToCredits(tokensUsed)
      }
    }
    
  } catch (error) {
    console.error('Data Source Ranking Agent error:', error)
    throw error
  }
}

/**
 * Database Execution Coordinator - Executes queries on database sources
 */
export async function databaseExecutionCoordinator(
  source: DataSource,
  userQuery: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<DatabaseExecutionResult> {
  const startTime = Date.now()
  
  try {
    console.log(`🗄️ Database Execution Coordinator: Processing ${source.name}...`)
    
    // Get database connection details
    const { data: dbConnection, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('id', source.id)
      .single()
    
    if (error || !dbConnection) {
      throw new Error(`Database connection not found for source: ${source.id}`)
    }
    
    // Execute actual database query using the existing database query system
    try {
      // Get the database schema information from the connection
      let schema: {tables?: Array<{name: string, columns?: Array<{name: string}>}>, views?: Array<{name: string, columns?: Array<{name: string}>}>} | null = null
      if (dbConnection.schema_info_encrypted) {
        try {
          console.log(`🔍 Attempting to decrypt schema for database ${dbConnection.name}...`)
          console.log(`🔍 Schema encrypted data length: ${dbConnection.schema_info_encrypted?.length || 0}`)
          console.log(`🔍 CHAT_ENCRYPTION_KEY available: ${!!process.env.CHAT_ENCRYPTION_KEY}`)
          console.log(`🔍 CHAT_ENCRYPTION_KEY length: ${process.env.CHAT_ENCRYPTION_KEY?.length || 0}`)
          
          const decrypted = decryptObject(dbConnection.schema_info_encrypted) as { schema: {tables?: Array<{name: string, columns?: Array<{name: string}>}>, views?: Array<{name: string, columns?: Array<{name: string}>}>} }
          console.log(`🔍 Decrypted schema structure:`, Object.keys(decrypted))
          console.log(`🔍 Schema keys:`, decrypted.schema ? Object.keys(decrypted.schema) : 'No schema')
          
          schema = decrypted.schema
          console.log(`✅ Successfully decrypted schema for database ${dbConnection.name}`)
          console.log(`🔍 Schema has ${schema?.tables?.length || 0} tables`)
          console.log(`🔍 Schema has ${schema?.views?.length || 0} views`)
          
          // Check if tables are in a different structure
          const decryptedWithTables = decrypted as { schema?: {tables?: Array<{name: string, columns?: Array<{name: string}>}>, views?: Array<{name: string, columns?: Array<{name: string}>}>}; tables?: Array<{name: string, columns?: Array<{name: string}>}> }
          if (schema && !schema.tables && decryptedWithTables.tables) {
            console.log(`🔍 Found tables in root level: ${decryptedWithTables.tables.length}`)
            schema.tables = decryptedWithTables.tables
          }
          
          // Check for selected_tables_encrypted filtering
          if (dbConnection.selected_tables_encrypted) {
            try {
              const decryptedTables = decryptObject(dbConnection.selected_tables_encrypted)
              console.log(`🔍 Selected tables:`, decryptedTables)
              
              // If selected tables exist, filter the schema
              if (decryptedTables.selectedTables && Array.isArray(decryptedTables.selectedTables) && decryptedTables.selectedTables.length > 0) {
                const selectedTableNames = decryptedTables.selectedTables.map((t: {table_name: string}) => t.table_name)
                console.log(`🔍 Filtering to selected tables:`, selectedTableNames)
                
                if (schema && schema.tables) {
                  const originalTableCount = schema.tables.length
                  const filteredTables = schema.tables.filter((table: {name: string}) => selectedTableNames.includes(table.name))
                  
                  // Apply filtering and log the result
                  schema.tables = filteredTables
                  console.log(`🔍 Filtered tables from ${originalTableCount} to ${schema.tables.length}`)
                  
                  // If filtering results in 0 tables, this is an error condition
                  if (filteredTables.length === 0 && originalTableCount > 0) {
                    console.log(`❌ ERROR: Filtering resulted in 0 tables from ${originalTableCount} available tables`)
                    console.log(`❌ Selected table names: ${selectedTableNames.join(', ')}`)
                    console.log(`❌ Available table names: ${schema.tables.map((t: {name: string}) => t.name).join(', ')}`)
                  }
                }
                
                if (schema && schema.views) {
                  const originalViewCount = schema.views.length
                  
                  // For views, we should keep them all since selected_tables_encrypted typically only contains tables
                  // Views are usually included by default unless explicitly excluded
                  console.log(`🔍 Keeping all ${originalViewCount} views (views are not typically filtered by selected_tables)`)
                  
                  // Only filter views if they are explicitly mentioned in selected tables
                  const viewNames = schema.views.map((v: {name: string}) => v.name)
                  const selectedViewNames = selectedTableNames.filter(name => viewNames.includes(name))
                  
                  if (selectedViewNames.length > 0) {
                    // Some views are explicitly selected, filter to only those
                    const filteredViews = schema.views.filter((view: {name: string}) => selectedViewNames.includes(view.name))
                    schema.views = filteredViews
                    console.log(`🔍 Filtered views to explicitly selected ones: ${filteredViews.length} views`)
                  } else {
                    // No views explicitly selected, keep all views
                    console.log(`🔍 No views explicitly selected, keeping all ${originalViewCount} views`)
                  }
                }
              } else {
                console.log(`🔍 No selected tables found, using all tables from schema`)
              }
            } catch (error) {
              console.error('❌ Error decrypting selected tables:', error)
            }
          }
          
          // Debug: Show full schema structure (first 500 chars)
          console.log(`🔍 Full schema structure:`, JSON.stringify(schema, null, 2).substring(0, 500) + '...')
          
          // Debug: Show table names specifically
          if (schema && schema.tables) {
            console.log(`🔍 Table names in schema:`, schema.tables.map((t: {name: string}) => t.name))
          }
          if (schema && schema.views) {
            console.log(`🔍 View names in schema:`, schema.views.map((v: {name: string}) => v.name))
          }
        } catch (error) {
          console.error('❌ Error decrypting schema for query generation:', error)
          console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error')
        }
      }
      
        // If schema has 0 tables due to filtering, try to get unfiltered schema
        if (schema && (!schema.tables || schema.tables.length === 0) && (!schema.views || schema.views.length === 0)) {
          console.log('🔍 Schema has 0 tables/views, attempting to fetch unfiltered schema...')
          try {
            const { data: unfilteredConnection } = await supabase
              .from('database_connections')
              .select('schema_info_encrypted')
              .eq('id', dbConnection.id)
              .single()
            
            if (unfilteredConnection?.schema_info_encrypted) {
              const unfilteredDecrypted = decryptObject(unfilteredConnection.schema_info_encrypted) as { schema: {tables?: Array<{name: string, columns?: Array<{name: string}>}>, views?: Array<{name: string, columns?: Array<{name: string}>}>} }
              const unfilteredSchema = unfilteredDecrypted.schema
              
              if (unfilteredSchema && ((unfilteredSchema.tables?.length || 0) > 0 || (unfilteredSchema.views?.length || 0) > 0)) {
                console.log(`✅ Found unfiltered schema with ${unfilteredSchema.tables?.length || 0} tables and ${unfilteredSchema.views?.length || 0} views`)
                schema = unfilteredSchema
              }
            }
          } catch (error) {
            console.error('❌ Error fetching unfiltered schema:', error)
          }
        }
        
        // Generate intelligent SQL query using AI with full schema information
      let query = ''
      let queryType = 'SELECT'
      
        // Initialize SQL tokens counter
        let sqlTokens = 0
        
        if (schema && ((schema.tables && schema.tables.length > 0) || (schema.views && schema.views.length > 0))) {
        // Use the pre-extracted schema to generate proper queries
        const allTables = [...(schema.tables || []), ...(schema.views || [])]
        const tableNames = allTables.map((t: {name: string}) => t.name)
        console.log(`📊 Available tables: ${(schema.tables || []).map((t: {name: string}) => t.name).join(', ')}`)
        console.log(`📊 Available views: ${(schema.views || []).map((v: {name: string}) => v.name).join(', ')}`)
        console.log(`📊 Total available objects: ${tableNames.join(', ')}`)
        
        // Generate intelligent SQL query using AI with full schema
        try {
          console.log(`🤖 Generating SQL query using AI with full schema...`)
          
          const sqlPrompt = `You are a SQL query generation expert. Generate a precise SQL query based on the user question and database schema.

Database Schema:
${JSON.stringify(schema, null, 2)}

User Question: "${userQuery}"

Generate a SQL query that:
1. Uses the correct table/view names from the schema
2. Uses appropriate column names from the schema
3. Includes proper WHERE clauses based on the user's question
4. Uses appropriate aggregation functions (COUNT, SUM, etc.) when needed
5. Returns complete results without LIMIT clauses

Return ONLY a valid JSON response:
{
  "query": "SELECT ... FROM ... WHERE ...",
  "query_type": "SELECT|COUNT|INSERT|UPDATE|DELETE",
  "reasoning": "Why this query answers the user's question",
  "tables_used": ["table1", "table2"],
  "columns_used": ["column1", "column2"]
}

IMPORTANT: Return ONLY the JSON object, no additional text.`

          const sqlResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a SQL query generation expert. Respond with valid JSON only.' },
              { role: 'user', content: sqlPrompt }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })

          const sqlResult = JSON.parse(sqlResponse.choices[0]?.message?.content || '{}')
          sqlTokens = sqlResponse.usage?.total_tokens || 0
          query = sqlResult.query || ''
          queryType = sqlResult.query_type || 'SELECT'
          
          console.log(`🎯 AI Generated SQL: ${query}`)
          console.log(`🎯 Query Type: ${queryType}`)
          console.log(`🎯 Reasoning: ${sqlResult.reasoning}`)
          console.log(`🎯 SQL Generation Tokens: ${sqlTokens}`)
          
        } catch (sqlError) {
          console.error('❌ AI SQL generation failed, using fallback:', sqlError)
          sqlTokens = 0 // No tokens used for fallback
          
          // Fallback to simple pattern matching
      if (userQuery.toLowerCase().includes('count') || userQuery.toLowerCase().includes('how many')) {
            const relevantTable = findRelevantTable(userQuery, allTables)
            if (relevantTable) {
              query = `SELECT COUNT(*) as count FROM ${relevantTable.name}`
        queryType = 'COUNT'
              console.log(`🔄 Fallback COUNT query for table: ${relevantTable.name}`)
            } else {
              query = `SELECT COUNT(*) as count FROM ${tableNames[0]}`
              queryType = 'COUNT'
              console.log(`🔄 Fallback COUNT query for table/view: ${tableNames[0]}`)
            }
          } else {
            const relevantTable = findRelevantTable(userQuery, allTables)
            if (relevantTable) {
              query = `SELECT * FROM ${relevantTable.name}`
        queryType = 'SELECT'
              console.log(`🔄 Fallback SELECT query for table: ${relevantTable.name}`)
      } else {
              query = `SELECT * FROM ${tableNames[0]}`
        queryType = 'SELECT'
              console.log(`🔄 Fallback SELECT query for table/view: ${tableNames[0]}`)
            }
          }
        }
        } else {
          // No schema available - this is an error condition
          console.log('❌ ERROR: No schema available for database query generation')
          query = ''
          queryType = 'ERROR'
          sqlTokens = 0 // No tokens used for error case
        }
      
        if (queryType === 'ERROR') {
          console.log('❌ Cannot execute query - no schema available')
          return {
            success: false,
            data: null,
            execution_time_ms: 0,
            error_message: 'No database schema available for query generation',
            metadata: {
              database_id: source.id,
              database_type: source.connection_type,
              tables_accessed: [],
              confidence_score: 0.0,
              processing_status: 'failed'
            },
            tokens_used: 0,
            processing_time_ms: Date.now() - startTime
          }
        }
        
        console.log(`🔍 Executing query: ${query}`)
      
      // Execute the query using the database connection
      // This would integrate with the actual database connection system
      const queryResult = await executeDatabaseQuery(dbConnection, query)
      
      const result = {
        success: true,
        data: queryResult.rows || [],
        query_executed: query,
        execution_time_ms: queryResult.execution_time || 100,
        rows_affected: queryResult.rows?.length || 0,
        metadata: {
          database_id: source.id,
          database_type: source.connection_type,
          tables_accessed: queryResult.tables_accessed || [],
          confidence_score: query ? 0.9 : 0.5, // Higher confidence if query was generated successfully
          processing_status: 'completed'
        },
        tokens_used: sqlTokens,
        processing_time_ms: Date.now() - startTime
      }
      
      console.log(`✅ Database Execution Coordinator: Completed ${source.name}`)
      return result
      
    } catch (queryError) {
      console.error('Database query execution error:', queryError)
      throw new Error(`Query execution failed: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`)
    }
    
  } catch (error) {
    console.error('Database Execution Coordinator error:', error)
    throw error
  }
}

/**
 * External API Execution Coordinator - Executes API calls and web scraping
 */
export async function externalAPIExecutionCoordinator(
  source: DataSource,
  userQuery: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<ExternalAPIResult> {
  const startTime = Date.now()
  
  try {
    console.log(`🌐 External API Execution Coordinator: Processing ${source.name}...`)
    
    // For now, return a mock result - in production, this would execute actual API calls
    // This would integrate with web scraping and external API systems
    const mockResult = {
      success: true,
      data: [{
        api_response: `Mock API result for query: "${userQuery}"`,
        content: 'Sample external data content',
        metadata: {
          source_url: 'https://example.com/api',
          response_size: '2KB',
          data_freshness: '2024-01-01T00:00:00Z'
        }
      }],
      api_endpoint: 'https://example.com/api',
      execution_time_ms: 800,
      response_status: 200,
      metadata: {
        source_type: source.type,
        source_id: source.id,
        confidence_score: 0.5, // Lower confidence for mock API responses
        processing_status: 'completed'
      },
      tokens_used: 0, // No AI calls in mock implementation
      processing_time_ms: Date.now() - startTime
    }
    
    console.log(`✅ External API Execution Coordinator: Completed ${source.name}`)
    return mockResult
    
  } catch (error) {
    console.error('External API Execution Coordinator error:', error)
    throw error
  }
}

/**
 * Visual Agent - Uses LLM to intelligently determine if visualization would enhance the response
 */
export async function visualAgent(
  userQuery: string,
  sourceResults: Array<DatabaseExecutionResult | ExternalAPIResult>,
  qaResponse: MultiSourceQAResponse
): Promise<{
  visualization_required: boolean;
  chart_type: "bar" | "line" | "pie" | "scatter" | "heatmap" | "table";
  reasoning: string;
  confidence_score: number;
}> {
  try {
    console.log('🎨 Visual Agent: Analyzing visualization requirements with LLM...')
    
    // Check if we have data that could be visualized
    const hasData = sourceResults.some(result => 
      result.success && result.data && 
      (Array.isArray(result.data) || typeof result.data === 'object')
    )
    
    if (!hasData) {
      return {
        visualization_required: false,
        chart_type: "table",
        reasoning: "No data available for visualization",
        confidence_score: 0.1
      }
    }
    
    // Prepare data summary for LLM analysis
    const dataSummary = sourceResults
      .filter(result => result.success && result.data)
      .map((result, index) => {
        let dataInfo = ""
        if (Array.isArray(result.data)) {
          dataInfo = `Dataset ${index + 1}: Array with ${result.data.length} items`
          if (result.data.length > 0) {
            const sample = result.data[0]
            if (typeof sample === 'object') {
              dataInfo += `, columns: ${Object.keys(sample).join(', ')}`
              // Add sample values for better analysis
              const sampleValues = Object.entries(sample).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ')
              dataInfo += `, sample: {${sampleValues}}`
            }
          }
        } else if (typeof result.data === 'object' && result.data !== null) {
          dataInfo = `Dataset ${index + 1}: Object with keys: ${Object.keys(result.data).join(', ')}`
          // Add sample values
          const sampleValues = Object.entries(result.data).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ')
          dataInfo += `, sample: {${sampleValues}}`
        }
        return dataInfo
      })
      .join('; ')
    
    // Create LLM prompt for visualization analysis
    const visualizationPrompt = `Analyze if a visualization would help answer this question.

USER QUESTION: "${userQuery}"

AVAILABLE DATA: ${dataSummary}

QA RESPONSE SUMMARY: ${qaResponse.content.substring(0, 500)}...

Respond with ONLY a valid JSON object in this exact format:
{
  "visualization_required": true,
  "chart_type": "bar",
  "reasoning": "A bar chart would help compare the different categories",
  "confidence_score": 0.8
}

Chart type options: "bar", "line", "pie", "scatter", "heatmap", "table", "treemap", "sankey", "radar", "bubble", "area", "donut", "gauge", "funnel", "waterfall", "candlestick", "boxplot", "violin", "ridge", "streamgraph", "choropleth", "bubble_map", "heat_map", "symbol_map", "flow_map", "cartogram"

Consider:
- Does the question ask for comparisons, trends, distributions, or relationships?
- Would visual representation make the answer clearer?
- What type of data relationships exist?
- Is the data suitable for the recommended chart type?
- What would create the most engaging and insightful visualization?
- How can we make this data story more compelling?
- What visualization would be most visually striking and memorable?
- How can we create a 'wow' moment for the user?
- What advanced chart type would best showcase this data's story?
- Consider creative alternatives: treemaps for hierarchical data, sankey for flows, radar for multi-dimensional comparisons
- Look for geographic data: countries, states, cities, coordinates, addresses, postal codes
- If geographic data is present, consider choropleth, bubble_map, heat_map, or symbol_map

Chart type guidelines:
- "bar": Good for comparing categories, counts, totals
- "line": Good for trends over time, continuous data
- "pie": Good for showing parts of a whole, percentages
- "scatter": Good for showing correlations between two variables
- "treemap": Excellent for hierarchical data and part-to-whole relationships
- "sankey": Perfect for showing flow between categories
- "radar": Great for multi-dimensional comparisons
- "bubble": Ideal for 3-variable relationships (x, y, size)
- "area": Beautiful for showing cumulative trends
- "donut": Modern alternative to pie charts
- "gauge": Perfect for KPIs and performance metrics
- "funnel": Great for conversion analysis
- "waterfall": Excellent for showing cumulative effects
- "heatmap": Perfect for correlation matrices and patterns
- "table": When data is better presented as text/numbers

GEOGRAPHIC VISUALIZATIONS:
- "choropleth": Perfect for showing data by geographic regions (countries, states, counties)
- "bubble_map": Great for showing data points with size variation on geographic locations
- "heat_map": Excellent for showing density or intensity across geographic areas
- "symbol_map": Ideal for showing categorical data at specific geographic points
- "flow_map": Perfect for showing movement, migration, or connections between locations
- "cartogram": Great for distorting geographic areas based on data values

Return ONLY the JSON object, no other text.`

    // Call OpenAI for visualization analysis
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a data visualization expert. Always respond with valid JSON only. No explanations, no markdown, just pure JSON."
        },
        {
          role: "user",
          content: visualizationPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" }
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    if (!responseText) {
      console.warn('No response from LLM, using fallback')
      return {
        visualization_required: false,
        chart_type: "table",
        reasoning: "No response from LLM",
        confidence_score: 0.1
      }
    }

    // Parse LLM response with better error handling
    let analysis
    try {
      // Clean the response text to extract JSON
      let cleanResponse = responseText
      
      // Remove any markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      
      // Try to find JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanResponse = jsonMatch[0]
      }
      
      analysis = JSON.parse(cleanResponse)
    } catch (error) {
      console.error('Failed to parse LLM response:', responseText, error)
      console.warn('Using fallback analysis due to JSON parsing error')
      
      // Fallback analysis based on query content
      const lowerQuery = userQuery.toLowerCase()
      const hasCountWords = lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total') || lowerQuery.includes('sum')
      const hasCompareWords = lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')
      
      analysis = {
        visualization_required: hasCountWords || hasCompareWords,
        chart_type: hasCountWords ? "bar" : "table",
        reasoning: "Fallback analysis due to JSON parsing error",
        confidence_score: 0.3
      }
    }

    // Validate and sanitize the response
    const visualizationRequired = Boolean(analysis.visualization_required)
    const chartType = ["bar", "line", "pie", "scatter", "heatmap", "table"].includes(analysis.chart_type) 
      ? analysis.chart_type 
      : "table"
    const reasoning = String(analysis.reasoning || "LLM analysis completed")
    const confidenceScore = Math.max(0, Math.min(1, Number(analysis.confidence_score) || 0.5))
    
    console.log(`🎨 Visual Agent: ${visualizationRequired ? 'Visualization recommended' : 'No visualization needed'}`)
    console.log(`🎨 Chart type: ${chartType}, Confidence: ${(confidenceScore * 100).toFixed(1)}%`)
    console.log(`🎨 Reasoning: ${reasoning}`)
    
    return {
      visualization_required: visualizationRequired,
      chart_type: chartType,
      reasoning,
      confidence_score: confidenceScore
    }
    
  } catch (error) {
    console.error('Visual Agent error:', error)
    return {
      visualization_required: false,
      chart_type: "table",
      reasoning: "Error analyzing visualization requirements with LLM",
      confidence_score: 0.1
    }
  }
}



/**
 * Graph Agent - Creates ready-to-render visualization code from SQL data
 * Much simpler approach: Generate complete HTML/JS code that frontend can directly render
 */
export async function graphAgent(
  userQuery: string,
  sourceResults: Array<DatabaseExecutionResult | ExternalAPIResult>,
  visualDecision: {
    visualization_required: boolean;
    chart_type: string;
    reasoning: string;
    confidence_score: number;
  }
): Promise<{
  visualization_type: 'interactive' | 'static' | 'both';
  chart_data: Record<string, unknown>;
  chart_config: {
    library: 'd3' | 'chartjs' | 'plotly' | 'observable_plot';
    chart_type: string;
    interactive_features: string[];
    animation_config?: Record<string, unknown>;
    color_scheme: string;
  };
  html_content: string;
  image_url?: string;
  alt_text: string;
  screen_reader_description: string;
}> {
  try {
    console.log('📊 Graph Agent: Creating visualization...')
    
    if (!visualDecision.visualization_required) {
      return {
        visualization_type: 'static',
        chart_data: {},
        chart_config: {
          library: 'd3',
          chart_type: 'table',
          interactive_features: [],
          color_scheme: 'default'
        },
        html_content: '<div>No visualization data available</div>',
        alt_text: "No visualization available",
        screen_reader_description: "No visualization was generated for this response"
      }
    }
    
    // Extract data from source results
    const firstResult = sourceResults.find(r => r.success && r.data)
    if (!firstResult || !firstResult.data) {
      console.warn('No data available for visualization, returning fallback')
      return {
        visualization_type: 'static',
        chart_data: {},
        chart_config: {
          library: 'd3',
          chart_type: 'table',
          interactive_features: [],
          color_scheme: 'default'
        },
        html_content: '<div>No data available for visualization</div>',
        alt_text: "No data available",
        screen_reader_description: "No data was available to generate a visualization"
      }
    }
    
    // Generate D3.js visualization code
    const codeGenerationPrompt = `You are a data visualization expert. Generate D3.js code for a ${visualDecision.chart_type} chart.

USER QUESTION: "${userQuery}"
CHART TYPE: ${visualDecision.chart_type}
REASONING: ${visualDecision.reasoning}

SQL DATA: ${JSON.stringify(firstResult.data, null, 2)}

Generate a complete HTML div with embedded D3.js code that:
1. Creates a ${visualDecision.chart_type} chart using D3.js
2. Uses the provided SQL data directly
3. Has interactive features (hover, tooltips, zoom if applicable)
4. Is responsive and accessible
5. Shows the data clearly with proper styling
6. INCLUDES DATA LABELS on all data points/bars
7. INCLUDES LEGENDS where applicable
8. Has proper chart title and axis labels
9. CHART TITLE: Create a descriptive, professional title based on the user's question and data
10. NO CODE BLOCKS: Return only clean HTML/JS code, no markdown code blocks or explanations

Requirements:
- Use D3.js library (assume it's loaded as 'd3')
- Create a BEAUTIFUL, ENGAGING visual representation of the data
- Use the SQL data as-is, don't try to restructure it
- Make the chart title relevant to the user's question
- Use MODERN, SOPHISTICATED styling with dark theme
- Include proper labels and tooltips
- Make it responsive (width: 100%, height: 400px minimum)
- Add SMOOTH, ELEGANT interactive features like hover effects
- ADD DATA LABELS: Show values on bars, points, or segments
- ADD LEGENDS: Include legends for multiple data series
- ADD AXIS LABELS: Clear x-axis and y-axis labels
- ADD CHART TITLE: Descriptive title at the top
- Ensure minimum dimensions: width=600px, height=400px
- Use viewBox for proper scaling: viewBox="0 0 600 400"
- Add proper margins and padding (at least 60px on all sides)

DESIGN PRINCIPLES - CREATE BEAUTIFUL VISUALIZATIONS:
- Use GRADIENT COLORS: Beautiful color gradients instead of flat colors
- Add SHADOWS and GLOWS: Subtle drop shadows and glow effects
- SMOOTH ANIMATIONS: Elegant transitions and hover animations
- MODERN TYPOGRAPHY: Clean, readable fonts with proper hierarchy
- VISUAL HIERARCHY: Use size, color, and spacing to guide attention
- COLOR HARMONY: Use complementary or analogous color schemes
- MICRO-INTERACTIONS: Subtle hover effects, scaling, and color changes
- PROFESSIONAL STYLING: Corporate-grade visual quality

SPECIFIC CHART ENHANCEMENTS:
- For bar charts: Rounded corners, gradients, shadows, smooth hover effects
- For line charts: Smooth curves, gradient fills, animated data points
- For pie/donut charts: Gradient fills, inner shadows, smooth animations
- For scatter plots: Gradient bubbles, smooth scaling on hover
- For treemaps: Beautiful nested rectangles with gradients
- For sankey: Flowing, organic curves with gradient fills
- For radar: Smooth curves with gradient fills and glow effects
- For gauges: Modern, sleek design with gradient arcs
- For heatmaps: Beautiful color scales with smooth transitions

GEOGRAPHIC MAP ENHANCEMENTS:
- For choropleth maps: Beautiful gradient fills, smooth transitions, hover effects with data tooltips
- For bubble maps: Gradient-filled circles with smooth scaling, animated bubbles
- For heat maps: Beautiful color gradients, smooth transitions, interactive legends
- For symbol maps: Modern icons with gradients and shadows, smooth animations
- For flow maps: Curved, flowing lines with gradients, animated flow effects
- For cartograms: Smooth area distortions with gradient fills and hover effects

GEO MAP REQUIREMENTS:
- Use D3.js geo projections (geoMercator, geoAlbers, geoEqualEarth, etc.)
- Include world, country, or state-level geographic data
- Add zoom and pan functionality for interactive exploration
- Include beautiful basemaps with subtle styling
- Add geographic boundaries with elegant stroke styling
- Include interactive legends and color scales
- Add smooth hover effects with detailed tooltips
- Use modern map styling with subtle shadows and gradients

Return ONLY the complete HTML div with embedded D3.js code, no additional text or explanations.`

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let completion
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a world-class data visualization designer and D3.js expert with expertise in geographic visualizations. Create STUNNING, PROFESSIONAL visualizations that follow modern design principles. Generate complete, ready-to-render HTML with embedded D3.js code for interactive charts and maps. Use D3.js for all visualizations - assume 'd3' is available globally. CRITICAL: Create BEAUTIFUL visualizations with gradients, shadows, smooth animations, and modern styling. For geographic maps, use D3.js geo projections and include interactive zoom/pan functionality. Always include data labels on all data points/bars and legends where applicable. Ensure charts are fully visible with proper margins and sizing. Focus on creating engaging, visually appealing charts that tell a compelling data story. CRITICAL: Return ONLY clean HTML/JS code - NO markdown code blocks (```), NO explanations, NO text outside the HTML. The output should be directly renderable HTML."
          },
          {
            role: "user",
            content: codeGenerationPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    } catch (llmError) {
      console.error('LLM call failed in Graph Agent:', llmError)
      return {
        visualization_type: 'static',
        chart_data: {
          raw_data: firstResult.data,
          chart_type: visualDecision.chart_type
        },
        chart_config: {
          library: 'd3',
          chart_type: visualDecision.chart_type,
          interactive_features: [],
          color_scheme: 'default'
        },
        html_content: '<div>Error generating visualization</div>',
        alt_text: "Visualization error",
        screen_reader_description: "An error occurred while generating the visualization"
      }
    }

    const htmlContent = completion.choices[0]?.message?.content?.trim()
    if (!htmlContent) {
      console.warn('No HTML code generated by LLM, using fallback')
      return {
        visualization_type: 'static',
        chart_data: {
          raw_data: firstResult.data,
          chart_type: visualDecision.chart_type
        },
        chart_config: {
          library: 'd3',
          chart_type: visualDecision.chart_type,
          interactive_features: [],
          color_scheme: 'default'
        },
        html_content: '<div>Error generating visualization</div>',
        alt_text: "Visualization error",
        screen_reader_description: "An error occurred while generating the visualization"
      }
    }

    console.log('📊 Graph Agent: Generated HTML code length:', htmlContent.length)
    console.log('📊 Graph Agent: HTML preview:', htmlContent.substring(0, 200) + '...')
    console.log('📊 Graph Agent: Full HTML content:', htmlContent)
    
    // Return the generated D3.js HTML code
    const chartType = visualDecision.chart_type
    const chartConfig = {
      library: 'd3' as const,
      chart_type: chartType,
      interactive_features: ['hover_animation', 'click_legend', 'responsive_resize', 'zoom', 'tooltips'],
      color_scheme: 'default'
    }
    
    console.log(`📊 Graph Agent: Generated ${chartType} chart HTML code`)
    console.log(`📊 Chart type: ${chartType}`)
    console.log(`📊 User query: ${userQuery}`)
    
    return {
      visualization_type: 'interactive',
      chart_data: {
        raw_data: firstResult.data,
        chart_type: chartType
      },
      chart_config: chartConfig,
      html_content: htmlContent,
      alt_text: `${chartType} chart for: ${userQuery}`,
      screen_reader_description: `${chartType} chart displaying data for: ${userQuery}`
    }
    
  } catch (error) {
    console.error('Graph Agent error:', error)
    console.error('Graph Agent error details:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userQuery,
      visualDecision,
      sourceResultsCount: sourceResults.length,
      hasData: sourceResults.some(r => r.success && r.data)
    })
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error)
    let userFriendlyMessage = "Error generating visualization"
    
    if (errorMessage.includes('No real data values available')) {
      userFriendlyMessage = "Unable to create visualization: No real data values found in the results"
    } else if (errorMessage.includes('could not extract meaningful chart labels')) {
      userFriendlyMessage = "Unable to create visualization: Could not extract meaningful data labels"
    } else if (errorMessage.includes('Invalid JSON response')) {
      userFriendlyMessage = "Unable to create visualization: Data processing error"
    }
    
    return {
      visualization_type: 'static',
      chart_data: {},
      chart_config: {
        library: 'chartjs',
        chart_type: 'table',
        interactive_features: [],
        color_scheme: 'default'
      },
      html_content: `<div style="padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px; margin: 10px 0;">
        <h4 style="margin: 0 0 10px 0; color: #333;">Visualization Unavailable</h4>
        <p style="margin: 0; font-size: 14px;">${userFriendlyMessage}</p>
      </div>`,
      alt_text: "Visualization unavailable",
      screen_reader_description: userFriendlyMessage
    }
  }
}

/**
 * Multi-Source Q&A Agent - Combines results from all data sources
 */
export async function multiSourceQAAgent(
  userQuery: string,
  sourceResults: Array<DatabaseExecutionResult | ExternalAPIResult>,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<MultiSourceQAResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🤖 Multi-Source Q&A Agent: Combining results from all sources...')
    
    if (sourceResults.length === 0) {
      throw new Error('No data sources were successfully processed')
    }

    // Analyze conversation context to detect clarification responses
    const isClarificationResponse = await detectClarificationResponse(userQuery, conversationHistory)
    console.log('🤖 Multi-Source Q&A Agent: Clarification detection:', isClarificationResponse)
    
    // Prepare source data for AI processing
    const sourceData = sourceResults.map((result, index) => {
      const isDatabase = 'query_executed' in result
      return {
        source_index: index + 1,
        source_type: isDatabase ? 'database' : 'external_api',
        success: result.success,
        data: result.data,
        execution_time_ms: result.execution_time_ms,
        confidence_score: result.metadata.confidence_score,
        error_message: result.error_message
      }
    })
    
    // Build conversation context for the prompt
    const recentConversation = conversationHistory.slice(-4).map(msg => 
      `${msg.sender_type}: ${msg.content}`
    ).join('\n')

    const qaPrompt = `You are a Multi-Source Q&A Agent. Combine results from multiple data sources to provide a comprehensive answer.

User Query: "${userQuery}"

Recent Conversation Context:
${recentConversation || 'No previous conversation'}

${isClarificationResponse.isClarification ? `
CLARIFICATION CONTEXT: The user is providing clarification to a previous question. The previous agent response was: "${isClarificationResponse.previousAgentResponse}". Use this context to better understand what the user is clarifying.
` : ''}

Source Results:
${sourceData.map(source => `
Source ${source.source_index} (${source.source_type}):
Success: ${source.success}
Confidence: ${source.confidence_score}
Execution Time: ${source.execution_time_ms}ms
Data: ${JSON.stringify(source.data, null, 2)}
${source.error_message ? `Error: ${source.error_message}` : ''}
`).join('\n')}

Your task:
1. Analyze all source results and identify key insights
2. Combine information from multiple sources when relevant
3. Identify any conflicting information between sources
4. Provide a comprehensive, well-structured response
5. Include source attributions for transparency
6. Suggest relevant follow-up questions based on the data and user's query
7. Determine if clarification is needed (low confidence, conflicting data, ambiguous query)
8. Generate contextual follow-up questions that build on the current response

${isClarificationResponse.isClarification ? `
CLARIFICATION HANDLING:
- The user is providing clarification to a previous question
- Use the conversation context to understand what they're clarifying
- Acknowledge their clarification and provide a more targeted response
- Don't repeat the clarification request - they've already provided it
- Focus on answering their original question with the new context they've provided
` : ''}

Response Guidelines:
- Be direct and comprehensive - answer the user's question clearly and completely
- Focus on the key information requested
- Use **bold** for important numbers and facts
- Structure complex data with bullet points or numbered lists when appropriate
- Use *italic* for emphasis on key insights
- Provide detailed analysis when the data warrants it - don't artificially limit response length
- Include relevant examples and specific data points from the results
- Avoid mentioning technical details like confidence scores, execution times, or processing metadata
- Maintain a conversational, helpful tone
- Format location-based data clearly (e.g., "In Hyderabad: 1,269 donors")
- Use proper formatting for large numbers (e.g., "1,269" instead of "1269")

Follow-up Question Guidelines:
- Generate 2-3 relevant follow-up questions that build on the current response
- Questions should be specific to the data presented (e.g., "Which blood group has the lowest donor count in Hyderabad?")
- Avoid generic questions like "What would you like to explore next?"
- Consider comparative questions (e.g., "How do these numbers compare to other cities?")
- Consider trend questions (e.g., "Has this changed over time?")
- Consider drill-down questions (e.g., "What about specific age groups?")

Clarification Detection:
- Set clarification_needed to true if:
  * Query is ambiguous or could have multiple interpretations
  * Data sources provide conflicting information
  * Confidence in the answer is low (< 0.7)
  * Key information is missing from available data
- Provide specific uncertainty_reasons when clarification is needed

Respond with JSON:
{
  "content": "Direct answer to the user's question...",
  "primary_insights": ["Key insight 1", "Key insight 2"],
  "supporting_evidence": ["Evidence from source 1", "Evidence from source 2"],
  "conflicting_information": ["Any conflicts found"],
  "gaps_identified": ["Any information gaps"],
  "source_attributions": [
    {
      "source_type": "database",
      "source_id": "source_1",
      "contribution": "Provided sales data and revenue metrics",
      "confidence_score": 0.9,
      "data_points_used": 150,
      "processing_time_ms": 200
    }
  ],
  "follow_up_questions": ["What would you like to explore next?"],
  "clarification_needed": false,
  "uncertainty_reasons": [],
  "confidence_assessment": "High confidence based on multiple data sources"
}`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a Multi-Source Q&A Agent. Provide direct, comprehensive answers to user questions. Avoid technical jargon and metadata. Respond with valid JSON only.' },
        { role: 'user', content: qaPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const qaResult = JSON.parse(response.choices[0]?.message?.content || '{}')
    const tokensUsed = response.usage?.total_tokens || 0
    
    const processingTime = Date.now() - startTime
    
    return {
      content: qaResult.content || "I was unable to generate a comprehensive response from the available data sources.",
      source_attributions: qaResult.source_attributions || [],
      data_synthesis: {
        primary_insights: qaResult.primary_insights || [],
        supporting_evidence: qaResult.supporting_evidence || [],
        conflicting_information: qaResult.conflicting_information,
        gaps_identified: qaResult.gaps_identified,
        cross_source_validation: sourceResults.length > 1,
        confidence_assessment: qaResult.confidence_assessment || 'Moderate confidence based on available data'
      },
      follow_up_questions: qaResult.follow_up_questions || [],
      clarification_needed: qaResult.clarification_needed || false,
      uncertainty_reasons: qaResult.uncertainty_reasons || [],
      tokens_used: tokensUsed,
      processing_time_ms: processingTime,
      metadata: {
        total_sources_processed: sourceResults.length,
        processing_strategy: 'multi_source_analysis',
        confidence_score: qaResult.confidence_score || 0.7,
        response_quality_score: qaResult.response_quality_score || 0.8
      }
    }
    
  } catch (error) {
    console.error('Multi-Source Q&A Agent error:', error)
    throw error
  }
}

/**
 * Main Enhanced Multi-Agent Flow Processor
 */
export async function processWithEnhancedMultiAgentFlow(
  userQuery: string,
  workspaceId: string,
  agentId: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<EnhancedAgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Enhanced Multi-Agent Flow: Starting processing...')
    
    // Step 0: Guardrails Agent - Check content safety first
    console.log('🛡️ Step 0: Guardrails Agent')
    const guardrailsResult = await guardrailsAgent(userQuery, conversationHistory)
    
    if (!guardrailsResult.allowed) {
      console.log('🚫 Guardrails Agent: Message blocked:', guardrailsResult.reason)
      return {
        content: "I'm sorry, but I can't process that type of request. I'm designed to help with data analysis and business insights. Please ask me questions about your data, files, or business metrics.",
        metadata: {
          processing_status: 'blocked_by_guardrails',
          agent_id: agentId,
          workspace_id: workspaceId,
          data_sources_used: [],
          confidence_score: 0.0
        },
        tokens_used: 30,
        tokens_rounded: getRoundedTokens(30),
        credits_used: tokensToCredits(30),
        processing_time_ms: Date.now() - startTime
      }
    }
    
    // Step 1: Greeting Agent - Check for greetings and small talk
    console.log('👋 Step 1: Greeting Agent')
    const greetingResult = await greetingAgent(userQuery, conversationHistory)
    
    if (greetingResult.isGreeting) {
      console.log('👋 Greeting Agent: Handling greeting response')
      return {
        content: greetingResult.response || "Hello! I'm your AI data analysis assistant. How can I help you analyze your data today?",
        metadata: {
          processing_status: 'greeting_response',
          agent_id: agentId,
          workspace_id: workspaceId,
          data_sources_used: [],
          confidence_score: greetingResult.confidence
        },
        tokens_used: greetingResult.tokens_used,
        tokens_rounded: getRoundedTokens(greetingResult.tokens_used),
        credits_used: tokensToCredits(greetingResult.tokens_used),
        processing_time_ms: Date.now() - startTime
      }
    }
    
    // Step 2: Validation Agent - Validate query and classify intent
    console.log('🔍 Step 2: Validation Agent')
    const validationResult = await validationAgent(userQuery, conversationHistory)
    
    if (!validationResult.is_valid) {
      console.log('❌ Validation Agent: Query invalid:', validationResult.query_type)
      
      let errorMessage = "I'm a data analysis assistant focused on helping you understand your business data, files, and metrics. I can help you with questions about your data trends, insights, and analysis. Could you please ask me something related to your data or business information?"
      
      if (validationResult.query_type === 'irrelevant') {
        errorMessage = "I'm a data analysis assistant focused on helping you understand your business data, files, and metrics. I can help you with questions about your data trends, insights, and analysis. Could you please ask me something related to your data or business information?"
      } else if (validationResult.query_type === 'ambiguous') {
        errorMessage = "I'd be happy to help with your data analysis! Could you please clarify what specific information you're looking for? For example, you could ask about trends, specific metrics, or particular data points."
      }
      
      return {
        content: errorMessage,
        metadata: {
          processing_status: 'validation_failed',
          agent_id: agentId,
          workspace_id: workspaceId,
          data_sources_used: [],
          confidence_score: validationResult.confidence
        },
        tokens_used: validationResult.tokens_used,
        tokens_rounded: getRoundedTokens(validationResult.tokens_used),
        credits_used: tokensToCredits(validationResult.tokens_used),
        processing_time_ms: Date.now() - startTime
      }
    }
    
    // Check if this is a database structure question that can be answered without data query
    const lowerQuery = userQuery.toLowerCase()
    const isSchemaQuestion = lowerQuery.includes('what tables') || 
                           lowerQuery.includes('what columns') || 
                           lowerQuery.includes('database structure') ||
                           lowerQuery.includes('schema') ||
                           lowerQuery.includes('table structure') ||
                           lowerQuery.includes('column names') ||
                           lowerQuery.includes('database schema') ||
                           (lowerQuery.includes('how many') && lowerQuery.includes('tables'))
    
    if (isSchemaQuestion) {
      console.log('🏗️ Detected schema question, using Schema Answer Agent...')
      
      // Get database connections for schema analysis
      const { data: databaseConnections } = await supabase
        .from('database_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
      
      if (databaseConnections && databaseConnections.length > 0) {
        const schemaResponse = await schemaAnswerAgent(userQuery, databaseConnections[0], conversationHistory)
        
        if (!schemaResponse.requires_data_query) {
          return {
            content: schemaResponse.answer,
            metadata: {
              processing_status: 'schema_answer',
              agent_id: agentId,
              workspace_id: workspaceId,
              data_sources_used: [databaseConnections[0].id],
              confidence_score: schemaResponse.confidence_score,
              follow_up_questions: schemaResponse.follow_up_suggestions,
              source_attributions: [{
                source_type: 'database',
                source_id: databaseConnections[0].id,
                contribution: 'Provided database schema information',
                confidence_score: schemaResponse.confidence_score
              }]
            },
            tokens_used: 50, // Minimal tokens for schema answers
            tokens_rounded: getRoundedTokens(50),
            credits_used: tokensToCredits(50),
            processing_time_ms: Date.now() - startTime
          }
        }
      }
    }
    
    // Step 3: Data Source Filter Agent
    console.log('🔍 Step 3: Data Source Filter Agent')
    const filterResponse = await dataSourceFilterAgent(userQuery, workspaceId, conversationHistory)
    
    if (filterResponse.filtered_sources.length === 0) {
      throw new Error('No relevant data sources found in workspace')
    }
    
    // Step 4: Data Source Ranking Agent
    console.log('📊 Step 4: Data Source Ranking Agent')
    const rankingResponse = await dataSourceRankingAgent(userQuery, filterResponse.filtered_sources, conversationHistory)
    
    // Step 5: Execute data retrieval based on strategy
    console.log('⚡ Step 5: Executing data retrieval strategy:', rankingResponse.processing_strategy)
    const sourceResults: Array<DatabaseExecutionResult | ExternalAPIResult> = []
    
    if (rankingResponse.processing_strategy === 'single_source') {
      // Process only the highest-ranked source
      const topSource = rankingResponse.ranked_sources[0]
      if (topSource.type === 'database') {
        const result = await databaseExecutionCoordinator(topSource, userQuery, conversationHistory)
        sourceResults.push(result)
      } else {
        const result = await externalAPIExecutionCoordinator(topSource, userQuery, conversationHistory)
        sourceResults.push(result)
      }
    } else if (rankingResponse.processing_strategy === 'multi_source_parallel') {
      // Process multiple sources in parallel
      const promises = rankingResponse.ranked_sources.map(source => {
        if (source.type === 'database') {
          return databaseExecutionCoordinator(source, userQuery, conversationHistory)
        } else {
          return externalAPIExecutionCoordinator(source, userQuery, conversationHistory)
        }
      })
      
      const results = await Promise.all(promises)
      sourceResults.push(...results)
    } else {
      // Process sources sequentially
      for (const source of rankingResponse.ranked_sources) {
        if (source.type === 'database') {
          const result = await databaseExecutionCoordinator(source, userQuery, conversationHistory)
          sourceResults.push(result)
        } else {
          const result = await externalAPIExecutionCoordinator(source, userQuery, conversationHistory)
          sourceResults.push(result)
        }
      }
    }
    
    // Step 6: Multi-Source Q&A Agent
    console.log('🤖 Step 6: Multi-Source Q&A Agent')
    const qaResponse = await multiSourceQAAgent(userQuery, sourceResults, conversationHistory)
    
    // Step 7: Visual Agent
    console.log('🎨 Step 7: Visual Agent')
    const visualDecision = await visualAgent(userQuery, sourceResults, qaResponse)
    
    // Step 8: Graph Agent (if visualization needed)
    console.log('📊 Step 8: Graph Agent')
    const graphResponse = await graphAgent(userQuery, sourceResults, visualDecision)
    
    // Generate comprehensive token tracking
    const tokenTracking = calculateComprehensiveTokenUsage(
      userQuery,
      'Enhanced Multi-Agent Flow System',
      `Processed ${sourceResults.length} data sources`,
      filterResponse.filter_metadata.tokens_used,
      qaResponse.tokens_used,
      JSON.stringify(sourceResults),
      conversationHistory,
      qaResponse.content
    )
    
    const processingTime = Date.now() - startTime
    
    // Generate XAI metrics and detailed metadata using actual source information
    const filesReferenced = sourceResults.map((result, index) => {
      const isDatabase = 'query_executed' in result
      return {
        id: isDatabase ? `db_${index + 1}` : `api_${index + 1}`,
        name: isDatabase ? `Database Source ${index + 1}` : `API Source ${index + 1}`,
        type: isDatabase ? 'database' as const : 'api_endpoint' as const,
        connection_type: isDatabase ? 'database' : 'api',
        content_type: isDatabase ? 'database' : 'api_response',
        confidence_score: result.metadata.confidence_score || 0.8,
        relevance_score: result.metadata.confidence_score || 0.8,
        processing_strategy: 'single_source' as const,
        estimated_processing_time_ms: result.execution_time_ms || 1000,
        metadata: {
          execution_time_ms: result.execution_time_ms,
          success: result.success,
          ...(isDatabase && result.query_executed ? { query_executed: result.query_executed } : {}),
          ...(isDatabase && result.rows_affected ? { rows_affected: result.rows_affected } : {})
        },
        sections_used: []
      }
    })
    
    const confidenceScore = qaResponse.metadata.confidence_score || 0.7
    
    console.log('🔍 Generating XAI metrics for', sourceResults.length, 'sources')
    
    // Generate XAI metrics based on actual processing results
    const successfulSources = sourceResults.filter(result => result.success).length
    const dataQualityScore = sourceResults.length > 0 ? successfulSources / sourceResults.length : 0
    const responseCompletenessScore = Math.min(confidenceScore + 0.1, 1.0) // Based on confidence with slight boost
    const userSatisfactionPrediction = Math.min(confidenceScore + 0.15, 1.0) // Based on confidence with boost
    const processingEfficiency = Math.min(1.0 - (processingTime / 30000), 1.0) // Better efficiency for faster processing
    const sourceReliability = dataQualityScore // Same as data quality
    
    const xaiMetrics: XAIMetrics = {
      confidence_score: confidenceScore,
      reasoning_steps: [`Analyzed ${sourceResults.length} data sources`, `Successfully processed ${successfulSources} sources`],
      uncertainty_factors: sourceResults.length === 0 ? ['No data sources available'] : 
                          successfulSources < sourceResults.length ? ['Some data sources failed to process'] : 
                          ['Limited to available data sources'],
      data_quality_score: dataQualityScore,
      response_completeness_score: responseCompletenessScore,
      user_satisfaction_prediction: userSatisfactionPrediction,
      processing_efficiency: processingEfficiency,
      source_reliability: sourceReliability
    }
    
    // Generate agent thinking notes based on actual processing
    const agentThinkingNotes = [
      `Analyzed ${sourceResults.length} data sources to answer: "${userQuery}"`,
      ...sourceResults.map((result, index) => {
        const isDatabase = 'query_executed' in result
        if (isDatabase) {
          return `Database query ${index + 1}: ${result.query_executed} (${result.rows_affected || 0} rows)`
        } else {
          const apiResult = result as ExternalAPIResult
          return `API call ${index + 1}: ${apiResult.api_endpoint} (${apiResult.response_status})`
        }
      }),
      `Total processing time: ${processingTime}ms`,
      `Confidence score: ${(confidenceScore * 100).toFixed(1)}%`
    ]
    
    // Extract actual SQL queries from database execution results
    const sqlQueries = sourceResults
      .filter(result => 'query_executed' in result && result.query_executed)
      .map(result => (result as DatabaseExecutionResult).query_executed!)
    
    console.log('🔍 Enhanced Multi-Agent Flow: Generated SQL queries:', sqlQueries)
    console.log('🔍 Enhanced Multi-Agent Flow: Visual decision:', visualDecision)
    console.log('🔍 Enhanced Multi-Agent Flow: Graph response:', graphResponse)
    
    // Use graph data from Graph Agent - structure that matches VisualizationDisplay component
    const graphData = visualDecision.visualization_required ? {
      visualization: {
        visualization_type: graphResponse.visualization_type,
        chart_data: graphResponse.chart_data,
        chart_config: graphResponse.chart_config,
        html_content: graphResponse.html_content,
        alt_text: graphResponse.alt_text,
        screen_reader_description: graphResponse.screen_reader_description
      },
      visual_decision: {
        visualization_required: visualDecision.visualization_required,
        chart_type: visualDecision.chart_type,
        reasoning: visualDecision.reasoning,
        confidence_score: visualDecision.confidence_score
      }
    } : undefined
    
    console.log('🔍 Enhanced Multi-Agent Flow: Final graph data:', graphData)

    // Step 9: Follow-up Agent - Generate contextual follow-up questions
    console.log('💭 Step 9: Follow-up Agent')
    const followUpResult = await followUpAgent(
      userQuery, 
      conversationHistory, 
      qaResponse.content,
      {
        data_sources_used: sourceResults.map((_, index) => `source_${index + 1}`),
        primary_insights: qaResponse.data_synthesis?.primary_insights || [],
        supporting_evidence: qaResponse.data_synthesis?.supporting_evidence || []
      }
    )
    
    // Combine follow-up questions from Q&A agent and Follow-up agent
    const combinedFollowUpQuestions = [
      ...(qaResponse.follow_up_questions || []),
      ...followUpResult.follow_up_questions
    ].slice(0, 3) // Limit to 3 questions
    
    // Calculate total token usage (including new agents)
    const totalTokensUsed = 
      guardrailsResult.tokens_used +
      greetingResult.tokens_used +
      validationResult.tokens_used +
      filterResponse.filter_metadata.tokens_used +
      rankingResponse.metadata.tokens_used +
      sourceResults.reduce((sum, result) => sum + result.tokens_used, 0) +
      qaResponse.tokens_used +
      followUpResult.tokens_used
    
    // Calculate credits used
    const creditsUsed = tokensToCredits(totalTokensUsed)
    
    console.log('✅ Enhanced Multi-Agent Flow: Processing completed')
    const roundedTokens = getRoundedTokens(totalTokensUsed)
    console.log(`📊 Results: ${sourceResults.length} sources processed, ${totalTokensUsed} tokens used (rounded to ${roundedTokens} tokens = ${creditsUsed} credits), ${processingTime}ms`)
    console.log('🔍 About to generate XAI metrics...')
    
    // Check if clarification is needed
    if (qaResponse.clarification_needed) {
      console.log('🤔 Enhanced Multi-Agent Flow: Clarification needed:', qaResponse.uncertainty_reasons)
      
      // Return a clarification response instead of the full analysis
      return {
        content: `I need some clarification to provide you with the most accurate answer. ${qaResponse.uncertainty_reasons.join(' ')} Could you please provide more specific details about what you're looking for?`,
        metadata: {
          processing_status: 'clarification_needed',
          agent_id: agentId,
          workspace_id: workspaceId,
          data_sources_used: sourceResults.map((_, index) => `source_${index + 1}`),
          confidence_score: 0.3, // Low confidence when clarification is needed
          follow_up_questions: qaResponse.follow_up_questions,
          // Note: clarification_reasons would need to be added to the metadata type
        },
        tokens_used: totalTokensUsed,
        tokens_rounded: getRoundedTokens(totalTokensUsed),
        credits_used: creditsUsed,
        processing_time_ms: processingTime,
        token_tracking: {
          userInputTokens: 50,
          systemPromptTokens: 100,
          contextTokens: 200,
          routerAgentTokens: 50,
          qaAgentTokens: 150,
          fileContentTokens: 0,
          conversationHistoryTokens: 100,
          agentResponseTokens: 100,
          totalInputTokens: 350,
          totalProcessingTokens: 300,
          totalOutputTokens: 100,
          totalTokensUsed: totalTokensUsed,
          stageBreakdown: {
            input: 350,
            routing: 50,
            fileProcessing: 100,
            qaGeneration: 150,
            output: 100
          }
        }
      }
    }
    
    // Generate reasoning explanation
    const reasoningExplanation = `Based on the analysis of ${sourceResults.length} relevant data sources, I generated this response with ${(confidenceScore * 100).toFixed(1)}% confidence. The response draws from the available data sources and follows a structured multi-agent analysis approach.`
    
    // Determine analysis depth
    const analysisDepth = sourceResults.length > 0 ? 'deep' : 'standard'
    
    const enhancedResponse = {
      content: qaResponse.content,
      metadata: {
        processing_status: 'completed',
        agent_id: agentId,
        workspace_id: workspaceId,
        data_sources_used: sourceResults.map((_, index) => `source_${index + 1}`),
        confidence_score: confidenceScore,
        follow_up_questions: combinedFollowUpQuestions,
        source_attributions: qaResponse.source_attributions,
        data_synthesis: qaResponse.data_synthesis
      },
      tokens_used: totalTokensUsed,
      tokens_rounded: getRoundedTokens(totalTokensUsed),
      credits_used: creditsUsed,
      processing_time_ms: processingTime,
      // XAI Data
      xai_metrics: xaiMetrics,
      agent_thinking_notes: agentThinkingNotes,
      sql_queries: sqlQueries,
      graph_data: graphData,
      reasoning_explanation: reasoningExplanation,
      analysis_depth: analysisDepth,
      data_quality_score: xaiMetrics.data_quality_score,
      response_completeness_score: xaiMetrics.response_completeness_score,
      user_satisfaction_prediction: xaiMetrics.user_satisfaction_prediction,
      // Comprehensive Token Tracking
      token_tracking: tokenTracking,
      // RAG Context
      rag_context: {
        retrieved_chunks: sourceResults.length,
        similarity_scores: sourceResults.map((result) => {
          const isDatabase = 'query_executed' in result
          return result.metadata.confidence_score || (isDatabase ? 0.8 : 0.7) // Use actual confidence or default
        }),
        source_documents: sourceResults.map((result, index) => {
          const isDatabase = 'query_executed' in result
          return isDatabase ? `Database ${index + 1}` : `API ${index + 1}`
        })
      },
      // Explainability
      explainability: {
        reasoning_steps: [
          `Processed ${sourceResults.length} data sources`,
          ...sourceResults.map((result) => {
            const isDatabase = 'query_executed' in result
            if (isDatabase) {
              return `Database query executed: ${result.query_executed}`
            } else {
              const apiResult = result as ExternalAPIResult
              return `API endpoint called: ${apiResult.api_endpoint}`
            }
          })
        ],
        confidence_score: confidenceScore,
        uncertainty_factors: sourceResults.some(result => !result.success) ? ['Some data sources failed to process'] : []
      },
      // Data Sources with detailed info
      data_sources: filesReferenced
    }
    
    console.log('🔍 Debug: Enhanced response keys:', Object.keys(enhancedResponse))
    console.log('🔍 Debug: Has xai_metrics:', !!enhancedResponse.xai_metrics)
    console.log('🔍 Debug: Has sql_queries:', !!enhancedResponse.sql_queries)
    console.log('🔍 Debug: Has graph_data:', !!enhancedResponse.graph_data)
    console.log('🔍 Debug: xai_metrics value:', enhancedResponse.xai_metrics)
    console.log('🔍 Debug: sql_queries value:', enhancedResponse.sql_queries)
    
    return enhancedResponse
    
  } catch (error) {
    console.error('Enhanced Multi-Agent Flow error:', error)
    throw error
  }
}
