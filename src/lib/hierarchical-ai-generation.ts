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
  name: string;
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
      max_tokens: 5000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      result: {
        name: column.name,
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
        name: column.name,
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
      max_tokens: 5000,
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
      max_tokens: 5000,
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
 * OPTIMIZED: Generate AI definitions for all columns in a table in a single API call
 * This is much more efficient than processing columns individually
 */
export async function generateTableBatchAIDefinitions(
  table: DatabaseTable
): Promise<AIGenerationResult<{
  tableDefinition: TableAIDefinition;
  columnDefinitions: ColumnAIDefinition[];
}>> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const systemPrompt = `You are a database expert specializing in PostgreSQL, MySQL, and SQL Server. Your task is to generate comprehensive AI definitions for database tables and their columns.

CRITICAL: You must ONLY analyze the specific table provided to you. Do NOT make assumptions about other tables, even if you see foreign key references to them.

For each table, provide:
- A clear description of the table's purpose and business context
- Key entities and relationships (ONLY within this table's context)
- Common use cases and data relationships (ONLY based on this table's data)
- Primary key analysis and foreign key relationships (acknowledge FKs but don't analyze referenced tables)

For each column, provide:
- Clear description of the column's purpose and business value
- Data insights and patterns from sample data
- Common queries and operations
- Relationships to other tables (acknowledge but don't analyze referenced tables)
- Data quality considerations and notes

Focus on practical, actionable insights that help users understand and work with the data effectively.`;

    // Prepare column information with sample data
    const columnInfo = table.columns.map(col => {
      const sampleData = col.sample_values && col.sample_values.length > 0 
        ? `Sample values: ${col.sample_values.slice(0, 3).join(', ')}${col.sample_values.length > 3 ? '...' : ''}`
        : 'No sample data available';
      
      return `- **${col.name}** (${col.type}): ${col.is_primary_key ? 'PRIMARY KEY' : ''} ${col.is_foreign_key ? `→ ${col.foreign_table}.${col.foreign_column}` : ''} - ${sampleData}`;
    }).join('\n');

    const userPrompt = `Generate comprehensive AI definitions for table "${table.name}" with ${table.columns.length} columns.

**Table Structure:**
${columnInfo}

**IMPORTANT CONSTRAINTS:**
- ONLY analyze the table "${table.name}" that is provided above
- Do NOT make assumptions about other tables not explicitly mentioned
- If you see foreign key references to other tables (like master_gender, master_blood_group), acknowledge them but do NOT include those tables in your analysis
- Focus ONLY on the data and structure of "${table.name}" itself
- Do NOT invent or assume the existence of other tables

**Requirements:**
- Provide detailed, meaningful descriptions for each column
- Include business context and use cases based ONLY on this table's data
- Analyze sample data patterns from the provided data
- Identify relationships only within this table's context
- Make descriptions specific and actionable based on actual data

Return a JSON object with this EXACT structure:
{
  "tableDefinition": {
    "description": "string",
    "business_purpose": "string", 
    "key_entities": ["array of strings"],
    "common_use_cases": ["array of strings"],
    "data_relationships": ["array of strings"],
    "column_summary": "string",
    "primary_key_analysis": "string",
    "foreign_key_relationships": ["array of strings"]
  },
  "columnDefinitions": [
    {
      "name": "string",
      "description": "string",
      "business_purpose": "string",
      "data_insights": ["array of strings"],
      "common_queries": ["array of strings"],
      "relationships": ["array of strings"],
      "data_quality_notes": ["array of strings"],
      "sample_data_analysis": "string"
    }
  ]
}

CRITICAL: The response must be valid JSON with the exact structure above. Do not include any text outside the JSON object.`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    // Clean and validate JSON response
    let cleanedContent = content.trim();
    
    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Try to find the JSON object if there's extra text
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    console.log(`🔍 Raw AI response for table ${table.name}:`, content.substring(0, 200) + '...');
    console.log(`🧹 Cleaned content:`, cleanedContent.substring(0, 200) + '...');
    console.log(`📊 Response length: ${content.length} chars, cleaned: ${cleanedContent.length} chars`);

    // Parse the JSON response with better error handling
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error(`❌ JSON parse error for table ${table.name}:`, parseError);
      console.error(`📄 Problematic content:`, cleanedContent);
      
      // Try to fix common JSON truncation issues
      let fixedContent = cleanedContent;
      
      // If the JSON is truncated, try to close it properly
      if (cleanedContent.includes('"columnDefinitions": [') && !cleanedContent.includes('}]')) {
        // Find the last complete column definition and close the array
        const lastCompleteDef = cleanedContent.lastIndexOf('}');
        if (lastCompleteDef > 0) {
          fixedContent = cleanedContent.substring(0, lastCompleteDef + 1) + ']}';
          console.log(`🔧 Attempting to fix truncated JSON for table ${table.name}`);
        }
      }
      
      try {
        parsedResponse = JSON.parse(fixedContent);
        console.log(`✅ Successfully parsed fixed JSON for table ${table.name}`);
      } catch {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Invalid JSON response from AI: ${errorMessage}`);
      }
    }
    
    // Validate the response structure with better debugging
    console.log(`🔍 Parsed response keys:`, Object.keys(parsedResponse));
    console.log(`🔍 Has tableDefinition:`, !!parsedResponse.tableDefinition);
    console.log(`🔍 Has columnDefinitions:`, !!parsedResponse.columnDefinitions);
    
    if (!parsedResponse.tableDefinition || !parsedResponse.columnDefinitions) {
      console.error(`❌ Invalid response structure for table ${table.name}:`, {
        hasTableDefinition: !!parsedResponse.tableDefinition,
        hasColumnDefinitions: !!parsedResponse.columnDefinitions,
        responseKeys: Object.keys(parsedResponse),
        sampleResponse: JSON.stringify(parsedResponse, null, 2).substring(0, 500)
      });
      
      // Try to extract data from alternative structures
      let tableDefinition = parsedResponse.tableDefinition;
      let columnDefinitions = parsedResponse.columnDefinitions;
      
      // Check for alternative key names
      if (!tableDefinition && parsedResponse.table) {
        tableDefinition = parsedResponse.table;
      }
      if (!columnDefinitions && parsedResponse.columns) {
        columnDefinitions = parsedResponse.columns;
      }
      if (!columnDefinitions && parsedResponse.columnDefinitions) {
        columnDefinitions = parsedResponse.columnDefinitions;
      }
      
      if (!tableDefinition || !columnDefinitions) {
        throw new Error("Invalid response structure from OpenAI - could not extract table or column definitions");
      }
      
      // Use the extracted data
      parsedResponse.tableDefinition = tableDefinition;
      parsedResponse.columnDefinitions = columnDefinitions;
    }

    // Ensure column definitions match the actual columns
    const columnDefinitions = table.columns.map(col => {
      const aiDef = parsedResponse.columnDefinitions.find((cd: ColumnAIDefinition) => cd.name === col.name);
      if (!aiDef) {
        console.log(`⚠️ No AI definition found for column ${col.name}, using fallback`);
        // Fallback definition if AI didn't provide one
        return {
          name: col.name,
          description: `${col.name} column of type ${col.type}`,
          business_purpose: "Data storage and retrieval",
          data_insights: ["Column contains structured data"],
          common_queries: ["SELECT queries", "Data filtering"],
          relationships: col.is_foreign_key ? [`References ${col.foreign_table}.${col.foreign_column}`] : [],
          data_quality_notes: ["Data quality assessment pending"],
          sample_data_analysis: "Sample data analysis not available"
        };
      }
      console.log(`✅ AI definition found for column ${col.name}: ${aiDef.description?.substring(0, 50)}...`);
      
      // Ensure all array fields are properly formatted
      const validatedAiDef = {
        ...aiDef,
        data_insights: Array.isArray(aiDef.data_insights) ? aiDef.data_insights : [aiDef.data_insights || "No insights available"],
        common_queries: Array.isArray(aiDef.common_queries) ? aiDef.common_queries : [aiDef.common_queries || "No queries available"],
        relationships: Array.isArray(aiDef.relationships) ? aiDef.relationships : [aiDef.relationships || "No relationships"],
        data_quality_notes: Array.isArray(aiDef.data_quality_notes) ? aiDef.data_quality_notes : [aiDef.data_quality_notes || "No quality notes"]
      };
      
      return validatedAiDef;
    });

    return {
      result: {
        tableDefinition: parsedResponse.tableDefinition,
        columnDefinitions
      },
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    };

  } catch (error) {
    console.error(`Error generating batch AI definitions for table ${table.name}:`, error);
    
    // Return fallback definitions
    const fallbackColumnDefinitions = table.columns.map(col => ({
      name: col.name,
      description: `${col.name} column of type ${col.type}`,
      business_purpose: "Data storage and retrieval",
      data_insights: ["Column contains structured data"],
      common_queries: ["SELECT queries", "Data filtering"],
      relationships: col.is_foreign_key ? [`References ${col.foreign_table}.${col.foreign_column}`] : [],
      data_quality_notes: ["Data quality assessment pending"],
      sample_data_analysis: "Sample data analysis not available"
    }));

    const fallbackTableDefinition = {
      description: `${table.name} table containing ${table.columns.length} columns`,
      business_purpose: "Data storage and management",
      key_entities: ["Data records"],
      common_use_cases: ["Data storage", "Data retrieval", "Data analysis"],
      data_relationships: ["Connected to other tables via foreign keys"],
      column_summary: `Table contains ${table.columns.length} columns for data storage`,
      primary_key_analysis: "Primary key structure analysis pending",
      foreign_key_relationships: table.columns.filter(col => col.is_foreign_key).map(col => `${col.name} -> ${col.foreign_table}.${col.foreign_column}`)
    };

    return {
      result: {
        tableDefinition: fallbackTableDefinition,
        columnDefinitions: fallbackColumnDefinitions
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * OPTIMIZED: Generate AI definitions for multiple tables in parallel
 */
export async function generateMultipleTablesBatchAIDefinitions(
  tables: DatabaseTable[],
  databaseName: string,
  databaseType: string,
  maxConcurrency: number = 3
): Promise<{
  results: Map<string, { tableDefinition: TableAIDefinition; columnDefinitions: ColumnAIDefinition[] }>;
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  const results = new Map<string, { tableDefinition: TableAIDefinition; columnDefinitions: ColumnAIDefinition[] }>();
  let totalTokensUsed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Process tables in batches to avoid rate limits
  for (let i = 0; i < tables.length; i += maxConcurrency) {
    const batch = tables.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async (table) => {
      const result = await generateTableBatchAIDefinitions(table);
      return { tableName: table.name, result };
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ tableName, result }) => {
      results.set(tableName, result.result);
      totalTokensUsed += result.tokensUsed;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
    });

    // Add a small delay between batches to be respectful to the API
    if (i + maxConcurrency < tables.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    results,
    totalTokensUsed,
    totalInputTokens,
    totalOutputTokens
  };
}

/**
 * Main function to generate hierarchical AI definitions
 * OPTIMIZED VERSION: Uses batch processing for much better performance
 * 1. Generate table and column definitions in batches (1 API call per table)
 * 2. Generate database definition based on table definitions
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

  // OPTIMIZED: Use batch processing for much better performance
  console.log(`🚀 Starting OPTIMIZED hierarchical AI generation for ${selectedTables.length} tables`)
  
  // Get tables to process
  const selectedTableNames = selectedTables.map(t => t.table_name);
  const tablesToProcess = [...(schema.tables || []), ...(schema.views || [])]
    .filter(table => selectedTableNames.includes(table.name));

  console.log(`📊 Processing ${tablesToProcess.length} tables with batch AI generation`)
  
  // Use optimized batch generation
  const {
    results: batchResults,
    totalTokensUsed: aiTokens,
    totalInputTokens: aiInputTokens,
    totalOutputTokens: aiOutputTokens
  } = await generateMultipleTablesBatchAIDefinitions(
    tablesToProcess,
    databaseName,
    databaseType,
    3 // Max 3 concurrent requests
  );

  totalTokensUsed = aiTokens;
  totalInputTokens = aiInputTokens;
  totalOutputTokens = aiOutputTokens;

  // Process batch results into the expected format
  for (const [tableName, { tableDefinition, columnDefinitions: tableColumnDefs }] of batchResults) {
    // Store table definition
    tableDefinitions.set(tableName, tableDefinition);
    
    // Store column definitions with proper key format
    for (const columnDef of tableColumnDefs) {
      columnDefinitions.set(`${tableName}.${columnDef.name}`, columnDef);
    }
    
    console.log(`✅ Processed table ${tableName} with ${tableColumnDefs.length} columns`)
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
