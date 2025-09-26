import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ColumnAIDefinition {
  description: string;
  business_purpose: string;
  data_insights: string[];
  common_queries: string[];
  relationships: string[];
  data_quality_notes: string[];
}

export interface AIGenerationResult<T> {
  result: T;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateColumnAIDefinition(
  columnName: string,
  columnType: string,
  isPrimaryKey: boolean,
  isForeignKey: boolean,
  tableName: string,
  databaseName: string,
  foreignTable?: string,
  foreignColumn?: string,
  sampleValues: string[] = []
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

Be specific, practical, and focus on how users would interact with this data.`;

    const userPrompt = `Generate an AI definition for this database column:

**Column Information:**
- Column Name: ${columnName}
- Data Type: ${columnType}
- Table: ${tableName}
- Database: ${databaseName}
- Is Primary Key: ${isPrimaryKey}
- Is Foreign Key: ${isForeignKey}
${foreignTable ? `- References: ${foreignTable}.${foreignColumn}` : ''}

**Sample Values:**
${sampleValues.length > 0 ? sampleValues.slice(0, 10).join(', ') : 'No sample data available'}

Provide a JSON response with:
{
  "description": "Clear, concise description of what this column represents",
  "business_purpose": "Why this column exists and its business value",
  "data_insights": ["What insights can be derived from this column"],
  "common_queries": ["Common query patterns users might use"],
  "relationships": ["How this column relates to other data"],
  "data_quality_notes": ["Potential data quality considerations"]
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
        description: parsed.description || `Column ${columnName} of type ${columnType}`,
        business_purpose: parsed.business_purpose || 'Data storage and retrieval',
        data_insights: parsed.data_insights || [],
        common_queries: parsed.common_queries || [],
        relationships: parsed.relationships || [],
        data_quality_notes: parsed.data_quality_notes || []
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
        description: `${columnName} is a ${columnType} column${isPrimaryKey ? ' that serves as the primary key' : ''}${isForeignKey ? ` that references ${foreignTable}.${foreignColumn}` : ''}`,
        business_purpose: 'Data storage and retrieval',
        data_insights: ['Contains structured data for analysis'],
        common_queries: [`SELECT ${columnName} FROM ${tableName}`],
        relationships: isForeignKey ? [`References ${foreignTable}.${foreignColumn}`] : [],
        data_quality_notes: ['Verify data integrity and consistency']
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

export async function generateTableAIDefinition(
  tableName: string,
  tableType: 'table' | 'view',
  columns: Array<{
    name: string;
    type: string;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    foreign_table?: string;
    foreign_column?: string;
  }>,
  rowCount: number,
  databaseName: string
): Promise<AIGenerationResult<{
  description: string;
  business_purpose: string;
  key_entities: string[];
  common_use_cases: string[];
  data_relationships: string[];
}>> {
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const systemPrompt = `You are a database analyst AI that generates intelligent descriptions for database tables and views.
Your task is to analyze table structure and relationships to create comprehensive definitions that help users understand:
1. What the table represents
2. Its business purpose
3. Key entities and concepts
4. Common use cases
5. Data relationships

Be specific, practical, and focus on how users would interact with this data.`;

    const primaryKeys = columns.filter(col => col.is_primary_key).map(col => col.name);
    const foreignKeys = columns.filter(col => col.is_foreign_key);
    const relationships = foreignKeys.map(fk => `${fk.name} → ${fk.foreign_table}.${fk.foreign_column}`);

    const userPrompt = `Generate an AI definition for this database ${tableType}:

**Table Information:**
- Table Name: ${tableName}
- Type: ${tableType}
- Database: ${databaseName}
- Row Count: ${rowCount}
- Primary Keys: ${primaryKeys.join(', ') || 'None'}
- Foreign Key Relationships: ${relationships.join(', ') || 'None'}

**Columns:**
${columns.map(col => `- ${col.name} (${col.type})${col.is_primary_key ? ' [PK]' : ''}${col.is_foreign_key ? ` [FK → ${col.foreign_table}.${col.foreign_column}]` : ''}`).join('\n')}

Provide a JSON response with:
{
  "description": "Clear, comprehensive description of what this table represents",
  "business_purpose": "Why this table exists and its business value",
  "key_entities": ["Key entities, concepts, or objects this table represents"],
  "common_use_cases": ["Common ways this table is used in queries and analysis"],
  "data_relationships": ["How this table relates to other tables and data"]
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
        description: parsed.description || `${tableName} is a ${tableType} containing ${rowCount} records`,
        business_purpose: parsed.business_purpose || 'Data storage and retrieval',
        key_entities: parsed.key_entities || [],
        common_use_cases: parsed.common_use_cases || [],
        data_relationships: parsed.data_relationships || relationships
      },
      tokensUsed: response.usage?.total_tokens || 0,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    };

  } catch (error) {
    console.error('Error generating table AI definition:', error);
    
    // Fallback definition
    const foreignKeys = columns.filter(col => col.is_foreign_key);
    const relationships = foreignKeys.map(fk => `${fk.name} → ${fk.foreign_table}.${fk.foreign_column}`);
    
    return {
      result: {
        description: `${tableName} is a ${tableType} containing ${rowCount} records with ${columns.length} columns`,
        business_purpose: 'Data storage and retrieval',
        key_entities: [tableName],
        common_use_cases: [`Query data from ${tableName}`],
        data_relationships: relationships
      },
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0
    };
  }
}
