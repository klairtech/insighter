/**
 * AI Generation Agent
 * 
 * Specialized agent for generating hierarchical AI definitions for database schemas
 * Handles column, table, and database-level AI definitions with batch processing
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { DatabaseSchema, DatabaseTable, DatabaseColumn } from '@/types/database-schema';

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

export interface AIGenerationAgentResponse {
  columnDefinitions: Map<string, ColumnAIDefinition>;
  tableDefinitions: Map<string, TableAIDefinition>;
  databaseDefinition: DatabaseAIDefinition;
  totalTokensUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  processing_summary: {
    tables_processed: number;
    columns_processed: number;
    batch_operations: number;
    success_rate: number;
  };
}

export class AIGenerationAgent implements BaseAgent {
  name = 'AI Generation Agent';
  description = 'Generates hierarchical AI definitions for database schemas with batch processing';

  async execute(context: AgentContext & { 
    schema: DatabaseSchema; 
    selectedTables: Array<{ table_name: string; selected_columns: string[] }>; 
    databaseName: string; 
    databaseType: string; 
  }): Promise<AgentResponse<AIGenerationAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🤖 AI Generation Agent: Starting hierarchical AI definition generation...');
      
      const { schema, selectedTables, databaseName, databaseType } = context;
      
      // Generate hierarchical AI definitions
      const result = await this.generateHierarchicalAIDefinitions(
        schema,
        selectedTables,
        databaseName,
        databaseType
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log('🤖 AI Generation Agent Result:', {
        tables_processed: result.processing_summary.tables_processed,
        columns_processed: result.processing_summary.columns_processed,
        total_tokens_used: result.totalTokensUsed,
        processing_time_ms: processingTime
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: result.totalTokensUsed,
          confidence_score: result.processing_summary.success_rate
        }
      };
      
    } catch (error) {
      console.error('AI Generation Agent error:', error);
      
      return {
        success: false,
        data: {
          columnDefinitions: new Map(),
          tableDefinitions: new Map(),
          databaseDefinition: {
            description: 'Failed to generate database definition',
            business_purpose: 'Error occurred during generation',
            key_entities: [],
            common_use_cases: [],
            data_relationships: [],
            table_summary: 'Generation failed',
            overall_architecture: 'Unknown',
            data_flow_analysis: 'Analysis failed'
          },
          totalTokensUsed: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          processing_summary: {
            tables_processed: 0,
            columns_processed: 0,
            batch_operations: 0,
            success_rate: 0
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate AI definitions for a single column
   */
  private async generateColumnAIDefinition(
    column: DatabaseColumn,
    tableName: string,
    databaseName: string
  ): Promise<AIGenerationResult<ColumnAIDefinition>> {
    try {
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

      const response = await callAIWithOpenAIPrimary([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        max_tokens: 5000,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(response.content);
      
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
        tokensUsed: response.tokens_used,
        inputTokens: 0, // Will be calculated by callAIWithOpenAIPrimary
        outputTokens: 0 // Will be calculated by callAIWithOpenAIPrimary
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
   * Generate AI definitions for a table and all its columns in a single batch
   */
  private async generateTableBatchAIDefinitions(
    table: DatabaseTable
  ): Promise<AIGenerationResult<{
    tableDefinition: TableAIDefinition;
    columnDefinitions: ColumnAIDefinition[];
  }>> {
    try {
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

      const response = await callAIWithOpenAIPrimary([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(response.content);
      
      // Ensure column definitions match the actual columns
      const columnDefinitions = table.columns.map(col => {
        const aiDef = parsed.columnDefinitions.find((cd: ColumnAIDefinition) => cd.name === col.name);
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
          tableDefinition: parsed.tableDefinition,
          columnDefinitions
        },
        tokensUsed: response.tokens_used,
        inputTokens: 0,
        outputTokens: 0
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
   * Generate AI definition for the entire database
   */
  private async generateDatabaseAIDefinition(
    databaseName: string,
    databaseType: string,
    tableDefinitions: Array<{ table: DatabaseTable; definition: TableAIDefinition }>
  ): Promise<AIGenerationResult<DatabaseAIDefinition>> {
    try {
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

      const response = await callAIWithOpenAIPrimary([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        max_tokens: 5000,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(response.content);
      
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
        tokensUsed: response.tokens_used,
        inputTokens: 0,
        outputTokens: 0
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
   * Main function to generate hierarchical AI definitions with batch processing
   */
  private async generateHierarchicalAIDefinitions(
    schema: DatabaseSchema,
    selectedTables: Array<{ table_name: string; selected_columns: string[] }>,
    databaseName: string,
    databaseType: string
  ): Promise<AIGenerationAgentResponse> {
    
    let totalTokensUsed = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    
    const columnDefinitions = new Map<string, ColumnAIDefinition>();
    const tableDefinitions = new Map<string, TableAIDefinition>();

    // Get tables to process
    const selectedTableNames = selectedTables.map(t => t.table_name);
    const tablesToProcess = [...(schema.tables || []), ...(schema.views || [])]
      .filter(table => selectedTableNames.includes(table.name));

    console.log(`📊 Processing ${tablesToProcess.length} tables with batch AI generation`);
    
    let successfulTables = 0;
    let totalColumns = 0;

    // Process tables in batches to avoid rate limits
    const maxConcurrency = 3;
    for (let i = 0; i < tablesToProcess.length; i += maxConcurrency) {
      const batch = tablesToProcess.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (table) => {
        const result = await this.generateTableBatchAIDefinitions(table);
        return { tableName: table.name, result };
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ tableName, result }) => {
        // Store table definition
        tableDefinitions.set(tableName, result.result.tableDefinition);
        
        // Store column definitions with proper key format
        for (const columnDef of result.result.columnDefinitions) {
          columnDefinitions.set(`${tableName}.${columnDef.name}`, columnDef);
        }
        
        totalTokensUsed += result.tokensUsed;
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;
        successfulTables++;
        totalColumns += result.result.columnDefinitions.length;
        
        console.log(`✅ Processed table ${tableName} with ${result.result.columnDefinitions.length} columns`);
      });

      // Add a small delay between batches to be respectful to the API
      if (i + maxConcurrency < tablesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Generate database definition based on table definitions
    console.log(`🏢 Generated ${tableDefinitions.size} table definitions, now generating database definition`);
    
    const tableDefinitionPairs = Array.from(tableDefinitions.entries()).map(([tableName, definition]) => {
      const table = [...(schema.tables || []), ...(schema.views || [])].find(t => t.name === tableName);
      return { table: table!, definition };
    });

    let databaseDefinition: DatabaseAIDefinition;
    try {
      console.log(`🌐 Generating database definition for: ${databaseName}`);
      const result = await this.generateDatabaseAIDefinition(databaseName, databaseType, tableDefinitionPairs);
      databaseDefinition = result.result;
      totalTokensUsed += result.tokensUsed;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      
      console.log(`✅ Generated database definition for: ${databaseName}`);
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

    const successRate = tablesToProcess.length > 0 ? successfulTables / tablesToProcess.length : 0;

    console.log(`🎯 Hierarchical AI generation completed:`);
    console.log(`   - Column definitions: ${columnDefinitions.size}`);
    console.log(`   - Table definitions: ${tableDefinitions.size}`);
    console.log(`   - Database definition: ${databaseDefinition ? 'Generated' : 'Missing'}`);
    console.log(`   - Total tokens used: ${totalTokensUsed}`);

    return {
      columnDefinitions,
      tableDefinitions,
      databaseDefinition,
      totalTokensUsed,
      totalInputTokens,
      totalOutputTokens,
      processing_summary: {
        tables_processed: successfulTables,
        columns_processed: totalColumns,
        batch_operations: Math.ceil(tablesToProcess.length / maxConcurrency),
        success_rate: successRate
      }
    };
  }
}
