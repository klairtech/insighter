import OpenAI from 'openai';
import { DatabaseSchema, DatabaseTable, DatabaseColumn } from '@/types/database-schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIGenerationResult<T> {
  result: T;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ColumnAIDefinition {
  description: string;
  business_purpose: string;
  data_insights: string[];
  common_queries: string[];
  relationships: string[];
  data_quality_notes: string[];
  sample_data_analysis?: string;
}

export interface TableAIDefinition {
  description: string;
  business_purpose: string;
  key_entities: string[];
  common_use_cases: string[];
  data_relationships: string[];
  column_summary: string;
  primary_key_analysis: string;
  foreign_key_relationships: string[];
}

export interface DatabaseAIDefinition {
  description: string;
  business_purpose: string;
  key_entities: string[];
  common_use_cases: string[];
  data_relationships: string[];
  table_summary: string;
  overall_architecture: string;
  data_flow_analysis: string;
}

/**
 * Step 1: Generate AI definition for a single column using sample data
 */
export async function generateColumnAIDefinition(
  column: DatabaseColumn,
  tableName: string,
  databaseName: string
): Promise<AIGenerationResult<ColumnAIDefinition>> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const systemPrompt = `You are a database analyst AI that generates intelligent descriptions for database columns.
Your task is to analyze column metadata and sample data to create comprehensive definitions that help users understand:
1. What the column represents
2. Its business purpose
3. What insights can be derived from it
4. Common query patterns
5. Relationships with other data
6. Data quality considerations
7. Analysis of sample data patterns

Be specific, practical, and focus on how users would interact with this data.`;

    const sampleDataAnalysis = column.sample_values && column.sample_values.length > 0 
      ? `\n**Sample Data Analysis:**
${column.sample_values.slice(0, 10).map((value, index) => `${index + 1}. ${value}`).join('\n')}
${column.sample_values.length > 10 ? `\n... and ${column.sample_values.length - 10} more values` : ''}`
      : '\n**Sample Data:** No sample data available';

    const userPrompt = `Generate an AI definition for this database column:

**Column Information:**
- Column Name: ${column.name}
- Data Type: ${column.type}
- Table: ${tableName}
- Database: ${databaseName}
- Is Primary Key: ${column.is_primary_key}
- Is Foreign Key: ${column.is_foreign_key}
- Nullable: ${column.nullable}
${column.foreign_table ? `- References: ${column.foreign_table}.${column.foreign_column}` : ''}
${column.default_value ? `- Default Value: ${column.default_value}` : ''}${sampleDataAnalysis}

Provide a JSON response with:
{
  "description": "Clear, concise description of what this column represents",
  "business_purpose": "Why this column exists and its business value",
  "data_insights": ["What insights can be derived from this column"],
  "common_queries": ["Common query patterns users might use"],
  "relationships": ["How this column relates to other data"],
  "data_quality_notes": ["Potential data quality considerations"],
  "sample_data_analysis": "Analysis of patterns in the sample data"
}

Focus on practical, actionable information that helps users understand and work with this data.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      result: {
        description: parsed.description || `Column ${column.name} of type ${column.type}`,
        business_purpose: parsed.business_purpose || 'Data storage and retrieval',
        data_insights: parsed.data_insights || [],
        common_queries: parsed.common_queries || [],
        relationships: parsed.relationships || [],
        data_quality_notes: parsed.data_quality_notes || [],
        sample_data_analysis: parsed.sample_data_analysis || 'No sample data analysis available'
      },
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    };

  } catch (error) {
    console.error('Error generating column AI definition:', error);
    
    // Fallback definition
    return {
      result: {
        description: `${column.name} is a ${column.type} column${column.is_primary_key ? ' that serves as the primary key' : ''}${column.is_foreign_key ? ` that references ${column.foreign_table}.${column.foreign_column}` : ''}`,
        business_purpose: 'Data storage and retrieval',
        data_insights: ['Contains structured data for analysis'],
        common_queries: [`SELECT ${column.name} FROM ${tableName}`],
        relationships: column.is_foreign_key ? [`References ${column.foreign_table}.${column.foreign_column}`] : [],
        data_quality_notes: ['Verify data integrity and consistency'],
        sample_data_analysis: 'Sample data analysis not available'
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * Step 2: Generate AI definition for a table based on all its column definitions
 */
export async function generateTableAIDefinition(
  table: DatabaseTable,
  databaseName: string,
  columnDefinitions: ColumnAIDefinition[]
): Promise<AIGenerationResult<TableAIDefinition>> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const systemPrompt = `You are a database analyst AI that generates intelligent descriptions for database tables and views.
Your task is to analyze table structure and column definitions to create comprehensive definitions that help users understand:
1. What the table represents
2. Its business purpose
3. Key entities and concepts
4. Common use cases
5. Data relationships
6. How columns work together

Be specific, practical, and focus on how users would interact with this data.`;

    const primaryKeys = table.columns.filter(col => col.is_primary_key).map(col => col.name);
    const foreignKeys = table.columns.filter(col => col.is_foreign_key);
    const relationships = foreignKeys.map(fk => 
      `${fk.name} → ${fk.foreign_table}.${fk.foreign_column}`
    );

    const columnDefinitionsText = columnDefinitions.map((colDef, index) => 
      `${index + 1}. **${table.columns[index]?.name}** (${table.columns[index]?.type}):
   - Purpose: ${colDef.business_purpose}
   - Description: ${colDef.description}
   - Key Insights: ${colDef.data_insights.slice(0, 2).join(', ')}`
    ).join('\n\n');

    const userPrompt = `Generate an AI definition for this database ${table.type} based on its column definitions:

**Table Information:**
- Table Name: ${table.name}
- Type: ${table.type}
- Database: ${databaseName}
- Row Count: ${table.row_count || 'Unknown'}
- Primary Keys: ${primaryKeys.join(', ') || 'None'}
- Foreign Key Relationships: ${relationships.join(', ') || 'None'}

**Column Definitions:**
${columnDefinitionsText}

Provide a JSON response with:
{
  "description": "Clear, comprehensive description of what this table represents",
  "business_purpose": "Why this table exists and its business value",
  "key_entities": ["Key entities, concepts, or objects this table represents"],
  "common_use_cases": ["Common ways this table is used in queries and analysis"],
  "data_relationships": ["How this table relates to other tables and data"],
  "column_summary": "Summary of how the columns work together",
  "primary_key_analysis": "Analysis of the primary key structure and purpose",
  "foreign_key_relationships": ["Detailed foreign key relationships and their business meaning"]
}

Focus on practical, actionable information that helps users understand and work with this data.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      result: {
        description: parsed.description || `Table ${table.name} containing ${table.columns.length} columns`,
        business_purpose: parsed.business_purpose || 'Data storage and retrieval',
        key_entities: parsed.key_entities || [],
        common_use_cases: parsed.common_use_cases || [],
        data_relationships: parsed.data_relationships || [],
        column_summary: parsed.column_summary || 'Columns work together to store structured data',
        primary_key_analysis: parsed.primary_key_analysis || 'Primary key ensures unique identification',
        foreign_key_relationships: parsed.foreign_key_relationships || relationships
      },
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    };

  } catch (error) {
    console.error('Error generating table AI definition:', error);
    
    // Fallback definition
    const foreignKeys = table.columns.filter(col => col.is_foreign_key);
    const relationships = foreignKeys.map(fk => 
      `${fk.name} → ${fk.foreign_table}.${fk.foreign_column}`
    );
    
    return {
      result: {
        description: `Table ${table.name} containing ${table.columns.length} columns`,
        business_purpose: 'Data storage and retrieval',
        key_entities: ['Data entities'],
        common_use_cases: ['Data queries and analysis'],
        data_relationships: relationships,
        column_summary: 'Columns work together to store structured data',
        primary_key_analysis: 'Primary key ensures unique identification',
        foreign_key_relationships: relationships
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * Step 3: Generate AI definition for the entire database based on all table definitions
 */
export async function generateDatabaseAIDefinition(
  databaseName: string,
  databaseType: string,
  tableDefinitions: Array<{ table: DatabaseTable; definition: TableAIDefinition }>
): Promise<AIGenerationResult<DatabaseAIDefinition>> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const systemPrompt = `You are a database analyst AI that generates intelligent descriptions for entire databases.
Your task is to analyze all table definitions to create a comprehensive database overview that helps users understand:
1. What the database represents as a whole
2. Its overall business purpose
3. Key entities and concepts across all tables
4. Common use cases and workflows
5. Data relationships and architecture
6. How tables work together

Be specific, practical, and focus on how users would interact with this database system.`;

    const tableDefinitionsText = tableDefinitions.map(({ table, definition }, index) => 
      `${index + 1}. **${table.name}** (${table.type}):
   - Purpose: ${definition.business_purpose}
   - Description: ${definition.description}
   - Key Entities: ${definition.key_entities.slice(0, 3).join(', ')}
   - Common Uses: ${definition.common_use_cases.slice(0, 2).join(', ')}
   - Relationships: ${definition.data_relationships.slice(0, 2).join(', ')}`
    ).join('\n\n');

    const userPrompt = `Generate an AI definition for this entire database based on all its table definitions:

**Database Information:**
- Database Name: ${databaseName}
- Database Type: ${databaseType}
- Total Tables: ${tableDefinitions.length}
- Total Views: ${tableDefinitions.filter(td => td.table.type === 'view').length}

**Table Definitions:**
${tableDefinitionsText}

Provide a JSON response with:
{
  "description": "Clear, comprehensive description of what this database represents as a whole",
  "business_purpose": "Why this database exists and its overall business value",
  "key_entities": ["Key entities, concepts, or objects this database represents"],
  "common_use_cases": ["Common ways this database is used in business operations"],
  "data_relationships": ["How data flows and relates across the entire database"],
  "table_summary": "Summary of how all tables work together",
  "overall_architecture": "Description of the database architecture and design patterns",
  "data_flow_analysis": "Analysis of how data flows through the system"
}

Focus on practical, actionable information that helps users understand and work with this database system.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      result: {
        description: parsed.description || `Database ${databaseName} containing ${tableDefinitions.length} tables`,
        business_purpose: parsed.business_purpose || 'Data storage and retrieval system',
        key_entities: parsed.key_entities || [],
        common_use_cases: parsed.common_use_cases || [],
        data_relationships: parsed.data_relationships || [],
        table_summary: parsed.table_summary || 'Tables work together to provide comprehensive data management',
        overall_architecture: parsed.overall_architecture || 'Relational database architecture',
        data_flow_analysis: parsed.data_flow_analysis || 'Data flows through interconnected tables'
      },
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    };

  } catch (error) {
    console.error('Error generating database AI definition:', error);
    
    // Fallback definition
    return {
      result: {
        description: `Database ${databaseName} containing ${tableDefinitions.length} tables`,
        business_purpose: 'Data storage and retrieval system',
        key_entities: ['Data entities'],
        common_use_cases: ['Data management and analysis'],
        data_relationships: ['Interconnected data relationships'],
        table_summary: 'Tables work together to provide comprehensive data management',
        overall_architecture: 'Relational database architecture',
        data_flow_analysis: 'Data flows through interconnected tables'
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * Main function to generate hierarchical AI definitions
 * 1. Generate column definitions using sample data
 * 2. Generate table definitions based on column definitions
 * 3. Generate database definition based on table definitions
 */
export async function generateHierarchicalAIDefinitions(
  schema: DatabaseSchema,
  selectedTables: Array<{ table_name: string; selected_columns: string[] }>,
  databaseName: string,
  databaseType: string
): Promise<{
  columnDefinitions: Map<string, ColumnAIDefinition>;
  tableDefinitions: Map<string, TableAIDefinition>;
  databaseDefinition: DatabaseAIDefinition;
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  
  let totalTokensUsed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  const columnDefinitions = new Map<string, ColumnAIDefinition>();
  const tableDefinitions = new Map<string, TableAIDefinition>();

  // Step 1: Generate column definitions for all selected columns
  console.log(`🤖 Starting hierarchical AI generation for ${selectedTables.length} tables`)
  
  for (const selectedTable of selectedTables) {
    const table = [...(schema.tables || []), ...(schema.views || [])].find(t => t.name === selectedTable.table_name);
    if (!table) {
      console.log(`❌ Table not found: ${selectedTable.table_name}`)
      continue
    }

    console.log(`📊 Processing table: ${table.name} with ${selectedTable.selected_columns.length} selected columns`)
    console.log(`  📋 Selected columns: ${selectedTable.selected_columns.join(', ')}`)
    console.log(`  📊 Available columns: ${table.columns.map(c => c.name).join(', ')}`)
    
    for (const column of table.columns) {
      if (selectedTable.selected_columns.includes(column.name)) {
        console.log(`  🔍 Generating AI definition for column: ${table.name}.${column.name}`)
        
        try {
          const result = await generateColumnAIDefinition(column, table.name, databaseName);
          columnDefinitions.set(`${table.name}.${column.name}`, result.result);
          totalTokensUsed += result.tokensUsed;
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;
          
          console.log(`  ✅ Generated AI definition for ${table.name}.${column.name}`)
        } catch (error) {
          console.error(`    ❌ Failed to generate definition for ${table.name}.${column.name}:`, error);
        }
      } else {
        console.log(`  ⚠️ Column ${column.name} not in selected columns`)
      }
    }
  }

  // Step 2: Generate table definitions based on column definitions
  console.log(`📋 Generated ${columnDefinitions.size} column definitions, now generating table definitions`)
  
  for (const selectedTable of selectedTables) {
    const table = [...(schema.tables || []), ...(schema.views || [])].find(t => t.name === selectedTable.table_name);
    if (!table) continue;

    console.log(`🏗️ Generating table definition for: ${table.name}`)
    
    // Get column definitions for this table
    const tableColumnDefinitions = table.columns
      .filter(col => selectedTable.selected_columns.includes(col.name))
      .map(col => columnDefinitions.get(`${table.name}.${col.name}`))
      .filter(Boolean) as ColumnAIDefinition[];

    console.log(`  📊 Found ${tableColumnDefinitions.length} column definitions for table ${table.name}`)

    if (tableColumnDefinitions.length === 0) {
      console.log(`  ⚠️ No column definitions found for table ${table.name}, skipping`)
      continue;
    }

    try {
      const result = await generateTableAIDefinition(table, databaseName, tableColumnDefinitions);
      tableDefinitions.set(table.name, result.result);
      totalTokensUsed += result.tokensUsed;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      
      console.log(`  ✅ Generated table definition for ${table.name}`)
    } catch (error) {
      console.error(`  ❌ Failed to generate definition for table ${table.name}:`, error);
    }
  }

  // Step 3: Generate database definition based on table definitions
  console.log(`🏢 Generated ${tableDefinitions.size} table definitions, now generating database definition`)
  
  const tableDefinitionPairs = Array.from(tableDefinitions.entries()).map(([tableName, definition]) => {
    const table = [...(schema.tables || []), ...(schema.views || [])].find(t => t.name === tableName);
    return { table: table!, definition };
  });

  console.log(`📊 Table definition pairs: ${tableDefinitionPairs.length}`)

  let databaseDefinition: DatabaseAIDefinition;
  try {
    console.log(`🌐 Generating database definition for: ${databaseName}`)
    const result = await generateDatabaseAIDefinition(databaseName, databaseType, tableDefinitionPairs);
    databaseDefinition = result.result;
    totalTokensUsed += result.tokensUsed;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    
    console.log(`✅ Generated database definition for: ${databaseName}`)
  } catch (error) {
    console.error('❌ Failed to generate database definition:', error);
    // Fallback database definition
    databaseDefinition = {
      description: `Database ${databaseName} containing ${tableDefinitions.size} tables`,
      business_purpose: 'Data storage and retrieval system',
      key_entities: ['Data entities'],
      common_use_cases: ['Data management and analysis'],
      data_relationships: ['Interconnected data relationships'],
      table_summary: 'Tables work together to provide comprehensive data management',
      overall_architecture: 'Relational database architecture',
      data_flow_analysis: 'Data flows through interconnected tables'
    };
  }


  console.log(`🎯 Hierarchical AI generation completed:`)
  console.log(`   - Column definitions: ${columnDefinitions.size}`)
  console.log(`   - Table definitions: ${tableDefinitions.size}`)
  console.log(`   - Database definition: ${databaseDefinition ? 'Generated' : 'Missing'}`)
  console.log(`   - Total tokens used: ${totalTokensUsed}`)

  return {
    columnDefinitions,
    tableDefinitions,
    databaseDefinition,
    totalTokensUsed,
    totalInputTokens,
    totalOutputTokens
  };
}
