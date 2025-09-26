import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params

    // Get database connection
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('id, name, workspace_id')
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

    // Get database summary
    const { data: summary, error: summaryError } = await supabaseServer
      .from('database_summaries')
      .select('*')
      .eq('database_connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (summaryError && summaryError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching database summary:', summaryError)
      return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      summary: summary || null
    })

  } catch (error) {
    console.error('Error in database summary API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
