import { NextRequest, NextResponse } from 'next/server'
import { verifyUserSession } from '@/lib/server-utils'
import { getAgentUsageAnalytics } from '@/lib/agent-token-tracking'

export async function GET(request: NextRequest) {
  try {
    // Verify user session
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const userId = searchParams.get('user_id') // For admin access to specific user data

    // Check if user is requesting data for another user (admin only)
    const targetUserId = userId && userId !== session.user.id ? userId : session.user.id

    // Get agent usage analytics
    const analytics = await getAgentUsageAnalytics(targetUserId, days)

    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        days_requested: days,
        user_id: targetUserId,
        generated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching agent usage analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent usage analytics' },
      { status: 500 }
    )
  }
}
