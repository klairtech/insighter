import { supabaseServer } from './server-utils';
import { 
  encryptApiMetadata, 
  generateApiConversationTitle,
  validateApiConversationData
} from './api-encryption';

export interface ApiConversation {
  id: string;
  userId: string;
  agentId: string;
  externalConversationId: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderType: 'user' | 'agent';
  content: string;
  messageType: 'text' | 'image' | 'file' | 'error';
  metadata: Record<string, unknown>;
  tokensUsed: number;
  processingTimeMs: number;
  status: 'success' | 'error' | 'partial';
  errorMessage?: string;
  createdAt: string;
}

export interface ApiInteraction {
  id: string;
  agentId: string;
  userId: string;
  conversationId: string;
  externalConversationId: string;
  request: string;
  response?: string;
  responseImageUrl?: string;
  contextData: Record<string, unknown>;
  dataSourcesUsed: string[];
  tokensUsed: number;
  processingTimeMs: number;
  status: 'success' | 'error' | 'partial' | 'rate_limited';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  apiTokenHash: string;
  createdAt: string;
}

/**
 * Get or create API conversation
 * external_conversation_id format: conversation_id:agent_id:user_id
 */
export async function getOrCreateApiConversation(data: {
  userId: string;
  agentId: string;
  externalConversationId: string;
  requestContent?: string;
}): Promise<ApiConversation | null> {
  try {
    if (!validateApiConversationData(data)) {
      throw new Error('Invalid conversation data');
    }

    // Create user-scoped conversation ID for API routes
    // Format: conversation_id:agent_id:user_id
    const userScopedConversationId = `${data.externalConversationId}:${data.agentId}:${data.userId}`;

    console.log('🔍 Step 1: Looking for existing conversation:', {
      userId: data.userId,
      agentId: data.agentId,
      userScopedConversationId: userScopedConversationId
    });
    
    // Step 1: Try to find existing conversation
    const { data: existingConversations, error: findError } = await supabaseServer
      .from('conversations')
      .select('*')
      .eq('user_id', data.userId)
      .eq('agent_id', data.agentId)
      .eq('external_conversation_id', userScopedConversationId)
      .limit(1);
    
    const existingConversation = existingConversations?.[0];
    
    console.log('🔍 Step 1 Result:', {
      found: !!existingConversation,
      error: findError?.code,
      conversationId: existingConversation?.id,
      totalFound: existingConversations?.length || 0
    });

    // If conversation exists, return it
    if (existingConversation) {
      console.log('✅ Step 1: Found existing conversation:', existingConversation.id);
      return {
        id: existingConversation.id,
        userId: existingConversation.user_id,
        agentId: existingConversation.agent_id,
        externalConversationId: data.externalConversationId,
        title: existingConversation.title || 'API Conversation',
        status: existingConversation.status,
        metadata: existingConversation.api_metadata || {},
        createdAt: existingConversation.created_at,
        updatedAt: existingConversation.updated_at,
        lastMessageAt: existingConversation.last_message_at
      };
    }

    // If there was an actual error (not just "not found"), throw it
    if (findError && findError.code !== 'PGRST116') {
      console.error('❌ Step 1: Error finding existing conversation:', findError);
      throw new Error(`Failed to check for existing conversation: ${findError.message}`);
    }

    console.log('📝 Step 2: No existing conversation found, creating new one...');
    
    // Step 2: Create new conversation
    const title = data.requestContent 
      ? generateApiConversationTitle(data.requestContent)
      : 'API Conversation';
    
    const encryptedMetadata = encryptApiMetadata({});

    const { data: newConversation, error: createError } = await supabaseServer
      .from('conversations')
      .insert({
        user_id: data.userId,
        agent_id: data.agentId,
        external_conversation_id: userScopedConversationId,
        title: title,
        api_metadata: encryptedMetadata,
        conversation_type: 'api',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    // Step 3: Handle creation result
    if (createError) {
      console.error('❌ Step 2: Error creating conversation:', createError);
      
      // If it's a duplicate key error, the conversation was created by another request
      if (createError.code === '23505') {
        console.log('🔄 Step 3: Duplicate key error - conversation exists, fetching it...');
        
        // Try to find the conversation that was created - use a broader search
        console.log('🔍 Step 3: Searching for existing conversation with broader criteria...');
        
        // First try: exact match
        let { data: retryConversations, error: retryError } = await supabaseServer
          .from('conversations')
          .select('*')
          .eq('user_id', data.userId)
          .eq('agent_id', data.agentId)
          .eq('external_conversation_id', userScopedConversationId)
          .limit(1);
          
        // If that fails, try without external_conversation_id constraint
        if (!retryConversations || retryConversations.length === 0) {
          console.log('🔍 Step 3: Trying broader search without external_conversation_id...');
          const broaderSearch = await supabaseServer
            .from('conversations')
            .select('*')
            .eq('user_id', data.userId)
            .eq('agent_id', data.agentId)
            .eq('conversation_type', 'api')
            .limit(5);
            
          console.log('🔍 Step 3: Broader search results:', broaderSearch.data?.length || 0);
          if (broaderSearch.data && broaderSearch.data.length > 0) {
            retryConversations = broaderSearch.data;
            retryError = broaderSearch.error;
          }
        }
          
        const retryConversation = retryConversations?.[0];
        
        if (retryConversation) {
          console.log('✅ Step 3: Successfully found conversation after duplicate error:', retryConversation.id);
          return {
            id: retryConversation.id,
            userId: retryConversation.user_id,
            agentId: retryConversation.agent_id,
            externalConversationId: data.externalConversationId,
            title: retryConversation.title || title,
            status: retryConversation.status,
            metadata: retryConversation.api_metadata || {},
            createdAt: retryConversation.created_at,
            updatedAt: retryConversation.updated_at,
            lastMessageAt: retryConversation.last_message_at
          };
        } else {
          console.error('❌ Step 3: Failed to find conversation after duplicate error:', retryError);
          console.error('❌ Step 3: This suggests a database inconsistency - conversation exists but cannot be found');
          
          // As a last resort, try to create a conversation with a different ID
          console.log('🔄 Step 3: Attempting to create conversation with timestamp suffix...');
          const timestampSuffix = Date.now();
          const alternativeConversationId = `${userScopedConversationId}_${timestampSuffix}`;
          
          const { data: altConversation, error: altError } = await supabaseServer
            .from('conversations')
            .insert({
              user_id: data.userId,
              agent_id: data.agentId,
              external_conversation_id: alternativeConversationId,
              title: title,
              api_metadata: encryptedMetadata,
              conversation_type: 'api',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_message_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (altConversation && !altError) {
            console.log('✅ Step 3: Created alternative conversation:', altConversation.id);
            return {
              id: altConversation.id,
              userId: altConversation.user_id,
              agentId: altConversation.agent_id,
              externalConversationId: data.externalConversationId,
              title: altConversation.title || title,
              status: altConversation.status,
              metadata: altConversation.api_metadata || {},
              createdAt: altConversation.created_at,
              updatedAt: altConversation.updated_at,
              lastMessageAt: altConversation.last_message_at
            };
          } else {
            throw new Error(`Failed to find or create conversation: ${retryError?.message || altError?.message || 'Unknown error'}`);
          }
        }
      } else {
        // Other errors
        throw new Error(`Failed to create conversation: ${createError.message}`);
      }
    }

    if (!newConversation) {
      throw new Error('Failed to create conversation: No data returned');
    }

    console.log('✅ Step 2: Successfully created new conversation:', newConversation.id);
    return {
      id: newConversation.id,
      userId: newConversation.user_id,
      agentId: newConversation.agent_id,
      externalConversationId: data.externalConversationId,
      title: newConversation.title || title,
      status: newConversation.status,
      metadata: newConversation.api_metadata || {},
      createdAt: newConversation.created_at,
      updatedAt: newConversation.updated_at,
      lastMessageAt: newConversation.last_message_at
    };

  } catch (error) {
    console.error('❌ Error in getOrCreateApiConversation:', error);
    return null;
  }
}

/**
 * Get or create Chat conversation
 * external_conversation_id format: agent_id:user_id
 */
export async function getOrCreateChatConversation(data: {
  userId: string;
  agentId: string;
  requestContent?: string;
}): Promise<ApiConversation | null> {
  try {
    if (!data.userId || !data.agentId) {
      throw new Error('Invalid conversation data: userId and agentId are required');
    }

    // Create user-scoped conversation ID for Chat routes
    // Format: agent_id:user_id
    const userScopedConversationId = `${data.agentId}:${data.userId}`;

    console.log('🔍 Chat: Looking for existing conversation:', {
      userId: data.userId,
      agentId: data.agentId,
      userScopedConversationId: userScopedConversationId
    });
    
    // Step 1: Try to find existing conversation
    const { data: existingConversations, error: findError } = await supabaseServer
      .from('conversations')
      .select('*')
      .eq('user_id', data.userId)
      .eq('agent_id', data.agentId)
      .eq('external_conversation_id', userScopedConversationId)
      .eq('conversation_type', 'chat')
      .limit(1);
    
    const existingConversation = existingConversations?.[0];
    
    console.log('🔍 Chat: Lookup result:', {
      found: !!existingConversation,
      error: findError?.code,
      conversationId: existingConversation?.id,
      totalFound: existingConversations?.length || 0
    });

    // If conversation exists, return it
    if (existingConversation) {
      console.log('✅ Chat: Found existing conversation:', existingConversation.id);
      return {
        id: existingConversation.id,
        userId: existingConversation.user_id,
        agentId: existingConversation.agent_id,
        externalConversationId: userScopedConversationId,
        title: existingConversation.title || 'Chat Conversation',
        status: existingConversation.status,
        metadata: existingConversation.api_metadata || {},
        createdAt: existingConversation.created_at,
        updatedAt: existingConversation.updated_at,
        lastMessageAt: existingConversation.last_message_at
      };
    }

    // If there was an actual error (not just "not found"), throw it
    if (findError && findError.code !== 'PGRST116') {
      console.error('❌ Chat: Error finding existing conversation:', findError);
      throw new Error(`Failed to check for existing conversation: ${findError.message}`);
    }

    console.log('📝 Chat: No existing conversation found, creating new one...');
    
    // Step 2: Create new conversation
    const title = data.requestContent 
      ? generateApiConversationTitle(data.requestContent)
      : 'New Chat Conversation';
    
    const encryptedMetadata = encryptApiMetadata({});

    const { data: newConversation, error: createError } = await supabaseServer
      .from('conversations')
      .insert({
        user_id: data.userId,
        agent_id: data.agentId,
        external_conversation_id: userScopedConversationId,
        title: title,
        api_metadata: encryptedMetadata,
        conversation_type: 'chat',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    // Step 3: Handle creation result
    if (createError) {
      console.error('❌ Chat: Error creating conversation:', createError);
      
      // If it's a duplicate key error, the conversation was created by another request
      if (createError.code === '23505') {
        console.log('🔄 Chat: Duplicate key error - conversation exists, fetching it...');
        
        // Try to find the conversation that was created
        const { data: retryConversations, error: retryError } = await supabaseServer
          .from('conversations')
          .select('*')
          .eq('user_id', data.userId)
          .eq('agent_id', data.agentId)
          .eq('external_conversation_id', userScopedConversationId)
          .eq('conversation_type', 'chat')
          .limit(1);
          
        const retryConversation = retryConversations?.[0];
        
        if (retryConversation && !retryError) {
          console.log('✅ Chat: Successfully found conversation after duplicate error:', retryConversation.id);
          return {
            id: retryConversation.id,
            userId: retryConversation.user_id,
            agentId: retryConversation.agent_id,
            externalConversationId: userScopedConversationId,
            title: retryConversation.title || title,
            status: retryConversation.status,
            metadata: retryConversation.api_metadata || {},
            createdAt: retryConversation.created_at,
            updatedAt: retryConversation.updated_at,
            lastMessageAt: retryConversation.last_message_at
          };
        } else {
          throw new Error(`Failed to find conversation after duplicate error: ${retryError?.message || 'Unknown error'}`);
        }
      } else {
        // Other errors
        throw new Error(`Failed to create conversation: ${createError.message}`);
      }
    }

    if (!newConversation) {
      throw new Error('Failed to create conversation: No data returned');
    }

    console.log('✅ Chat: Successfully created new conversation:', newConversation.id);
    return {
      id: newConversation.id,
      userId: newConversation.user_id,
      agentId: newConversation.agent_id,
      externalConversationId: userScopedConversationId,
      title: newConversation.title || title,
      status: newConversation.status,
      metadata: newConversation.api_metadata || {},
      createdAt: newConversation.created_at,
      updatedAt: newConversation.updated_at,
      lastMessageAt: newConversation.last_message_at
    };

  } catch (error) {
    console.error('❌ Error in getOrCreateChatConversation:', error);
    return null;
  }
}

/**
 * Save API interaction with full encryption
 */
export async function saveApiInteraction(data: {
  agentId: string;
  userId: string;
  conversationId: string;
  externalConversationId: string;
  request: string;
  response?: string;
  responseImageUrl?: string;
  contextData?: Record<string, unknown>;
  dataSourcesUsed?: string[];
  tokensUsed: number;
  processingTimeMs: number;
  status: 'success' | 'error' | 'partial' | 'rate_limited';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  apiToken: string;
}): Promise<ApiInteraction | null> {
  try {
    const { hashApiToken } = await import('./api-encryption');
    
    const apiTokenHash = hashApiToken(data.apiToken);

    // Save to database - store interaction data in api_metadata
    const interactionData = {
      request: data.request,
      response: data.response,
      responseImageUrl: data.responseImageUrl,
      contextData: data.contextData || {},
      dataSourcesUsed: data.dataSourcesUsed || [],
      tokensUsed: data.tokensUsed,
      processingTimeMs: data.processingTimeMs,
      status: data.status,
      errorMessage: data.errorMessage,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      apiTokenHash: apiTokenHash,
      timestamp: new Date().toISOString()
    };

    // Update the existing conversation with the interaction data
    const { data: interaction, error } = await supabaseServer
      .from('conversations')
      .update({
        api_metadata: interactionData,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', data.conversationId)
      .select()
      .single();

    if (error || !interaction) {
      console.error('Error saving API interaction:', error);
      return null;
    }

    return {
      id: interaction.id,
      agentId: interaction.agent_id,
      userId: interaction.user_id,
      conversationId: interaction.id, // Use conversation ID as interaction ID
      externalConversationId: interaction.external_conversation_id,
      request: data.request,
      response: data.response,
      responseImageUrl: data.responseImageUrl,
      contextData: data.contextData || {},
      dataSourcesUsed: data.dataSourcesUsed || [],
      tokensUsed: data.tokensUsed,
      processingTimeMs: data.processingTimeMs,
      status: data.status,
      errorMessage: data.errorMessage,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      apiTokenHash: apiTokenHash,
      createdAt: interaction.created_at
    };

  } catch (error) {
    console.error('Error in saveApiInteraction:', error);
    return null;
  }
}

/**
 * Get API conversations for a user
 */
export async function getApiConversations(userId: string, limit: number = 50): Promise<ApiConversation[]> {
  try {
    const { data: conversations, error } = await supabaseServer
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching API conversations:', error);
      return [];
    }

    return conversations.map(conv => ({
      id: conv.id,
      userId: conv.user_id,
      agentId: conv.agent_id,
      externalConversationId: conv.external_conversation_id,
      title: conv.title || 'API Conversation',
      status: conv.status,
      metadata: conv.api_metadata || {},
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      lastMessageAt: conv.last_message_at
    }));

  } catch (error) {
    console.error('Error in getApiConversations:', error);
    return [];
  }
}

/**
 * Get API messages for a conversation
 */
export async function getApiMessages(conversationId: string, limit: number = 100): Promise<ApiMessage[]> {
  try {
    const { data: messages, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching API messages:', error);
      return [];
    }

    const { decryptApiRequest, decryptApiResponse, decryptApiMetadata } = await import('./api-encryption');

    return messages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      senderType: msg.sender_type,
      content: msg.sender_type === 'user' 
        ? decryptApiRequest(msg.content_encrypted)
        : decryptApiResponse(msg.content_encrypted),
      messageType: msg.message_type,
      metadata: msg.metadata_encrypted
        ? decryptApiMetadata(msg.metadata_encrypted)
        : {},
      tokensUsed: msg.tokens_used,
      processingTimeMs: msg.processing_time_ms,
      status: msg.status,
      errorMessage: msg.error_message,
      createdAt: msg.created_at
    }));

  } catch (error) {
    console.error('Error in getApiMessages:', error);
    return [];
  }
}
