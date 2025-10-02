/**
 * Data Source Filter Agent
 * 
 * Filters available data sources to top candidates based on user query and selections
 */

import { BaseAgent, AgentContext, AgentResponse, DataSourceFilterResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { generateEmbedding, calculateCosineSimilarity } from '../embeddings';
import { supabaseServer as supabase } from '../server-utils';
import { tokensToCredits } from '../credit-service-server';
import { applyDataSourceFiltering } from './conversation-context-agent';
import { agentCache } from '../cache/AgentCache';
import { AgentUtils } from './AgentUtils';

export class DataSourceFilterAgent implements BaseAgent {
  name = 'Data Source Filter Agent';
  description = 'Filters available data sources to top candidates based on user query and selections';

  async execute(context: AgentContext): Promise<AgentResponse<DataSourceFilterResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Data Source Filter Agent: Starting source filtering...');
      
      const { userQuery, workspaceId, selectedDataSources } = context;
      
      // Check cache first
      const cacheKey = agentCache.generateSourceKey(userQuery, workspaceId, selectedDataSources);
      const cachedResult = await agentCache.get<DataSourceFilterResponse>(cacheKey);
      
      if (cachedResult) {
        console.log('🎯 Using cached data source filter result');
        return AgentUtils.createSuccessResponse(
          cachedResult,
          startTime,
          0,
          0.9
        );
      }
      
      // Get all available data sources in the workspace
      const dataSources = await this.getAvailableDataSources(workspaceId);
      
      if (dataSources.length === 0) {
        throw new Error('No data sources available in workspace');
      }
      
      // Apply data source filtering using conversation context agent
      let filteredDataSources = applyDataSourceFiltering(dataSources, selectedDataSources);
      
      // Check if this is a document-based query and prioritize file sources
      const isDocumentQuery = this.isDocumentBasedQuery(userQuery);
      if (isDocumentQuery) {
        console.log('📄 Document-based query detected - prioritizing file sources');
        filteredDataSources = this.prioritizeFileSources(filteredDataSources);
      }
      
      if (filteredDataSources.length === 0) {
        throw new Error('No data sources available after filtering');
      }
      
      // Generate embedding for user query
      const queryEmbedding = await generateEmbedding(userQuery);
      
      // Generate embeddings for data sources and calculate semantic similarity
      console.log('🔍 Generating embeddings for data sources...');
      const sourcesWithEmbeddings = await Promise.all(
        filteredDataSources.map(async (source) => {
          try {
            const sourceText = this.buildSourceText(source);
            const sourceEmbedding = await generateEmbedding(sourceText);
            const similarity = calculateCosineSimilarity(queryEmbedding.embedding, sourceEmbedding.embedding);
            
            return {
              ...source,
              relevance_score: similarity,
              embedding_tokens: sourceEmbedding.tokens_used
            };
          } catch (error) {
            console.warn(`Failed to generate embedding for source ${source.id}:`, error);
            return {
              ...source,
              relevance_score: 0.1, // Default low relevance
              embedding_tokens: 0
            };
          }
        })
      );
      
      // Use AI to analyze and rank sources
      const aiAnalysisResult = await this.performAIAnalysis(userQuery, sourcesWithEmbeddings);
      
      // Combine semantic similarity with AI analysis
      const finalSources = sourcesWithEmbeddings
        .map(source => {
          const aiInfo = aiAnalysisResult.filtered_sources?.find((f: any) => f.id === source.id);
          return {
            ...source,
            relevance_score: (source.relevance_score + (aiInfo?.relevance_score || 0.1)) / 2
          };
        })
        .filter(source => source.relevance_score > 0.3) // Filter out low relevance sources
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 10); // Limit to top 10 sources
      
      const processingTime = Date.now() - startTime;
      const totalTokens = queryEmbedding.tokens_used + 
        sourcesWithEmbeddings.reduce((sum, s) => sum + (s.embedding_tokens || 0), 0) +
        (aiAnalysisResult.filter_metadata?.tokens_used || 0);
      
      const result: DataSourceFilterResponse = {
        filtered_sources: finalSources,
        filter_metadata: {
          total_sources_analyzed: filteredDataSources.length,
          sources_filtered: finalSources.length,
          filter_criteria: aiAnalysisResult.filter_criteria || [],
          processing_time_ms: processingTime,
          tokens_used: totalTokens,
          estimated_credits: tokensToCredits(totalTokens),
          user_selected_sources: selectedDataSources?.length || 0
        },
        confidence_score: aiAnalysisResult.confidence_score || 0.7
      };
      
      console.log('🔍 Data Source Filter Result:', {
        total_sources: filteredDataSources.length,
        filtered_sources: finalSources.length,
        top_source: finalSources[0]?.name,
        confidence: result.confidence_score
      });
      
      // Cache the result
      await agentCache.set(cacheKey, result, 300000); // 5 minutes TTL
      
      return AgentUtils.createSuccessResponse(
        result,
        startTime,
        totalTokens,
        result.confidence_score
      );
      
    } catch (error) {
      const fallbackData: DataSourceFilterResponse = {
        filtered_sources: [],
        filter_metadata: {
          total_sources_analyzed: 0,
          sources_filtered: 0,
          filter_criteria: [],
          processing_time_ms: Date.now() - startTime,
          tokens_used: 0,
          estimated_credits: 0,
          user_selected_sources: 0
        },
        confidence_score: 0
      };
      
      return AgentUtils.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        startTime,
        fallbackData,
        0,
        0.0,
        'Data Source Filter Agent'
      );
    }
  }

  private async getAvailableDataSources(workspaceId: string): Promise<any[]> {
    // Get database connections
    const { data: databaseConnections } = await supabase
      .from('database_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);
    
    // Get file uploads
    const { data: fileUploads } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('processing_status', 'completed');
    
    // Get file summaries
    const fileIds = fileUploads?.map((f: any) => f.id) || [];
    const { data: fileSummaries } = await supabase
      .from('file_summaries')
      .select('*')
      .in('file_id', fileIds);
    
    // Get external connections
    const { data: externalConnections } = await supabase
      .from('external_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);
    
    // Combine and format data sources
    const dataSources = [];
    
    // Add database sources
    if (databaseConnections) {
      for (const db of databaseConnections) {
        const summary = this.extractDatabaseSummary(db);
        dataSources.push({
          id: db.id,
          name: db.connection_name || `Database ${db.id}`,
          type: 'database',
          connection_type: db.database_type,
          ai_summary: summary,
          key_points: this.extractKeyPoints(db),
          tags: this.extractTags(db),
          schema: db.schema_encrypted ? this.decryptSchema(db.schema_encrypted) : null
        });
      }
    }
    
    // Add file sources
    if (fileUploads && fileSummaries) {
      for (const file of fileUploads) {
        const summary = fileSummaries.find((s: any) => s.file_id === file.id);
        dataSources.push({
          id: file.id,
          name: file.original_name || `File ${file.id}`,
          type: 'file',
          connection_type: file.file_type,
          ai_summary: summary?.summary || summary?.summary_encrypted,
          key_points: summary?.key_points || summary?.key_points_encrypted,
          tags: summary?.tags || summary?.tags_encrypted,
          schema: summary?.schema
        });
      }
    }
    
    // Add external sources
    if (externalConnections) {
      for (const ext of externalConnections) {
        dataSources.push({
          id: ext.id,
          name: ext.name || `External ${ext.id}`,
          type: 'external',
          connection_type: ext.type,
          ai_summary: ext.content_summary,
          key_points: this.extractExternalKeyPoints(ext),
          tags: this.extractExternalTags(ext),
          schema: ext.schema_metadata
        });
      }
    }
    
    return dataSources;
  }

  private buildSourceText(source: any): string {
    let text = `${source.name} (${source.type})`;
    
    // Include AI summary
    if (source.ai_summary) {
      text += ` - ${source.ai_summary}`;
    }
    
    // Include key points if available
    if (source.key_points && Array.isArray(source.key_points)) {
      text += ` - Key Points: ${source.key_points.slice(0, 3).join(', ')}`;
    }
    
    // Include tags if available
    if (source.tags && Array.isArray(source.tags)) {
      text += ` - Tags: ${source.tags.slice(0, 5).join(', ')}`;
    }
    
    // Include schema information
    if (source.schema) {
      if (source.schema.tables) {
        text += ` - Tables: ${source.schema.tables.map((t: any) => t.name).join(', ')}`;
      }
      if (source.schema.columns) {
        text += ` - Columns: ${source.schema.columns.map((c: any) => c.name).join(', ')}`;
      }
    }
    
    return text;
  }

  private extractDatabaseSummary(db: any): string {
    // Try to get summary from schema_encrypted field first, then fallback to unencrypted
    if (db.schema_encrypted) {
      try {
        const decrypted = this.decryptSchema(db.schema_encrypted);
        return decrypted?.ai_summary || decrypted?.summary || '';
      } catch (error) {
        console.warn('Failed to decrypt database summary from schema:', error);
      }
    }
    return db.ai_summary || '';
  }

  private extractKeyPoints(db: any): string[] {
    if (db.schema_encrypted) {
      try {
        const decrypted = this.decryptSchema(db.schema_encrypted);
        return decrypted?.key_points || [];
      } catch (error) {
        console.warn('Failed to decrypt database key points from schema:', error);
      }
    }
    return [];
  }

  private extractTags(db: any): string[] {
    if (db.schema_encrypted) {
      try {
        const decrypted = this.decryptSchema(db.schema_encrypted);
        return decrypted?.tags || [];
      } catch (error) {
        console.warn('Failed to decrypt database tags from schema:', error);
      }
    }
    return [];
  }

  private extractExternalKeyPoints(ext: any): string[] {
    if (ext.ai_definitions && ext.ai_definitions.key_entities) {
      return ext.ai_definitions.key_entities;
    }
    return [];
  }

  private extractExternalTags(ext: any): string[] {
    if (ext.ai_definitions && ext.ai_definitions.common_use_cases) {
      return ext.ai_definitions.common_use_cases;
    }
    return [];
  }

  private isDocumentBasedQuery(userQuery: string): boolean {
    const documentKeywords = [
      'our visit', 'findings', 'summary', 'report', 'document', 'analysis',
      'key points', 'main points', 'highlights', 'insights', 'conclusions',
      'recommendations', 'overview', 'details', 'content', 'information'
    ];
    
    const queryLower = userQuery.toLowerCase();
    return documentKeywords.some(keyword => queryLower.includes(keyword));
  }

  private prioritizeFileSources(dataSources: any[]): any[] {
    // Separate file sources from other sources
    const fileSources = dataSources.filter(source => source.type === 'file');
    const otherSources = dataSources.filter(source => source.type !== 'file');
    
    // Return file sources first, then other sources
    return [...fileSources, ...otherSources];
  }

  private async performAIAnalysis(userQuery: string, sources: any[]): Promise<any> {
    const sourceDescriptions = sources.map(s => {
      let description = `${s.id}: ${s.name} (${s.type})`;
      
      // Include AI summary
      if (s.ai_summary) {
        description += ` - Summary: ${s.ai_summary}`;
      }
      
      // Include key points if available
      if (s.key_points && Array.isArray(s.key_points) && s.key_points.length > 0) {
        description += ` - Key Points: ${s.key_points.slice(0, 3).join(', ')}`;
      }
      
      // Include tags if available
      if (s.tags && Array.isArray(s.tags) && s.tags.length > 0) {
        description += ` - Tags: ${s.tags.slice(0, 5).join(', ')}`;
      }
      
      // Include schema info for databases
      if (s.type === 'database' && s.schema) {
        if (s.schema.tables) {
          description += ` - Tables: ${s.schema.tables.map((t: any) => t.name).join(', ')}`;
        }
      }
      
      return description;
    }).join('\n');
    
    const analysisPrompt = `Analyze which data sources are most relevant for this query.

USER QUERY: "${userQuery}"

AVAILABLE DATA SOURCES:
${sourceDescriptions}

Rate each source's relevance (0.0-1.0) and provide reasoning.

**Analysis Guidelines:**
1. **Use ALL available summary information**: Consider AI summaries, key points, tags, and schema information
2. **Document-based queries**: If query mentions "our visit", "findings", "summary", "report", "document", "analysis", "key points", etc., prioritize sources with relevant summaries
3. **Database queries**: For data analysis queries, prioritize database sources with relevant table/schema information
4. **External data queries**: For real-time or external data needs, prioritize external connections
5. **Semantic matching**: Match query intent with source summaries, key points, and tags
6. **Context relevance**: Consider how well each source's content matches the query requirements

Respond with JSON:
{
  "filtered_sources": [
    {
      "id": "source_id",
      "relevance_score": 0.0-1.0,
      "reasoning": "Why this source is relevant based on summary, key points, tags, and schema"
    }
  ],
  "filter_criteria": ["Criteria used for filtering"],
  "confidence_score": 0.0-1.0
}`;

    try {
      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a data source analysis expert. Analyze which data sources are most relevant for user queries. Use ALL available information including AI summaries, key points, tags, and schema details. Pay special attention to document-based queries that reference "our visit", "findings", "summary", "report", etc. Consider semantic relevance, data type appropriateness, and content overlap. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error);
      return {
        filtered_sources: sources.map(s => ({
          id: s.id,
          relevance_score: s.relevance_score || 0.5,
          reasoning: 'Fallback analysis'
        })),
        filter_criteria: ['Fallback analysis'],
        confidence_score: 0.5
      };
    }
  }

  private decryptSchema(encryptedSchema: string): any {
    try {
      // This would use your existing decryption logic
      // For now, return null to avoid errors
      return null;
    } catch (error) {
      console.warn('Failed to decrypt schema:', error);
      return null;
    }
  }
}
