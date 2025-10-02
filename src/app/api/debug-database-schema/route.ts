import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject } from '@/lib/encryption'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    console.log(`🔍 Debugging database connection: ${connectionId}`)
    
    // Get the database connection
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      console.error('❌ Database connection not found:', error)
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    const debugInfo: Record<string, unknown> = {
      connection: {
        name: connection.name,
        type: connection.type,
        database: connection.database,
        schema_name: connection.schema_name,
        last_schema_sync: connection.last_schema_sync,
        schema_version: connection.schema_version,
        has_schema_info: !!connection.schema_info_encrypted,
        has_selected_tables: !!connection.selected_tables_encrypted
      }
    }

    // Decrypt and examine schema info
    if (connection.schema_info_encrypted) {
      try {
        const decryptedSchema = decryptObject(connection.schema_info_encrypted) as { schema: { database_name: string; database_type: string; total_tables?: number; total_views?: number; tables?: Array<{ name: string; type: string; columns?: Array<{ name: string }> }>; views?: Array<{ name: string; type: string; columns?: Array<{ name: string }> }> } }
        const schema = decryptedSchema.schema
        
        debugInfo.schema = {
          database_name: schema.database_name,
          database_type: schema.database_type,
          total_tables: schema.total_tables || 0,
          total_views: schema.total_views || 0,
          tables: schema.tables?.map((table: { name: string; type: string; columns?: Array<{ name: string }> }) => ({
            name: table.name,
            type: table.type,
            column_count: table.columns?.length || 0,
            has_columns: !!(table.columns && table.columns.length > 0),
            column_names: table.columns?.map((c: { name: string }) => c.name) || []
          })) || [],
          views: schema.views?.map((view: { name: string; type: string; columns?: Array<{ name: string }> }) => ({
            name: view.name,
            type: view.type,
            column_count: view.columns?.length || 0,
            has_columns: !!(view.columns && view.columns.length > 0),
            column_names: view.columns?.map((c: { name: string }) => c.name) || []
          })) || []
        }
      } catch (decryptError) {
        debugInfo.schema_error = `Error decrypting schema: ${decryptError}`
      }
    }

    // Check selected tables
    if (connection.selected_tables_encrypted) {
      try {
        const decryptedTables = decryptObject(connection.selected_tables_encrypted) as { selectedTables: Array<{ table_name: string; selected_columns?: string[] }> }
        debugInfo.selected_tables = decryptedTables.selectedTables.map((table: { table_name: string; selected_columns?: string[] }) => ({
          table_name: table.table_name,
          selected_columns_count: table.selected_columns?.length || 0,
          selected_columns: table.selected_columns || []
        }))
      } catch (decryptError) {
        debugInfo.selected_tables_error = `Error decrypting selected tables: ${decryptError}`
      }
    }

    // Check database summary from connection
    if (connection.ai_summary_encrypted) {
      try {
        const decryptedSummary = decryptObject(connection.ai_summary_encrypted) as { 
          summary?: string; 
          key_points?: string[]; 
          tags?: string[]; 
          generated_at?: string;
          generated_by?: string;
          tokens_used?: number;
        }
        debugInfo.summary = {
          generated_at: decryptedSummary.generated_at,
          generated_by: decryptedSummary.generated_by,
          tokens_used: decryptedSummary.tokens_used,
          summary_preview: decryptedSummary.summary?.substring(0, 200) + '...',
          key_points_count: decryptedSummary.key_points?.length || 0,
          tags: decryptedSummary.tags || []
        }
      } catch (decryptError) {
        debugInfo.summary_error = `Error decrypting summary: ${decryptError}`
      }
    } else {
      debugInfo.summary = null
    }

    return NextResponse.json({
      success: true,
      debug_info: debugInfo
    })

  } catch (error) {
    console.error('❌ Error debugging database schema:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
