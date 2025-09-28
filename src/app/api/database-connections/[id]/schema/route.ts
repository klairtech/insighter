import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject } from '@/lib/encryption'
import { DatabaseSchema } from '@/types/database-schema'

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
    const { searchParams } = new URL(request.url)
    const showAllTables = searchParams.get('showAll') === 'true'

    // Get database connection with encrypted schema data
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('id, name, type, workspace_id, schema_info_encrypted, selected_tables_encrypted, last_schema_sync, schema_version')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      console.error('Error fetching database connection:', error)
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

    // Decrypt schema information
    let schema: DatabaseSchema | null = null
    let selectedTables: Array<{ table_name: string; selected_columns: string[] }> | null = null

    try {
      if (connection.schema_info_encrypted) {
        const decryptedSchema = decryptObject(connection.schema_info_encrypted)
        schema = decryptedSchema.schema as DatabaseSchema
      }

      if (connection.selected_tables_encrypted) {
        const decryptedTables = decryptObject(connection.selected_tables_encrypted)
        selectedTables = decryptedTables.selectedTables as Array<{ table_name: string; selected_columns: string[] }>
      }
    } catch (decryptError) {
      console.error('Error decrypting schema data:', decryptError)
      return NextResponse.json({ error: 'Failed to decrypt schema data' }, { status: 500 })
    }

    if (!schema) {
      return NextResponse.json({ error: 'No schema data available' }, { status: 404 })
    }

    // Filter schema to only include selected tables (default behavior for database detail page)
    // But if no selected tables are found or showAllTables is true, show all tables as a fallback
    if (!showAllTables && selectedTables && selectedTables.length > 0) {
      const selectedTableNames = selectedTables.map(t => t.table_name)
      
      schema = {
        ...schema,
        tables: schema.tables.filter(table => selectedTableNames.includes(table.name)),
        views: schema.views.filter(view => selectedTableNames.includes(view.name))
      }
      
    } else {
      // Don't filter - show all tables and views
    }

    // Database summary is now part of the schema (unified structure)
    // No need to fetch separately from database_summaries table


    return NextResponse.json({
      success: true,
      schema,
      selected_tables: selectedTables,
      last_sync: connection.last_schema_sync,
      schema_version: connection.schema_version
    })

  } catch (error) {
    console.error('Error in database schema API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}