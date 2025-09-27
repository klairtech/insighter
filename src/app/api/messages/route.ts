import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabaseServer
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Get messages for the conversation
    const { data: messages, error } = await supabaseServer
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_type,
        content_encrypted,
        content_hash,
        message_type,
        metadata_encrypted,
        tokens_used,
        processing_time_ms,
        encryption_version,
        created_at
      `)
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

    // Import decryption functions
    const { decryptText, decryptObject } = await import('@/lib/encryption')
    
    // Decrypt and transform messages
    const decryptedMessages = (messages || []).map((msg) => {
      try {
        const decryptedContent = decryptText(msg.content_encrypted)
        const decryptedMetadata = msg.metadata_encrypted
          ? decryptObject(msg.metadata_encrypted)
          : {}

        // All data is now in the decrypted metadata

        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: decryptedContent,
          message_type: msg.message_type,
          metadata: decryptedMetadata,
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at,
        }
      } catch (decryptError) {
        console.error('Error decrypting message:', decryptError)
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_type: msg.sender_type,
          content: '[Message could not be decrypted]',
          message_type: msg.message_type,
          metadata: {},
          tokens_used: msg.tokens_used,
          processing_time_ms: msg.processing_time_ms,
          created_at: msg.created_at,
        }
      }
    })

    // Get total count for pagination
    const { count, error: countError } = await supabaseServer
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    if (countError) {
      console.error('Error counting messages:', countError)
    }

    return NextResponse.json({
      messages: decryptedMessages,
      hasMore: count ? (offset + limit) < count : false,
      totalCount: count || 0
    })

  } catch (error) {
    console.error('Error in messages API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
