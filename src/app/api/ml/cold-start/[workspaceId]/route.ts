/**
 * Cold Start Solutions API Endpoint
 * 
 * Provides cold start solutions for new users and workspaces
 */

import { NextRequest, NextResponse } from 'next/server'
import { coldStartSolutionsManager } from '@/lib/ml-cold-start'
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
    const userId = searchParams.get('userId')
    const query = searchParams.get('query')

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

    // Get cold start solution
    const solution = await coldStartSolutionsManager.getColdStartSolution(
      workspaceId,
      userId || undefined,
      query || undefined
    )

    return NextResponse.json({
      success: true,
      data: {
        solution,
        workspace_id: workspaceId,
        user_id: userId
      }
    })

  } catch (error) {
    console.error('Cold start API error:', error)
    return NextResponse.json(
      { error: 'Failed to get cold start solution' },
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

    // Handle data sparsity
    if (body.action === 'handle_sparsity') {
      const result = await coldStartSolutionsManager.handleDataSparsity(
        workspaceId,
        body.userId,
        body.queryType
      )

      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // Generate synthetic data
    if (body.action === 'generate_synthetic_data') {
      const syntheticData = await coldStartSolutionsManager.generateSyntheticData(
        workspaceId,
        body.dataType,
        body.count
      )

      return NextResponse.json({
        success: true,
        data: {
          synthetic_data: syntheticData,
          count: syntheticData.length
        }
      })
    }

    // Update solution effectiveness
    if (body.action === 'update_effectiveness') {
      await coldStartSolutionsManager.updateSolutionEffectiveness(
        body.solutionId,
        body.success,
        body.userSatisfaction
      )

      return NextResponse.json({
        success: true,
        message: 'Solution effectiveness updated'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Cold start API error:', error)
    return NextResponse.json(
      { error: 'Failed to process cold start request' },
      { status: 500 }
    )
  }
}
