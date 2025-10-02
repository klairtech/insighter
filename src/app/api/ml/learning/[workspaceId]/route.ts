/**
 * Real-time Learning API Endpoint
 * 
 * Provides real-time learning capabilities and metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { realTimeLearningPipeline } from '@/lib/ml-real-time-learning'
import { mlLearningService } from '@/lib/ml-learning-service'
import { supabaseServer } from '@/lib/server-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)
    const metricType = searchParams.get('metric') || 'all'

    // Verify user has access to workspace
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check workspace access
    const { data: workspace } = await supabaseServer
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Get learning metrics
    const learningMetrics = await realTimeLearningPipeline.getLearningMetrics(workspaceId)

    // Get drift detection result
    const driftResult = await realTimeLearningPipeline.checkForDrift(workspaceId)

    const responseData: {
      learning_metrics: unknown;
      drift_detection: unknown;
      workspace_id: string;
      performance_metrics?: unknown;
      accuracy_metrics?: unknown;
      efficiency_metrics?: unknown;
      drift_metrics?: unknown;
    } = {
      learning_metrics: learningMetrics,
      drift_detection: driftResult,
      workspace_id: workspaceId
    }

    // Add specific metrics if requested
    if (metricType === 'performance') {
      responseData.performance_metrics = {
        accuracy: learningMetrics.accuracy,
        precision: learningMetrics.precision,
        recall: learningMetrics.recall,
        f1_score: learningMetrics.f1_score
      }
    }

    if (metricType === 'drift') {
      responseData.drift_metrics = {
        drift_score: driftResult.drift_score,
        drift_type: driftResult.drift_type,
        confidence: driftResult.confidence,
        recommended_action: driftResult.recommended_action
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Learning API error:', error)
    return NextResponse.json(
      { error: 'Failed to get learning metrics' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const body = await request.json()

    // Verify user has access to workspace
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check workspace access
    const { data: workspace } = await supabaseServer
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Process learning event
    if (body.action === 'process_event') {
      await realTimeLearningPipeline.processLearningEvent(
        workspaceId,
        body.userId,
        body.eventType,
        body.eventData
      )

      return NextResponse.json({
        success: true,
        message: 'Learning event processed'
      })
    }

    // Extract enhanced features
    if (body.action === 'extract_features') {
      const features = await mlLearningService.extractFeatures(
        body.query,
        body.conversationHistory,
        workspaceId,
        body.userId
      )

      return NextResponse.json({
        success: true,
        data: {
          features,
          workspace_id: workspaceId
        }
      })
    }

    // Get ML prediction
    if (body.action === 'predict') {
      const prediction = await mlLearningService.predictOptimalStrategy(
        body.features,
        workspaceId,
        body.userId
      )

      return NextResponse.json({
        success: true,
        data: {
          prediction,
          workspace_id: workspaceId
        }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Learning API error:', error)
    return NextResponse.json(
      { error: 'Failed to process learning request' },
      { status: 500 }
    )
  }
}
