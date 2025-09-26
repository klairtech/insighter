import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject } from '@/lib/encryption'

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

    // Get the database connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
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

    // Check AI definitions status
    let hasAIDefinitions = false
    let hasDatabaseSummary = false
    let selectedTablesCount = 0
    let totalColumnsCount = 0

    try {
      // Check if schema has AI definitions
      if (connection.schema_info_encrypted) {
        const decrypted = decryptObject(connection.schema_info_encrypted) as { schema: { tables?: Array<{ ai_definition?: unknown; columns?: Array<{ ai_definition?: unknown }> }> } }
        const schema = decrypted.schema
        
        if (schema?.tables) {
          // Check if any table has AI definitions
          hasAIDefinitions = schema.tables.some((table) => 
            table.ai_definition || 
            table.columns?.some((col) => col.ai_definition)
          )
          
          // Count columns
          totalColumnsCount = schema.tables.reduce((sum: number, table) => 
            sum + (table.columns?.length || 0), 0
          )
        }
      }

      // Check selected tables count
      if (connection.selected_tables_encrypted) {
        const decrypted = decryptObject(connection.selected_tables_encrypted) as { selectedTables: Array<{ table_name: string; selected_columns: string[] }> }
        selectedTablesCount = decrypted.selectedTables?.length || 0
      }

      // Check if database summary exists (now part of schema)
      if (connection.schema_info_encrypted) {
        const decrypted = decryptObject(connection.schema_info_encrypted) as { schema: { ai_definition?: unknown } }
        hasDatabaseSummary = !!decrypted.schema?.ai_definition
      }

    } catch (error) {
      console.error('Error checking AI status:', error)
    }

    return NextResponse.json({
      success: true,
      ai_status: {
        has_ai_definitions: hasAIDefinitions,
        has_database_summary: hasDatabaseSummary,
        selected_tables_count: selectedTablesCount,
        total_columns_count: totalColumnsCount,
        needs_upgrade: !hasAIDefinitions || !hasDatabaseSummary,
        upgrade_available: selectedTablesCount > 0 && totalColumnsCount > 0
      }
    })

  } catch (error) {
    console.error('Error in check AI status API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
