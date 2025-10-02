import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject, encryptObject } from '@/lib/encryption'
import { generateHierarchicalAIDefinitions } from '@/lib/hierarchical-ai-generation'
import { DatabaseSchema, SelectedTable } from '@/types/database-schema'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'

/**
 * API endpoint to generate hierarchical AI definitions:
 * 1. Column definitions (using sample data)
 * 2. Table definitions (based on column definitions)
 * 3. Database definition (based on table definitions)
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

    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

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

    // Check if user has access to the organization
    const { data: orgMember, error: orgMemberError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', session.user.id)
      .single()

    if (orgMemberError || !orgMember) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 })
    }

    // Decrypt schema information
    let schema: DatabaseSchema | null = null
    let selectedTables: SelectedTable[] | null = null

    try {
      if (connection.schema_info_encrypted) {
        const decrypted = decryptObject(connection.schema_info_encrypted) as { schema: DatabaseSchema }
        schema = decrypted.schema
      }
      if (connection.selected_tables_encrypted) {
        const decrypted = decryptObject(connection.selected_tables_encrypted) as { selectedTables: SelectedTable[] }
        selectedTables = decrypted.selectedTables
      }
    } catch (decryptError) {
      console.error('Error decrypting schema information:', decryptError)
      return NextResponse.json({ error: 'Failed to decrypt schema information' }, { status: 500 })
    }

    if (!schema || !selectedTables) {
      return NextResponse.json({ error: 'No schema or selected tables found' }, { status: 400 })
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not found in environment variables')
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please contact your administrator.',
        details: 'OPENAI_API_KEY environment variable is missing'
      }, { status: 500 })
    }


    // Generate hierarchical AI definitions
    const {
      columnDefinitions,
      tableDefinitions,
      databaseDefinition,
      totalTokensUsed,
      totalInputTokens,
      totalOutputTokens
    } = await generateHierarchicalAIDefinitions(
      schema,
      selectedTables,
      connection.name,
      connection.type
    )

    // Update schema with AI definitions
    const updatedSchema = { ...schema }

    // Apply column definitions
    for (const [columnKey, columnDef] of columnDefinitions) {
      const [tableName, columnName] = columnKey.split('.')
      
      // Find and update the column in tables
      const table = updatedSchema.tables?.find(t => t.name === tableName)
      if (table) {
        const column = table.columns?.find(c => c.name === columnName)
        if (column) {
          column.ai_definition = columnDef
        }
      }
      
      // Find and update the column in views
      const view = updatedSchema.views?.find(v => v.name === tableName)
      if (view) {
        const column = view.columns?.find(c => c.name === columnName)
        if (column) {
          column.ai_definition = columnDef
        }
      }
    }

    // Apply table definitions
    for (const [tableName, tableDef] of tableDefinitions) {
      // Update table
      const table = updatedSchema.tables?.find(t => t.name === tableName)
      if (table) {
        table.ai_definition = tableDef
      }
      
      // Update view
      const view = updatedSchema.views?.find(v => v.name === tableName)
      if (view) {
        view.ai_definition = tableDef
      }
    }

    // Apply database-level AI definition to the schema
    updatedSchema.ai_definition = databaseDefinition

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

    // Database definition is now saved as part of the schema (unified structure)
    // No need to save separately to database_summaries table

    // Save token usage to database
    try {
      await saveTokenUsageToDatabase(
        session.userId,
        {
          userInputTokens: 0,
          systemPromptTokens: 0,
          contextTokens: 0,
          routerAgentTokens: 0,
          qaAgentTokens: 0,
          fileContentTokens: 0,
          conversationHistoryTokens: 0,
          agentResponseTokens: totalOutputTokens,
          totalInputTokens: totalInputTokens,
          totalProcessingTokens: 0,
          totalOutputTokens: totalOutputTokens,
          totalTokensUsed: totalTokensUsed,
          stageBreakdown: {
            input: totalInputTokens,
            routing: 0,
            fileProcessing: 0,
            qaGeneration: 0,
            output: totalOutputTokens
          }
        },
        'chat'
      )
    } catch (tokenError) {
      console.warn('Failed to save token usage:', tokenError)
    }


    return NextResponse.json({
      success: true,
      message: `Hierarchical AI definitions generated successfully`,
      columns_processed: columnDefinitions.size,
      tables_processed: tableDefinitions.size,
      database_definition_generated: true,
      tokens_used: totalTokensUsed,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      details: {
        column_definitions: Array.from(columnDefinitions.keys()),
        table_definitions: Array.from(tableDefinitions.keys()),
        database_definition: 'Generated and saved'
      }
    })

  } catch (error) {
    console.error('Error generating hierarchical AI definitions:', error)
    return NextResponse.json({ 
      error: 'Internal server error during hierarchical AI generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
