import { decryptObject } from './encryption'
import { DatabaseSchema } from '../types/database-schema'

export interface SchemaAnswerResponse {
  answer: string;
  schema_info_used: {
    tables_described: string[];
    columns_described: string[];
    relationships_described: string[];
    constraints_mentioned: string[];
  };
  confidence_score: number;
  reasoning: string;
  follow_up_suggestions?: string[];
  requires_data_query?: boolean;
}

/**
 * Schema Answer Agent - Answers basic questions about database structure without executing queries
 */
export async function schemaAnswerAgent(
  userQuery: string,
  databaseConnection: {id: string, name: string, type: string, schema_info_encrypted?: string},
  _conversationHistory: Array<{sender_type: string, content: string, created_at: string}>
): Promise<SchemaAnswerResponse> {
  try {
    console.log('🏗️ Schema Answer Agent: Analyzing database structure question...')
    
    // Decrypt schema information
    let schema: DatabaseSchema | null = null
    if (databaseConnection.schema_info_encrypted) {
      try {
        const decrypted = decryptObject(databaseConnection.schema_info_encrypted) as { schema: DatabaseSchema }
        schema = decrypted.schema
      } catch (error) {
        console.error('Error decrypting schema:', error)
        return {
          answer: "I'm unable to access the database schema information. Please ensure the database connection is properly configured.",
          schema_info_used: {
            tables_described: [],
            columns_described: [],
            relationships_described: [],
            constraints_mentioned: []
          },
          confidence_score: 0.0,
          reasoning: "Schema decryption failed",
          requires_data_query: true
        }
      }
    }

    if (!schema) {
      return {
        answer: "I don't have access to the database schema information. Please ensure the database connection is properly configured and the schema has been loaded.",
        schema_info_used: {
          tables_described: [],
          columns_described: [],
          relationships_described: [],
          constraints_mentioned: []
        },
        confidence_score: 0.0,
        reasoning: "No schema information available",
        requires_data_query: true
      }
    }

    // Analyze the question to determine if it can be answered from schema alone
    const questionAnalysis = analyzeSchemaQuestion(userQuery, schema)
    
    if (!questionAnalysis.canAnswerFromSchema) {
      return {
        answer: "This question requires querying actual data from the database. I can only answer questions about the database structure and schema.",
        schema_info_used: {
          tables_described: [],
          columns_described: [],
          relationships_described: [],
          constraints_mentioned: []
        },
        confidence_score: 0.0,
        reasoning: "Question requires data query, not schema analysis",
        requires_data_query: true,
        follow_up_suggestions: [
          "What tables are in this database?",
          "What columns does the [table_name] table have?",
          "What is the relationship between [table1] and [table2]?",
          "What data types are used in the [table_name] table?"
        ]
      }
    }

    // Generate answer based on schema analysis
    const answer = generateSchemaAnswer(userQuery, schema, questionAnalysis)
    
    console.log('✅ Schema Answer Agent: Generated answer from schema analysis')
    
    return answer

  } catch (error) {
    console.error('Schema Answer Agent error:', error)
    return {
      answer: "I encountered an error while analyzing the database schema. Please try again or contact support if the issue persists.",
      schema_info_used: {
        tables_described: [],
        columns_described: [],
        relationships_described: [],
        constraints_mentioned: []
      },
      confidence_score: 0.0,
      reasoning: "Error occurred during schema analysis",
      requires_data_query: true
    }
  }
}

/**
 * Analyze if a question can be answered from schema alone
 */
function analyzeSchemaQuestion(userQuery: string, schema: DatabaseSchema): {
  canAnswerFromSchema: boolean;
  questionType: 'structure' | 'data' | 'mixed';
  relevantTables: string[];
  relevantColumns: string[];
} {
  const lowerQuery = userQuery.toLowerCase()
  
  // Keywords that indicate schema/structure questions
  const schemaKeywords = [
    'table', 'tables', 'column', 'columns', 'field', 'fields',
    'structure', 'schema', 'relationship', 'relationships',
    'constraint', 'constraints', 'index', 'indexes', 'key', 'keys',
    'primary key', 'foreign key', 'data type', 'data types',
    'what is', 'what are', 'how many', 'list', 'show me'
  ]
  
  // Keywords that indicate data questions
  const dataKeywords = [
    'select', 'query', 'find', 'search', 'count', 'sum', 'average',
    'where', 'filter', 'data', 'records', 'rows', 'values',
    'latest', 'recent', 'oldest', 'highest', 'lowest', 'top', 'bottom'
  ]
  
  const schemaMatches = schemaKeywords.filter(keyword => lowerQuery.includes(keyword)).length
  const dataMatches = dataKeywords.filter(keyword => lowerQuery.includes(keyword)).length
  
  const canAnswerFromSchema = schemaMatches > dataMatches || 
    (schemaMatches > 0 && dataMatches === 0) ||
    lowerQuery.includes('what tables') ||
    lowerQuery.includes('what columns') ||
    lowerQuery.includes('database structure')
  
  // Extract table names mentioned in the query
  const relevantTables = schema.tables?.filter(table => 
    lowerQuery.includes(table.name.toLowerCase())
  ).map(table => table.name) || []
  
  // Extract column names mentioned in the query
  const relevantColumns: string[] = []
  schema.tables?.forEach(table => {
    table.columns?.forEach(column => {
      if (lowerQuery.includes(column.name.toLowerCase())) {
        relevantColumns.push(`${table.name}.${column.name}`)
      }
    })
  })
  
  return {
    canAnswerFromSchema,
    questionType: canAnswerFromSchema ? 'structure' : 'data',
    relevantTables,
    relevantColumns
  }
}

/**
 * Generate answer based on schema analysis
 */
function generateSchemaAnswer(
  userQuery: string, 
  schema: DatabaseSchema, 
  analysis: ReturnType<typeof analyzeSchemaQuestion>
): SchemaAnswerResponse {
  const lowerQuery = userQuery.toLowerCase()
  
  let answer = ''
  const schemaInfoUsed = {
    tables_described: [] as string[],
    columns_described: [] as string[],
    relationships_described: [] as string[],
    constraints_mentioned: [] as string[]
  }
  
  // Handle different types of schema questions
  if (lowerQuery.includes('what tables') || lowerQuery.includes('list tables')) {
    const tableNames = schema.tables?.map(table => table.name) || []
    answer = `This database contains ${tableNames.length} tables:\n\n${tableNames.map(name => `• ${name}`).join('\n')}`
    schemaInfoUsed.tables_described = tableNames
  }
  else if (lowerQuery.includes('what columns') && analysis.relevantTables.length > 0) {
    const tableName = analysis.relevantTables[0]
    const table = schema.tables?.find(t => t.name === tableName)
    if (table) {
      const columns = table.columns?.map(col => `${col.name} (${col.type})`) || []
      answer = `The ${tableName} table has ${columns.length} columns:\n\n${columns.map(col => `• ${col}`).join('\n')}`
      schemaInfoUsed.tables_described = [tableName]
      schemaInfoUsed.columns_described = table.columns?.map(col => col.name) || []
    }
  }
  else if (lowerQuery.includes('how many tables')) {
    const tableCount = schema.tables?.length || 0
    answer = `This database contains ${tableCount} tables.`
    schemaInfoUsed.tables_described = schema.tables?.map(t => t.name) || []
  }
  else if (lowerQuery.includes('relationship') || lowerQuery.includes('foreign key')) {
    // Analyze relationships based on foreign key patterns
    const relationships: string[] = []
    schema.tables?.forEach(table => {
      table.columns?.forEach(column => {
        if (column.is_foreign_key) {
          relationships.push(`${table.name}.${column.name} → (foreign key)`)
        }
      })
    })
    
    if (relationships.length > 0) {
      answer = `I found ${relationships.length} foreign key relationships in this database:\n\n${relationships.map(rel => `• ${rel}`).join('\n')}`
      schemaInfoUsed.relationships_described = relationships
    } else {
      answer = "I don't see any explicit foreign key relationships defined in the schema. The relationships may be implicit or defined elsewhere."
    }
  }
  else {
    // General schema overview
    const tableCount = schema.tables?.length || 0
    const totalColumns = schema.tables?.reduce((sum, table) => sum + (table.columns?.length || 0), 0) || 0
    answer = `This database contains ${tableCount} tables with a total of ${totalColumns} columns. The database structure is ready for analysis.`
    schemaInfoUsed.tables_described = schema.tables?.map(t => t.name) || []
  }
  
  return {
    answer,
    schema_info_used: schemaInfoUsed,
    confidence_score: 0.9,
    reasoning: "Answer generated from database schema analysis",
    follow_up_suggestions: [
      "What data is in the [table_name] table?",
      "Show me the structure of the [table_name] table",
      "What are the relationships between tables?",
      "What indexes are available?"
    ],
    requires_data_query: false
  }
}
