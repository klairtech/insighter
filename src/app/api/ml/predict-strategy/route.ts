/**
 * ML Strategy Prediction API
 * 
 * This endpoint provides ML-powered strategy predictions for query processing
 * Compatible with Next.js, Vercel, and Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { mlLearningService } from '@/lib/ml-learning-service'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// )

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      query, 
      conversationHistory, 
      workspaceId, 
      userId 
    } = body

    if (!query || !workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, workspaceId, userId' },
        { status: 400 }
      )
    }

    // Extract features for ML prediction
    const features = await mlLearningService.extractFeatures(
      query,
      conversationHistory || [],
      workspaceId,
      userId
    )

    // Get ML prediction
    const prediction = await mlLearningService.predictOptimalStrategy(
      features,
      workspaceId,
      userId
    )

    // Get model performance metrics
    const modelPerformance = await mlLearningService.monitorModelPerformance(
      workspaceId
    )

    return NextResponse.json({
      success: true,
      prediction,
      features,
      modelPerformance,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('ML prediction API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate ML prediction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const userId = searchParams.get('userId')

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: workspaceId, userId' },
        { status: 400 }
      )
    }

    // Get model performance metrics
    const modelPerformance = await mlLearningService.monitorModelPerformance(
      workspaceId
    )

    return NextResponse.json({
      success: true,
      modelPerformance,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('ML insights API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get learning insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
