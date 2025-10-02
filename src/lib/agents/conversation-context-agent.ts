/**
 * Conversation Context Agent
 * 
 * Analyzes whether a user message is a follow-up or new message
 * and determines how much conversation context to use
 */

import { callAIWithOpenAIPrimary } from '../ai-utils'

export interface ConversationContextAnalysis {
  is_follow_up: boolean
  is_new_topic: boolean
  context_relevance: 'high' | 'medium' | 'low' | 'none'
  context_to_use: 'full' | 'recent' | 'minimal' | 'none'
  topic_continuity: number // 0-1 score
  requires_context: boolean
  context_entities: string[]
  previous_topic: string | null
  current_topic: string
  reasoning: string
  confidence: number
}

export interface ContextualQueryProcessing {
  should_use_context: boolean
  context_window: number // Number of previous messages to include
  context_filter: 'all' | 'relevant' | 'minimal'
  query_interpretation: 'standalone' | 'contextual' | 'clarification'
  processing_strategy: 'new_analysis' | 'continue_analysis' | 'refine_analysis'
}

/**
 * Analyze conversation context to determine if message is follow-up or new
 */
export async function analyzeConversationContext(
  userMessage: string,
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
  selectedDataSources?: string[]
): Promise<ConversationContextAnalysis> {
  const _startTime = Date.now()
  
  try {
    console.log('🧠 Conversation Context Agent: Analyzing message context...')
    
    // If no conversation history, it's definitely a new message
    if (!conversationHistory || conversationHistory.length === 0) {
      return {
        is_follow_up: false,
        is_new_topic: true,
        context_relevance: 'none',
        context_to_use: 'none',
        topic_continuity: 0,
        requires_context: false,
        context_entities: [],
        previous_topic: null,
        current_topic: userMessage,
        reasoning: 'No conversation history available',
        confidence: 1.0
      }
    }
    
    // Get recent conversation (last 6 messages)
    const recentHistory = conversationHistory.slice(-6)
    const recentConversation = recentHistory.map(msg => 
      `${msg.sender_type}: ${msg.content}`
    ).join('\n')
    
    const analysisPrompt = `Analyze whether this user message is a follow-up to previous conversation or a new topic.

USER MESSAGE: "${userMessage}"

RECENT CONVERSATION:
${recentConversation}

USER SELECTED DATA SOURCES: ${selectedDataSources?.length || 0} sources

Analysis Criteria:
1. **Follow-up indicators**: Pronouns (it, they, this, that), references to previous data, continuation words (also, and, but, however)
2. **New topic indicators**: New entities, different time periods, different data types, standalone questions
3. **Context relevance**: How much the current message depends on previous conversation
4. **Topic continuity**: Whether the message continues the same analytical thread
5. **Document context indicators**: References to "our visit", "the document", "findings", "summary", "report", "analysis" - these suggest document-based queries

Examples:
- "How many mobile numbers are chatting everyday in last 7 days?" → NEW TOPIC (specific new question)
- "What about the trends over time?" → FOLLOW-UP (references previous analysis)
- "Show me the top 10 districts" → FOLLOW-UP (continues data analysis)
- "What is the total revenue?" → NEW TOPIC (if no previous revenue discussion)
- "What are the key findings from our visit?" → NEW TOPIC (document-based query, should use document context)
- "Summarize the main points" → NEW TOPIC (document-based query, should use document context)
- "What does the report say about..." → NEW TOPIC (document-based query, should use document context)

Respond with JSON:
{
  "is_follow_up": true/false,
  "is_new_topic": true/false,
  "context_relevance": "high/medium/low/none",
  "context_to_use": "full/recent/minimal/none",
  "topic_continuity": 0.0-1.0,
  "requires_context": true/false,
  "context_entities": ["entity1", "entity2"],
  "previous_topic": "Previous conversation topic or null",
  "current_topic": "Current message topic",
  "reasoning": "Detailed reasoning for the analysis",
  "confidence": 0.0-1.0
}`

    const response = await callAIWithOpenAIPrimary([
      {
        role: 'system',
        content: 'You are a conversation context analyzer. Analyze whether messages are follow-ups or new topics. Pay special attention to document-based queries that reference "our visit", "findings", "summary", "report", "document", etc. These should be treated as new topics that require document context. Respond with valid JSON only.'
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ], {
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })
    
    const result = JSON.parse(response.content)
    
    console.log('🧠 Context Analysis Result:', {
      is_follow_up: result.is_follow_up,
      context_relevance: result.context_relevance,
      topic_continuity: result.topic_continuity,
      reasoning: result.reasoning
    })
    
    return {
      is_follow_up: result.is_follow_up || false,
      is_new_topic: result.is_new_topic || false,
      context_relevance: result.context_relevance || 'low',
      context_to_use: result.context_to_use || 'minimal',
      topic_continuity: result.topic_continuity || 0.0,
      requires_context: result.requires_context || false,
      context_entities: result.context_entities || [],
      previous_topic: result.previous_topic || null,
      current_topic: result.current_topic || userMessage,
      reasoning: result.reasoning || 'Analysis completed',
      confidence: result.confidence || 0.7
    }
    
  } catch (error) {
    console.error('Conversation Context Agent error:', error)
    
    // Fallback: simple heuristic analysis
    const isFollowUp = conversationHistory.length > 0 && (
      userMessage.toLowerCase().includes('also') ||
      userMessage.toLowerCase().includes('and') ||
      userMessage.toLowerCase().includes('what about') ||
      userMessage.toLowerCase().includes('how about') ||
      userMessage.toLowerCase().includes('show me') ||
      userMessage.toLowerCase().includes('trends') ||
      userMessage.toLowerCase().includes('compare')
    )
    
    // Check for document-based queries
    const isDocumentQuery = userMessage.toLowerCase().includes('our visit') ||
      userMessage.toLowerCase().includes('findings') ||
      userMessage.toLowerCase().includes('summary') ||
      userMessage.toLowerCase().includes('report') ||
      userMessage.toLowerCase().includes('document') ||
      userMessage.toLowerCase().includes('analysis') ||
      userMessage.toLowerCase().includes('key points') ||
      userMessage.toLowerCase().includes('main points')
    
    return {
      is_follow_up: isFollowUp && !isDocumentQuery,
      is_new_topic: !isFollowUp || isDocumentQuery,
      context_relevance: isDocumentQuery ? 'high' : (isFollowUp ? 'medium' : 'low'),
      context_to_use: isDocumentQuery ? 'full' : (isFollowUp ? 'recent' : 'minimal'),
      topic_continuity: isDocumentQuery ? 0.8 : (isFollowUp ? 0.6 : 0.2),
      requires_context: isFollowUp || isDocumentQuery,
      context_entities: isDocumentQuery ? ['document', 'findings', 'analysis'] : [],
      previous_topic: isFollowUp ? 'Previous analysis' : null,
      current_topic: userMessage,
      reasoning: isDocumentQuery ? 'Document-based query detected - requires document context' : 'Fallback heuristic analysis due to error',
      confidence: isDocumentQuery ? 0.8 : 0.5
    }
  }
}

/**
 * Determine how to process the query based on context analysis
 */
export async function determineQueryProcessingStrategy(
  userMessage: string,
  contextAnalysis: ConversationContextAnalysis,
  selectedDataSources?: string[]
): Promise<ContextualQueryProcessing> {
  
  console.log('🎯 Determining query processing strategy...')
  
  // If user selected specific data sources, prioritize those
  const hasSelectedSources = selectedDataSources && selectedDataSources.length > 0
  
  if (hasSelectedSources) {
    console.log('🎯 User selected specific data sources - using minimal context')
    return {
      should_use_context: false,
      context_window: 0,
      context_filter: 'minimal',
      query_interpretation: 'standalone',
      processing_strategy: 'new_analysis'
    }
  }
  
  // Determine strategy based on context analysis
  if (contextAnalysis.is_new_topic || contextAnalysis.context_relevance === 'none') {
    // Check if it's a document-based query
    const isDocumentQuery = contextAnalysis.context_entities.includes('document') ||
      contextAnalysis.context_entities.includes('findings') ||
      contextAnalysis.context_entities.includes('analysis') ||
      contextAnalysis.reasoning?.includes('document-based')
    
    if (isDocumentQuery) {
      return {
        should_use_context: true,
        context_window: 6, // Use more context for document queries
        context_filter: 'all',
        query_interpretation: 'contextual',
        processing_strategy: 'new_analysis'
      }
    }
    
    return {
      should_use_context: false,
      context_window: 0,
      context_filter: 'minimal',
      query_interpretation: 'standalone',
      processing_strategy: 'new_analysis'
    }
  }
  
  if (contextAnalysis.is_follow_up && contextAnalysis.topic_continuity > 0.7) {
    return {
      should_use_context: true,
      context_window: 4, // Last 4 messages
      context_filter: 'relevant',
      query_interpretation: 'contextual',
      processing_strategy: 'continue_analysis'
    }
  }
  
  if (contextAnalysis.is_follow_up && contextAnalysis.topic_continuity > 0.4) {
    return {
      should_use_context: true,
      context_window: 2, // Last 2 messages
      context_filter: 'minimal',
      query_interpretation: 'contextual',
      processing_strategy: 'refine_analysis'
    }
  }
  
  // Default: minimal context
  return {
    should_use_context: false,
    context_window: 0,
    context_filter: 'minimal',
    query_interpretation: 'standalone',
    processing_strategy: 'new_analysis'
  }
}

/**
 * Filter conversation history based on processing strategy
 */
export function filterConversationContext(
  conversationHistory: Array<{sender_type: string, content: string, created_at: string}>,
  strategy: ContextualQueryProcessing
): Array<{sender_type: string, content: string, created_at: string}> {
  
  if (!strategy.should_use_context || strategy.context_window === 0) {
    return []
  }
  
  const filteredHistory = conversationHistory.slice(-strategy.context_window)
  
  if (strategy.context_filter === 'relevant') {
    // Keep only messages that seem relevant to data analysis
    return filteredHistory.filter(msg => 
      msg.sender_type === 'user' || 
      (msg.sender_type === 'assistant' && 
       (msg.content.includes('data') || 
        msg.content.includes('analysis') || 
        msg.content.includes('table') ||
        msg.content.includes('query')))
    )
  }
  
  return filteredHistory
}

/**
 * Enhanced data source filtering that respects user selections
 */
export function applyDataSourceFiltering(
  availableSources: any[],
  selectedDataSources?: string[],
  contextAnalysis?: ConversationContextAnalysis
): any[] {
  
  console.log('🔍 Applying data source filtering...')
  console.log('🔍 Available sources:', availableSources.length)
  console.log('🔍 Selected sources:', selectedDataSources?.length || 0)
  
  // If user selected specific data sources, use ONLY those
  if (selectedDataSources && selectedDataSources.length > 0) {
    console.log('🔍 User selected specific data sources - restricting to selection only')
    
    const filteredSources = availableSources.filter(source => {
      const matches = selectedDataSources.includes(source.id) ||
                     selectedDataSources.includes(`db-${source.id}`) ||
                     selectedDataSources.includes(`file-${source.id}`) ||
                     selectedDataSources.includes(`external-${source.id}`) ||
                     selectedDataSources.includes(`workspace-${source.id}`)
      
      console.log(`🔍 Source ${source.id} (${source.name}) matches selection: ${matches}`)
      return matches
    })
    
    console.log(`🔍 Filtered to ${filteredSources.length} sources based on user selection`)
    return filteredSources
  }
  
  // If it's a new topic, use all available sources
  if (contextAnalysis?.is_new_topic) {
    console.log('🔍 New topic detected - using all available sources')
    return availableSources
  }
  
  // For follow-ups, use all sources (let the AI decide relevance)
  console.log('🔍 Follow-up detected - using all available sources')
  return availableSources
}
