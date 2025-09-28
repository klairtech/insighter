import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'
import { saveTokenUsageToDatabase } from '@/lib/token-utils-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    const { schema } = await request.json()

    if (!schema) {
      return NextResponse.json({ error: 'Schema is required' }, { status: 400 })
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

    // Generate AI summary
    const summaryResult = await generateDatabaseSummary(connection.name, connection.type, schema)

    // Create database summary object
    const databaseSummary = {
      summary: summaryResult.summary,
      key_points: summaryResult.key_points,
      tags: summaryResult.tags,
      generated_at: new Date().toISOString(),
      generated_by: session.userId,
      tokens_used: summaryResult.tokensUsed
    }

    // Encrypt and save the summary in the database_connections table
    const encryptedSummary = encryptObject(databaseSummary)

    const { error: saveError } = await supabaseServer
      .from('database_connections')
      .update({
        ai_summary_encrypted: encryptedSummary,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (saveError) {
      console.error('Error saving database summary:', saveError)
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
    }

    // Save token usage to database
    const inputTokens = 0; // No input tokens for summary generation
    const outputTokens = 0; // No output tokens tracked
    const tokensUsed = 0; // No tokens used for summary generation
    
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
          agentResponseTokens: outputTokens,
          totalInputTokens: inputTokens,
          totalProcessingTokens: 0,
          totalOutputTokens: outputTokens,
          totalTokensUsed: tokensUsed,
          stageBreakdown: {
            input: inputTokens,
            routing: 0,
            fileProcessing: 0,
            qaGeneration: 0,
            output: outputTokens
          }
        },
        'chat'
      )
    } catch (tokenError) {
      console.warn('Failed to save token usage:', tokenError)
    }

    console.log(`📊 Database summary generation token usage: ${tokensUsed} total (${inputTokens} input, ${outputTokens} output)`)

    // Calculate credits used
    const { calculateCreditsForTokens } = await import('@/lib/credit-utils')
    const creditsUsed = calculateCreditsForTokens(tokensUsed)

    return NextResponse.json({
      success: true,
      summary: {
        id: connectionId,
        ...databaseSummary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      credits_used: creditsUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens
    })

  } catch (error) {
    console.error('Error in generate database summary API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateDatabaseSummary(
  databaseName: string,
  databaseType: string,
  schema: { tables?: Array<{ name: string; columns?: Array<{ name: string; type: string; is_primary_key?: boolean; is_foreign_key?: boolean; is_nullable?: boolean }> }>; views?: Array<{ name: string; columns?: Array<{ name: string; type: string; is_nullable?: boolean }> }> }
): Promise<{
  summary: string;
  key_points: string[];
  tags: string[];
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
}> {
  try {
    // Count tables and views
    const tableCount = schema.tables?.length || 0
    const viewCount = schema.views?.length || 0
    const totalColumns = (schema.tables || []).reduce((sum: number, table: { columns?: unknown[] }) => sum + (table.columns?.length || 0), 0) +
                        (schema.views || []).reduce((sum: number, view: { columns?: unknown[] }) => sum + (view.columns?.length || 0), 0)

    // Analyze table types and relationships
    const columnTypes = new Set<string>()
    const commonPatterns: string[] = []

    // Analyze tables
    schema.tables?.forEach((table: { columns?: Array<{ name: string; type: string }> }) => {
      table.columns?.forEach((column: { name: string; type: string }) => {
        columnTypes.add(column.type)
        
        // Look for common patterns
        if (column.name.toLowerCase().includes('id')) {
          commonPatterns.push('Primary/Foreign Key relationships')
        }
        if (column.name.toLowerCase().includes('created') || column.name.toLowerCase().includes('updated')) {
          commonPatterns.push('Audit trail columns')
        }
        if (column.name.toLowerCase().includes('email')) {
          commonPatterns.push('User/Contact information')
        }
        if (column.name.toLowerCase().includes('status') || column.name.toLowerCase().includes('state')) {
          commonPatterns.push('Status tracking')
        }
      })
    })

    // Generate AI-powered summary using OpenAI
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    
    const systemPrompt = `You are a database analyst AI that generates comprehensive summaries for database schemas.
Your task is to analyze the database structure and create:
1. A detailed summary of the database purpose and structure
2. Key points about the database organization
3. Relevant tags for categorization

Be specific, professional, and focus on the business value and technical insights. Use the AI-generated table and column definitions to provide meaningful insights about the database's purpose and business value.`

    // Check if we have AI-generated definitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasAIDefinitions = schema.tables?.some(table => (table as any).ai_definition) || 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            schema.views?.some(view => (view as any).ai_definition) ||
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (schema as any).ai_definition;

    // Check if we have detailed column information
    const hasDetailedColumns = schema.tables?.some(table => 
      table.columns && table.columns.length > 0 && table.columns[0].type
    ) || schema.views?.some(view => 
      view.columns && view.columns.length > 0 && view.columns[0].type
    );

    let schemaDescription = '';
    
    if (hasAIDefinitions) {
      // Use AI-generated definitions for comprehensive analysis
      /* eslint-disable @typescript-eslint/no-explicit-any */
      schemaDescription = `**AI-Generated Database Analysis:**

**Database Overview:**
${(schema as any).ai_definition ? `
- Description: ${(schema as any).ai_definition.description}
- Business Purpose: ${(schema as any).ai_definition.business_purpose}
- Key Entities: ${Array.isArray((schema as any).ai_definition.key_entities) ? (schema as any).ai_definition.key_entities.join(', ') : (schema as any).ai_definition.key_entities}
- Common Use Cases: ${Array.isArray((schema as any).ai_definition.common_use_cases) ? (schema as any).ai_definition.common_use_cases.join(', ') : (schema as any).ai_definition.common_use_cases}
- Architecture: ${(schema as any).ai_definition.overall_architecture || (schema as any).ai_definition.data_relationships}
` : 'No database-level AI definition available'}

**Tables with AI-Generated Insights:**
${schema.tables?.filter(table => (table as any).ai_definition).map(table => `
- **${table.name}**:
  - Description: ${(table as any).ai_definition.description}
  - Business Purpose: ${(table as any).ai_definition.business_purpose}
  - Key Entities: ${Array.isArray((table as any).ai_definition.key_entities) ? (table as any).ai_definition.key_entities.join(', ') : (table as any).ai_definition.key_entities}
  - Common Use Cases: ${Array.isArray((table as any).ai_definition.common_use_cases) ? (table as any).ai_definition.common_use_cases.join(', ') : (table as any).ai_definition.common_use_cases}
  - Primary Key Analysis: ${(table as any).ai_definition.primary_key_analysis}
  - Foreign Key Relationships: ${Array.isArray((table as any).ai_definition.foreign_key_relationships) ? (table as any).ai_definition.foreign_key_relationships.join(', ') : (table as any).ai_definition.foreign_key_relationships}
`).join('\n') || 'No tables with AI definitions'}

**Views with AI-Generated Insights:**
${schema.views?.filter(view => (view as any).ai_definition).map(view => `
- **${view.name}**:
  - Description: ${(view as any).ai_definition.description}
  - Business Purpose: ${(view as any).ai_definition.business_purpose}
  - Key Entities: ${Array.isArray((view as any).ai_definition.key_entities) ? (view as any).ai_definition.key_entities.join(', ') : (view as any).ai_definition.key_entities}
  - Common Use Cases: ${Array.isArray((view as any).ai_definition.common_use_cases) ? (view as any).ai_definition.common_use_cases.join(', ') : (view as any).ai_definition.common_use_cases}
`).join('\n') || 'No views with AI definitions'}

**Key Column Insights:**
${schema.tables?.flatMap(table => 
  table.columns?.filter(col => (col as any).ai_definition).map(col => 
    `- **${table.name}.${col.name}**: ${(col as any).ai_definition.description} (Purpose: ${(col as any).ai_definition.business_purpose})`
  ) || []
).slice(0, 10).join('\n') || 'No column AI definitions available'}`;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } else if (hasDetailedColumns) {
      // Provide detailed analysis when column information is available
      schemaDescription = `**Detailed Schema Analysis:**

**Tables with Column Details:**
${schema.tables?.filter(table => table.columns && table.columns.length > 0).map(table => `
- **${table.name}** (${table.columns?.length || 0} columns):
  ${table.columns?.map(col => `  - ${col.name}: ${col.type}${col.is_primary_key ? ' (PRIMARY KEY)' : ''}${col.is_foreign_key ? ' (FOREIGN KEY)' : ''}${col.is_nullable ? ' (nullable)' : ' (not null)'}`).join('\n') || 'No columns'}
`).join('\n') || 'No tables with column details'}

**Views with Column Details:**
${schema.views?.filter(view => view.columns && view.columns.length > 0).map(view => `
- **${view.name}** (${view.columns?.length || 0} columns):
  ${view.columns?.map(col => `  - ${col.name}: ${col.type}${col.is_nullable ? ' (nullable)' : ' (not null)'}`).join('\n') || 'No columns'}
`).join('\n') || 'No views with column details'}

**Data Type Analysis:**
${[...new Set(schema.tables?.flatMap(table => table.columns?.map(col => col.type) || []) || [])].join(', ')}

**Relationship Analysis:**
${schema.tables?.filter(table => table.columns?.some(col => col.is_foreign_key)).map(table => 
  `- ${table.name} has foreign key relationships`
).join('\n') || 'No foreign key relationships detected'}`;
    } else {
      // Fallback when only table names are available
      schemaDescription = `**Basic Schema Structure:**
${JSON.stringify(schema, null, 2)}`;
    }

    const userPrompt = `Generate a comprehensive summary for this database:

**Database Information:**
- Name: ${databaseName}
- Type: ${databaseType}
- Tables: ${tableCount}
- Views: ${viewCount}
- Total Columns: ${totalColumns}
- Has AI-Generated Definitions: ${hasAIDefinitions ? 'Yes' : 'No'}
- Has Detailed Column Information: ${hasDetailedColumns ? 'Yes' : 'No'}

${schemaDescription}

**Common Patterns Found:**
${[...new Set(commonPatterns)].join(', ')}

Please provide a JSON response with:
{
  "summary": "Detailed summary of the database purpose and structure based on the AI-generated insights and schema information. Focus on the business value and specific use cases identified by the AI analysis.",
  "key_points": ["Key point 1", "Key point 2", "Key point 3"],
  "tags": ["tag1", "tag2", "tag3"]
}

${hasAIDefinitions ? 'IMPORTANT: Use the AI-generated insights to create a meaningful, business-focused summary that highlights the specific purpose and value of this database.' : ''}`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Clean the content to remove markdown code blocks
    let cleanedContent = content.trim()
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleanedContent)

    return {
      summary: parsed.summary || `This ${databaseType} database named "${databaseName}" contains ${tableCount} tables and ${viewCount} views with a total of ${totalColumns} columns.`,
      key_points: parsed.key_points || [`${tableCount} tables and ${viewCount} views`, `${totalColumns} total columns`],
      tags: parsed.tags || [databaseType.toLowerCase(), `${tableCount}-tables`],
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    }

  } catch (error) {
    console.error('Error generating database summary:', error)
    
    // Fallback summary
    return {
      summary: `This ${databaseType} database named "${databaseName}" contains database tables and views. The schema has been successfully loaded and is ready for analysis.`,
      key_points: [
        `Database type: ${databaseType.toUpperCase()}`,
        'Schema successfully loaded',
        'Ready for data analysis'
      ],
      tags: [databaseType.toLowerCase(), 'database-schema', 'loaded'],
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    }
  }
}
