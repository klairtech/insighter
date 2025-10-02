import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params
    const { summary } = await request.json()

    if (!summary) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
    }

    // Get database connection
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('id, name, type, workspace_id')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Check if user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', connection.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', session.userId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create summary data
    const summaryData = {
      summary: summary,
      key_points: [], // Keep existing key points
      tags: [], // Keep existing tags
      updated_at: new Date().toISOString(),
      updated_by: session.userId
    }

    const encryptedSummary = encryptObject(summaryData)

    // Update the database connection with the new summary
    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        ai_summary_encrypted: encryptedSummary,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating database summary:', updateError)
      return NextResponse.json({ error: 'Failed to update database summary' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database summary updated successfully'
    })

  } catch (error) {
    console.error('Error updating database summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
