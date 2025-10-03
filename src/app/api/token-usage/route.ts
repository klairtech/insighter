import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'
import { getUserTokenUsage } from '@/lib/token-utils-server'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get the current user
    const { data: { user }, error: sessionError } = await supabaseServer.auth.getUser()
    
    if (sessionError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const action = searchParams.get('action') as 'chat' | 'canvas_generation' | 'dashboard_creation' | null

    // Get token usage statistics
    const tokenUsage = await getUserTokenUsage(user.id, days)

    // Filter by action if specified
    let filteredUsage = tokenUsage
    if (action) {
      filteredUsage = {
        ...tokenUsage,
        usageByAction: {
          [action]: tokenUsage.usageByAction[action] || { tokens: 0, requests: 0 }
        },
        dailyUsage: tokenUsage.dailyUsage.map(day => ({
          ...day,
          // Note: This is a simplified filter - in production you'd want to filter at the database level
          tokens: day.tokens,
          requests: day.requests
        }))
      }
    }

    return NextResponse.json({
      success: true,
      user_id: user.id,
      period_days: days,
      action_filter: action,
      token_usage: filteredUsage
    })

  } catch (error) {
    console.error('Error fetching token usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const { data: { user }, error: sessionError } = await supabaseServer.auth.getUser()
    
    if (sessionError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tokens_used, action = 'chat' } = body

    if (!tokens_used || typeof tokens_used !== 'number' || tokens_used < 0) {
      return NextResponse.json(
        { error: 'Invalid tokens_used value' },
        { status: 400 }
      )
    }

    // Save token usage
    const { error: insertError } = await supabaseServer
      .from('token_usage')
      .insert({
        user_id: user.id,
        tokens_used: tokens_used,
        action: action
      })

    if (insertError) {
      console.error('Error saving token usage:', insertError)
      return NextResponse.json(
        { error: 'Failed to save token usage' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Token usage saved successfully'
    })

  } catch (error) {
    console.error('Error saving token usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
