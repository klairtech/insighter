/**
 * ML Learning from Interaction API
 * 
 * This endpoint allows the system to learn from user interactions
 * and update ML models accordingly
 */

import { NextRequest, NextResponse } from 'next/server'
import { mlLearningService, InteractionData } from '@/lib/ml-learning-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const interactionData: InteractionData = body

    // Validate required fields
    const requiredFields = [
      'user_id', 'workspace_id', 'agent_id', 'original_query',
      'query_intent', 'query_entities', 'processing_strategy',
      'data_sources_used', 'execution_time_ms', 'success'
    ]

    for (const field of requiredFields) {
      if (!interactionData[field as keyof InteractionData]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Learn from the interaction
    await mlLearningService.learnFromInteraction(interactionData)

    return NextResponse.json({
      success: true,
      message: 'Successfully learned from interaction',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('ML learning API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to learn from interaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
