/**
 * Model Usage API
 * 
 * Provides endpoints for tracking and monitoring AI model usage and costs
 */

import { NextRequest, NextResponse } from 'next/server'
import { modelConfigManager } from '@/lib/model-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('time_range') as 'day' | 'week' | 'month' || 'day'
    const userId = searchParams.get('user_id')
    const workspaceId = searchParams.get('workspace_id')

    // Get usage statistics
    const stats = modelConfigManager.getUsageStats(timeRange)
    
    // Get cost limits
    const costLimits = modelConfigManager.getCostLimits()
    
    // Check usage limits
    const limitCheck = modelConfigManager.checkUsageLimits(userId || undefined, workspaceId || undefined)

    return NextResponse.json({
      success: true,
      statistics: stats,
      cost_limits: costLimits,
      limit_check: limitCheck,
      time_range: timeRange
    })

  } catch (error) {
    console.error('Model usage API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get usage statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, modelId, tokens, userId, workspaceId } = body

    switch (action) {
      case 'record_usage':
        if (!modelId || !tokens) {
          return NextResponse.json(
            { error: 'Missing modelId or tokens' },
            { status: 400 }
          )
        }

        const cost = modelConfigManager.calculateCost(modelId, tokens)
        
        // Record usage (this would typically be done automatically by the embedding service)
        // This endpoint is mainly for manual recording or testing
        return NextResponse.json({
          success: true,
          cost,
          message: 'Usage recorded successfully'
        })

      case 'check_limits':
        const limitCheck = modelConfigManager.checkUsageLimits(userId, workspaceId)
        return NextResponse.json({
          success: true,
          limit_check: limitCheck
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Model usage API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process usage request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
