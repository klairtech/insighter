import { createClient } from '@supabase/supabase-js'
import { decryptText, decryptObject } from './encryption'
import { 
  XAIMetrics, 
  AgentThinkingNotes, 
  SQLQueries, 
  GraphData
} from '../types/xai-metrics'
import { 
  TokenTrackingData 
} from './token-utils'
import { 
  multiAgentFlow
} from './multi-agent-flow'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export interface AgentResponse {
  content: string;
  metadata: {
    processing_status: string;
    agent_id: string;
    workspace_id: string;
    files_referenced?: string[];
    confidence_score?: number;
    follow_up_questions?: string[];
    query_validation?: {
      is_valid: boolean;
      query_type: 'greeting' | 'data_query' | 'abusive' | 'irrelevant' | 'ambiguous' | 'closing' | 'continuation';
      confidence: number;
      requires_follow_up?: boolean;
      follow_up_context?: string;
    };
  };
  tokens_used: number;
  processing_time_ms: number;
  // XAI Data
  xai_metrics?: XAIMetrics;
  agent_thinking_notes?: AgentThinkingNotes;
  sql_queries?: SQLQueries;
  graph_data?: GraphData;
  reasoning_explanation?: string;
  analysis_depth?: 'quick' | 'standard' | 'deep' | 'comprehensive';
  data_quality_score?: number;
  response_completeness_score?: number;
  user_satisfaction_prediction?: number;
  // Comprehensive Token Tracking
  token_tracking?: TokenTrackingData;
}

export interface ConversationContext {
  conversation_id: string;
  messages: Array<{
    sender_type: 'user' | 'agent' | 'system';
    content: string;
    created_at: string;
  }>;
  agent_id: string;
  workspace_id: string;
}

/**
 * Enhanced function to process user messages with the new multi-agent flow
 */
export async function processWithEnhancedAgent(
  conversation: ConversationContext,
  userMessage: string,
  userId?: string,
  selectedDataSources?: string[]
): Promise<AgentResponse> {
  try {
    console.log('🚀 processWithEnhancedAgent: Starting enhanced multi-agent processing...')
    
    // Use the new multi-agent flow directly
    const enhancedResponse = await multiAgentFlow.processQuery(
      userMessage,
      conversation.workspace_id,
      conversation.agent_id,
      conversation.messages,
      userId,
      selectedDataSources
    )
    
    // Convert enhanced response to standard AgentResponse format
    const standardResponse: AgentResponse = {
      content: enhancedResponse.content,
      metadata: {
        processing_status: enhancedResponse.success ? 'completed' : 'failed',
        agent_id: conversation.agent_id,
        workspace_id: conversation.workspace_id,
        files_referenced: enhancedResponse.data_sources_used,
        confidence_score: enhancedResponse.confidence_score,
        follow_up_questions: enhancedResponse.follow_up_suggestions,
        query_validation: {
          is_valid: enhancedResponse.success,
          query_type: 'data_query',
          confidence: enhancedResponse.confidence_score,
          requires_follow_up: false
        }
      },
      tokens_used: enhancedResponse.tokens_used,
      processing_time_ms: enhancedResponse.processing_time_ms
    }
    
    console.log('✅ processWithEnhancedAgent: Enhanced processing completed')
    return standardResponse
    
  } catch (error) {
    console.error('Enhanced agent processing error:', error)
    
    // Fallback to standard processing
    console.log('🔄 Falling back to standard agent processing...')
    return await processWithAgent(conversation, userMessage)
  }
}

/**
 * Main function to process user messages with AI agents
 * Now uses the new specialized multi-agent flow
 */
export async function processWithAgent(
  conversation: ConversationContext,
  userMessage: string
): Promise<AgentResponse> {
  const startTime = Date.now()
  
  try {
    console.log('🚀 processWithAgent: Starting with message:', userMessage)
    console.log('🚀 processWithAgent: Conversation context:', {
      agent_id: conversation.agent_id,
      workspace_id: conversation.workspace_id,
      messages_count: conversation.messages.length
    })
    
    // Use the new multi-agent flow directly
    const enhancedResponse = await multiAgentFlow.processQuery(
        userMessage,
      conversation.workspace_id,
      conversation.agent_id,
      conversation.messages
    )
    
    // Convert enhanced response to standard AgentResponse format
    const standardResponse: AgentResponse = {
      content: enhancedResponse.content,
        metadata: {
        processing_status: enhancedResponse.success ? 'completed' : 'failed',
          agent_id: conversation.agent_id,
          workspace_id: conversation.workspace_id,
        files_referenced: enhancedResponse.data_sources_used,
        confidence_score: enhancedResponse.confidence_score,
        follow_up_questions: enhancedResponse.follow_up_suggestions,
        query_validation: {
          is_valid: enhancedResponse.success,
          query_type: 'data_query',
          confidence: enhancedResponse.confidence_score,
          requires_follow_up: false
        }
      },
      tokens_used: enhancedResponse.tokens_used,
      processing_time_ms: enhancedResponse.processing_time_ms
    }
    
    console.log('✅ processWithAgent: Processing completed')
    return standardResponse
    
  } catch (error) {
    console.error('processWithAgent error:', error)
    
    // Return error response
    return {
      content: 'I encountered an error while processing your request. Please try again.',
      metadata: {
        processing_status: 'error',
        agent_id: conversation.agent_id,
        workspace_id: conversation.workspace_id,
        files_referenced: [],
        confidence_score: 0,
        follow_up_questions: [],
        query_validation: {
          is_valid: false,
          query_type: 'data_query',
          confidence: 0,
          requires_follow_up: false
        }
      },
      tokens_used: 0,
      processing_time_ms: Date.now() - startTime
    }
  }
}

/**
 * Get conversation context for an agent
 */
export async function getConversationContext(
  conversationId: string,
  agentId: string
): Promise<ConversationContext | null> {
  try {
    // Get conversation details
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select(`
        id,
        agent_id,
        ai_agents!inner(
          workspace_id
        )
      `)
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      console.error('Error fetching conversation:', convError)
      return null
    }

    // Get recent encrypted messages
    const { data: encryptedMessages, error: msgError } = await supabaseServer
      .from('messages')
      .select('sender_type, content_encrypted, metadata_encrypted, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20) // Last 20 messages for context

    if (msgError) {
      console.error('Error fetching messages:', msgError)
      return null
    }

    // Decrypt messages for context
    const decryptedMessages = encryptedMessages?.map(msg => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted ? decryptObject(msg.metadata_encrypted) : {}
        
        return {
          sender_type: msg.sender_type,
          content: decryptedContent,
          metadata: decryptedMetadata,
          created_at: msg.created_at
        }
      } catch (decryptError) {
        console.error('Error decrypting message for context:', decryptError)
        return {
          sender_type: msg.sender_type,
          content: '[Message could not be decrypted]',
          metadata: {},
          created_at: msg.created_at
        }
      }
    }) || []

    // Extract workspace_id from the conversation data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agents = conversation.ai_agents as any
    const workspaceId = agents?.workspace_id || agents?.[0]?.workspace_id
    
    if (!workspaceId) {
      console.error('❌ Could not find workspace_id in conversation data')
      return null
    }

    return {
      conversation_id: conversationId,
      messages: decryptedMessages,
      agent_id: agentId,
      workspace_id: workspaceId
    }
  } catch (error) {
    console.error('Error getting conversation context:', error)
    return null
  }
}
