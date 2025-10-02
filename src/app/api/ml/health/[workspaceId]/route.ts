/**
 * ML Model Health API Endpoint
 * 
 * Provides health status and performance metrics for ML models
 */

import { NextRequest, NextResponse } from 'next/server'
import { modelMonitoringSystem } from '@/lib/ml-monitoring'
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

    // Get model health status
    const healthStatus = await modelMonitoringSystem.getModelHealth(workspaceId)

    // Get active alerts
    const activeAlerts = await modelMonitoringSystem.getActiveAlerts(workspaceId)

    // Get performance trends
    const trends = await modelMonitoringSystem.getPerformanceTrends(workspaceId, '24h')

    return NextResponse.json({
      success: true,
      data: {
        health_status: healthStatus,
        active_alerts: activeAlerts,
        performance_trends: trends,
        workspace_id: workspaceId
      }
    })

  } catch (error) {
    console.error('ML health API error:', error)
    return NextResponse.json(
      { error: 'Failed to get ML health status' },
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

    // Start monitoring if requested
    if (body.action === 'start_monitoring') {
      await modelMonitoringSystem.startMonitoring(workspaceId, body.config)
      return NextResponse.json({ success: true, message: 'Monitoring started' })
    }

    // Stop monitoring if requested
    if (body.action === 'stop_monitoring') {
      await modelMonitoringSystem.stopMonitoring(workspaceId)
      return NextResponse.json({ success: true, message: 'Monitoring stopped' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('ML health API error:', error)
    return NextResponse.json(
      { error: 'Failed to update ML monitoring' },
      { status: 500 }
    )
  }
}
