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

    // Get database connection with summary
    const { data: connectionWithSummary, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select('ai_summary_encrypted')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError) {
      console.error('Error fetching database connection:', connectionError)
      return NextResponse.json({ error: 'Failed to fetch database connection' }, { status: 500 })
    }

    if (!connectionWithSummary?.ai_summary_encrypted) {
      return NextResponse.json({
        success: true,
        summary: null
      })
    }

    // Decrypt the summary
    let decryptedSummary
    try {
      const { decryptObject } = await import('@/lib/encryption')
      decryptedSummary = decryptObject(connectionWithSummary.ai_summary_encrypted)
    } catch (decryptError) {
      console.error('Error decrypting summary:', decryptError)
      return NextResponse.json({ error: 'Failed to decrypt summary' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      summary: decryptedSummary
    })

  } catch (error) {
    console.error('Error in database summary API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
