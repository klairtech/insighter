import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'
import { processWithAgent, getConversationContext } from '@/lib/ai-agents'
import { encryptText, encryptObject, decryptText, decryptObject, hashForIndex } from '@/lib/encryption'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { conversationId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    // Get total count of messages
    const { count: totalCount, error: countError } = await supabaseServer
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    if (countError) {
      console.error('Error counting messages:', countError)
    }

    // Get encrypted messages with pagination (latest first, then reverse for display)
    const offset = (page - 1) * limit
    const { data: encryptedMessages, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Decrypt messages and reverse order for display (oldest first)
    const decryptedMessages = encryptedMessages?.map(msg => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted ? decryptObject(msg.metadata_encrypted) : {}
        
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: decryptedContent,
          message_type: msg.message_type,
          metadata: decryptedMetadata,
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at
        }
      } catch (decryptError) {
        console.error('Error decrypting message:', decryptError)
        // Return a safe fallback message
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: '[Message could not be decrypted]',
          message_type: msg.message_type,
          metadata: {},
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at
        }
      }
    }).reverse() || [] // Reverse to show oldest first

    const hasMore = totalCount ? offset + limit < totalCount : false

    return NextResponse.json({
      messages: decryptedMessages,
      hasMore,
      totalCount: totalCount || 0,
      page,
      limit
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, s-maxage=30',
      }
    })
  } catch (error) {
    console.error('Error in chat messages GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    
    // Verify user session using server-side Supabase client with cookies
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    

    const { conversationId } = await params
    const body = await request.json()
    const { content, message_type = 'text' } = body


    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select(`
        id,
        user_id,
        agent_id,
        conversation_type,
        title,
        status,
        external_conversation_id,
        api_metadata,
        created_at,
        updated_at,
        last_message_at,
        ai_agents!inner(
          id,
          name,
          description,
          workspaces!inner(
            id,
            name,
            organizations!inner(
              id,
              name
            )
          )
        )
      `)
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .eq('conversation_type', 'chat')
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    // Encrypt user message
    const encryptedContent = encryptText(content.trim())
    const contentHash = hashForIndex(content.trim())
    const encryptedMetadata = encryptObject({})

    // Save encrypted user message
    const { data: userMessage, error: userMsgError } = await supabaseServer
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_type: 'user',
        content_encrypted: encryptedContent,
        content_hash: contentHash,
        message_type: message_type,
        metadata_encrypted: encryptedMetadata,
        encryption_version: 'v1'
      }])
      .select()
      .single()

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }

    // Update conversation last_message_at
    await supabaseServer
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // Get conversation context for AI processing
    const conversationContext = await getConversationContext(conversationId, conversation.agent_id)
    
    if (!conversationContext) {
      return NextResponse.json(
        { error: 'Failed to get conversation context' },
        { status: 500 }
      )
    }
    
    // Process with AI agent
    const agentResponse = await processWithAgent(conversationContext, content.trim())

    // Encrypt agent response
    const encryptedAgentContent = encryptText(agentResponse.content)
    const agentContentHash = hashForIndex(agentResponse.content)
    const encryptedAgentMetadata = encryptObject(agentResponse.metadata)

    // Save encrypted agent response
    const { data: agentMessage, error: agentMsgError } = await supabaseServer
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_type: 'agent',
        content_encrypted: encryptedAgentContent,
        content_hash: agentContentHash,
        message_type: 'text',
        metadata_encrypted: encryptedAgentMetadata,
        tokens_used: agentResponse.tokens_used,
        processing_time_ms: agentResponse.processing_time_ms,
        encryption_version: 'v1'
      }])
      .select()
      .single()

    if (agentMsgError) {
      console.error('Error saving agent message:', agentMsgError)
      // Don't fail the request, just log the error
    }

    // Get updated conversation with all encrypted messages
    const { data: updatedEncryptedMessages, error: messagesError } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching updated messages:', messagesError)
    }

    // Decrypt all messages for the response
    const decryptedUpdatedMessages = updatedEncryptedMessages?.map(msg => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted ? decryptObject(msg.metadata_encrypted) : {}
        
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: decryptedContent,
          message_type: msg.message_type,
          metadata: decryptedMetadata,
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at
        }
      } catch (decryptError) {
        console.error('Error decrypting updated message:', decryptError)
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: '[Message could not be decrypted]',
          message_type: msg.message_type,
          metadata: {},
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at
        }
      }
    }) || []

    const updatedConversation = {
      ...conversation,
      messages: decryptedUpdatedMessages
    }

    return NextResponse.json({
      conversation: updatedConversation,
      userMessage,
      agentMessage: agentMessage || null
    })
  } catch (error) {
    console.error('Error in chat messages POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

