import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject, encryptObject } from '@/lib/encryption'
import { generateColumnAIDefinition, generateTableAIDefinition } from '@/lib/database-column-ai'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'

/**
 * API endpoint to manually regenerate AI definitions for an existing database connection
 * This can be used to fix cases where AI definitions weren't generated during initial setup
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params

    // Get database connection with encrypted config
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Check access permissions
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', connection.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', session.userId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Decrypt schema and selected tables
    const schema = (decryptObject(connection.schema_info_encrypted) as { schema: { tables: Array<{ name: string; type: string; columns?: Array<{ name: string; type: string; is_primary_key: boolean; is_foreign_key: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[]; ai_definition?: unknown }>; row_count?: number; ai_definition?: unknown }>; views?: Array<{ name: string; type: string; columns?: Array<{ name: string; type: string; is_primary_key: boolean; is_foreign_key: boolean; foreign_table?: string; foreign_column?: string; sample_values?: string[]; ai_definition?: unknown }>; row_count?: number; ai_definition?: unknown }>; database_name: string } }).schema
    const selectedTables = (decryptObject(connection.selected_tables_encrypted) as { selectedTables: Array<{ table_name: string; selected_columns: string[] }> }).selectedTables

    console.log('🔄 Regenerating AI definitions for connection:', {
      connectionId,
      tablesCount: schema.tables.length,
      selectedTablesCount: selectedTables.length
    })

    let totalTokensUsed = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let tablesProcessed = 0
    let columnsProcessed = 0

    const updatedSchema = { ...schema }
    
    // Process tables
    for (const selectedTable of selectedTables) {
      const table = updatedSchema.tables.find(t => t.name === selectedTable.table_name)
      if (table) {
        console.log(`🤖 Regenerating AI definitions for table: ${table.name}`)
        
        // Generate AI definition for the table
        try {
          const tableAiResult = await generateTableAIDefinition(
            table.name,
            table.type as 'table' | 'view',
            table.columns || [],
            table.row_count || 0,
            schema.database_name
          )
          table.ai_definition = tableAiResult.result
          totalTokensUsed += tableAiResult.tokensUsed
          totalInputTokens += tableAiResult.inputTokens
          totalOutputTokens += tableAiResult.outputTokens
          tablesProcessed++
        } catch (error) {
          console.error(`Error generating AI definition for table ${table.name}:`, error)
        }

        // Generate AI definitions for selected columns only
        for (const column of table.columns || []) {
          if (selectedTable.selected_columns.includes(column.name)) {
            try {
              const columnAiResult = await generateColumnAIDefinition(
                column.name,
                column.type,
                column.is_primary_key,
                column.is_foreign_key,
                table.name,
                schema.database_name,
                column.foreign_table,
                column.foreign_column,
                column.sample_values || []
              )
              column.ai_definition = columnAiResult.result
              totalTokensUsed += columnAiResult.tokensUsed
              totalInputTokens += columnAiResult.inputTokens
              totalOutputTokens += columnAiResult.outputTokens
              columnsProcessed++
            } catch (error) {
              console.error(`Error generating AI definition for column ${column.name}:`, error)
            }
          }
        }
      }
    }

    // Process views (if any are selected)
    for (const selectedTable of selectedTables) {
      const view = updatedSchema.views?.find(v => v.name === selectedTable.table_name)
      if (view) {
        console.log(`🤖 Regenerating AI definitions for view: ${view.name}`)
        
        // Generate AI definition for the view
        try {
          const viewAiResult = await generateTableAIDefinition(
            view.name,
            view.type as 'table' | 'view',
            view.columns || [],
            view.row_count || 0,
            schema.database_name
          )
          view.ai_definition = viewAiResult.result
          totalTokensUsed += viewAiResult.tokensUsed
          totalInputTokens += viewAiResult.inputTokens
          totalOutputTokens += viewAiResult.outputTokens
          tablesProcessed++
        } catch (error) {
          console.error(`Error generating AI definition for view ${view.name}:`, error)
        }

        // Generate AI definitions for selected columns only
        for (const column of view.columns || []) {
          if (selectedTable.selected_columns.includes(column.name)) {
            try {
              const columnAiResult = await generateColumnAIDefinition(
                column.name,
                column.type,
                column.is_primary_key,
                column.is_foreign_key,
                view.name,
                schema.database_name,
                column.foreign_table,
                column.foreign_column,
                column.sample_values || []
              )
              column.ai_definition = columnAiResult.result
              totalTokensUsed += columnAiResult.tokensUsed
              totalInputTokens += columnAiResult.inputTokens
              totalOutputTokens += columnAiResult.outputTokens
              columnsProcessed++
            } catch (error) {
              console.error(`Error generating AI definition for column ${column.name}:`, error)
            }
          }
        }
      }
    }

    // Save updated schema with AI definitions
    const encryptedSchema = encryptObject({ schema: updatedSchema })
    
    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_info_encrypted: encryptedSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating schema with AI definitions:', updateError)
      return NextResponse.json({ error: 'Failed to save AI definitions' }, { status: 500 })
    }

    // Update token usage
    if (totalTokensUsed > 0) {
      await saveTokenUsageToDatabase(session.userId, {
        userInputTokens: 0,
        systemPromptTokens: 0,
        contextTokens: 0,
        routerAgentTokens: 0,
        qaAgentTokens: 0,
        fileContentTokens: 0,
        conversationHistoryTokens: 0,
        agentResponseTokens: totalOutputTokens,
        totalInputTokens,
        totalProcessingTokens: 0,
        totalOutputTokens,
        totalTokensUsed: totalInputTokens + totalOutputTokens,
        stageBreakdown: {
          input: totalInputTokens,
          routing: 0,
          fileProcessing: 0,
          qaGeneration: 0,
          output: totalOutputTokens
        }
      }, 'chat')
    }

    console.log('✅ AI definitions regenerated successfully:', {
      tablesProcessed,
      columnsProcessed,
      totalTokensUsed
    })

    return NextResponse.json({
      success: true,
      message: `AI definitions regenerated for ${tablesProcessed} tables and ${columnsProcessed} columns`,
      tables_processed: tablesProcessed,
      columns_processed: columnsProcessed,
      tokens_used: totalTokensUsed
    })

  } catch (error) {
    console.error('Error regenerating AI definitions:', error)
    return NextResponse.json({ 
      error: 'Internal server error during AI definition regeneration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
