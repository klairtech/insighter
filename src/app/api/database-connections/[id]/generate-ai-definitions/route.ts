import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { decryptObject, encryptObject } from '@/lib/encryption'
import { generateColumnAIDefinition, generateTableAIDefinition } from '@/lib/database-column-ai'
import { DatabaseSchema, SelectedTable } from '@/types/database-schema'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'

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

    const storedSchemaName = connection.schema_name || 'public'
    console.log(`🤖 Generating AI definitions for ${selectedTables.length} selected tables in schema '${storedSchemaName}'...`)

    // Track total tokens used for AI generation
    let totalTokensUsed = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let tablesProcessed = 0
    let columnsProcessed = 0
    const errors: string[] = []

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not found in environment variables')
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please contact your administrator.',
        details: 'OPENAI_API_KEY environment variable is missing'
      }, { status: 500 })
    }

    // Generate AI definitions only for selected tables
    const updatedSchema = { ...schema }
    
    // Process tables
    for (const selectedTable of selectedTables) {
      const table = updatedSchema.tables.find(t => t.name === selectedTable.table_name)
      if (table) {
        console.log(`🤖 Generating AI definitions for table: ${table.name}`)
        
        // Generate AI definition for the table
        try {
          const tableAiResult = await generateTableAIDefinition(
            table.name,
            table.type,
            table.columns,
            table.row_count || 0,
            schema.database_name
          )
          table.ai_definition = {
            ...tableAiResult.result,
            column_summary: '',
            primary_key_analysis: '',
            foreign_key_relationships: []
          }
          totalTokensUsed += tableAiResult.tokensUsed
          totalInputTokens += tableAiResult.inputTokens
          totalOutputTokens += tableAiResult.outputTokens
          tablesProcessed++
          console.log(`✅ AI definition generated for table: ${table.name}`)
        } catch (error) {
          const errorMsg = `Failed to generate AI definition for table ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }

        // Generate AI definitions for selected columns only
        for (const column of table.columns) {
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
              console.log(`✅ AI definition generated for column: ${table.name}.${column.name}`)
            } catch (error) {
              const errorMsg = `Failed to generate AI definition for column ${table.name}.${column.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
              console.error(`❌ ${errorMsg}`)
              errors.push(errorMsg)
            }
          }
        }
      }
    }

    // Process views (if any are selected)
    for (const selectedTable of selectedTables) {
      const view = updatedSchema.views.find(v => v.name === selectedTable.table_name)
      if (view) {
        console.log(`🤖 Generating AI definitions for view: ${view.name}`)
        
        // Generate AI definition for the view
        try {
          const viewAiResult = await generateTableAIDefinition(
            view.name,
            view.type,
            view.columns,
            view.row_count || 0,
            schema.database_name
          )
          view.ai_definition = {
            ...viewAiResult.result,
            column_summary: '',
            primary_key_analysis: '',
            foreign_key_relationships: []
          }
          totalTokensUsed += viewAiResult.tokensUsed
          totalInputTokens += viewAiResult.inputTokens
          totalOutputTokens += viewAiResult.outputTokens
          tablesProcessed++
          console.log(`✅ AI definition generated for view: ${view.name}`)
        } catch (error) {
          const errorMsg = `Failed to generate AI definition for view ${view.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }

        // Generate AI definitions for selected columns only
        for (const column of view.columns) {
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
              console.log(`✅ AI definition generated for column: ${view.name}.${column.name}`)
            } catch (error) {
              const errorMsg = `Failed to generate AI definition for column ${view.name}.${column.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
              console.error(`❌ ${errorMsg}`)
              errors.push(errorMsg)
            }
          }
        }
      }
    }

    // Encrypt and save the updated schema with AI definitions
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

    console.log(`✅ Successfully generated AI definitions for ${selectedTables.length} tables`)
    console.log(`📊 Token usage: ${totalTokensUsed} total (${totalInputTokens} input, ${totalOutputTokens} output)`)

    // Save token usage to database
    try {
      await saveTokenUsageToDatabase(
        session.user.id,
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

    // Determine if the operation was successful
    const hasErrors = errors.length > 0
    const hasSuccessfulGenerations = tablesProcessed > 0 || columnsProcessed > 0

    if (hasErrors && !hasSuccessfulGenerations) {
      // All generations failed
      return NextResponse.json({
        success: false,
        error: 'Failed to generate AI definitions',
        details: errors,
        tables_processed: 0,
        columns_processed: 0,
        tokens_used: 0
      }, { status: 500 })
    } else if (hasErrors && hasSuccessfulGenerations) {
      // Partial success
      return NextResponse.json({
        success: true,
        message: `AI definitions generated for ${tablesProcessed} tables and ${columnsProcessed} columns, but some failed`,
        warnings: errors,
        tables_processed: tablesProcessed,
        columns_processed: columnsProcessed,
        tokens_used: totalTokensUsed,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens
      })
    } else {
      // Complete success
      return NextResponse.json({
        success: true,
        message: `AI definitions generated successfully for ${tablesProcessed} tables and ${columnsProcessed} columns`,
        tables_processed: tablesProcessed,
        columns_processed: columnsProcessed,
        tokens_used: totalTokensUsed,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens
      })
    }

  } catch (error) {
    console.error('Error generating AI definitions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
