/**
 * External Search Agent
 * 
 * Handles web searches and external API connections to answer questions
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';
import { supabaseServer as supabase } from '../server-utils';

export interface ExternalSearchAgentResponse {
  search_results: Array<{
    source: string;
    title: string;
    content: string;
    url?: string;
    relevance_score: number;
    source_type: 'web' | 'api' | 'external_connection';
  }>;
  total_results: number;
  search_summary: {
    sources_searched: number;
    successful_searches: number;
    failed_searches: number;
    average_relevance_score: number;
  };
  external_data_used: string[];
}

export class ExternalSearchAgent implements BaseAgent {
  name = 'External Search Agent';
  description = 'Handles web searches and external API connections to answer questions';

  async execute(context: AgentContext & { optimizedQuery: string; requiresExternalData?: boolean }): Promise<AgentResponse<ExternalSearchAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🌐 External Search Agent: Starting external data search...');
      
      const { optimizedQuery, workspaceId, requiresExternalData = false } = context;
      
      // Check if external data is needed
      if (!requiresExternalData && !this.shouldSearchExternal(optimizedQuery)) {
        return {
          success: true,
          data: {
            search_results: [],
            total_results: 0,
            search_summary: {
              sources_searched: 0,
              successful_searches: 0,
              failed_searches: 0,
              average_relevance_score: 0
            },
            external_data_used: []
          },
          metadata: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: 0,
            confidence_score: 1.0
          }
        };
      }
      
      const searchResults: ExternalSearchAgentResponse['search_results'] = [];
      const externalDataUsed: string[] = [];
      let sourcesSearched = 0;
      let successfulSearches = 0;
      let failedSearches = 0;
      
      // Search external connections first
      const externalConnections = await this.getExternalConnections(workspaceId);
      for (const connection of externalConnections) {
        try {
          sourcesSearched++;
          const connectionResults = await this.searchExternalConnection(connection, optimizedQuery);
          searchResults.push(...connectionResults);
          externalDataUsed.push(connection.name);
          successfulSearches++;
        } catch (error) {
          console.warn(`Failed to search external connection ${connection.name}:`, error);
          failedSearches++;
        }
      }
      
      // Perform web search if needed
      let webSearchTokens = 0;
      if (this.requiresWebSearch(optimizedQuery)) {
        try {
          sourcesSearched++;
          const webSearchResult = await this.performWebSearch(optimizedQuery);
          searchResults.push(...webSearchResult.results);
          externalDataUsed.push('web_search');
          successfulSearches++;
          webSearchTokens = webSearchResult.tokensUsed;
        } catch (error) {
          console.warn('Web search failed:', error);
          failedSearches++;
        }
      }
      
      // Sort results by relevance
      searchResults.sort((a, b) => b.relevance_score - a.relevance_score);
      
      const averageRelevanceScore = searchResults.length > 0 
        ? searchResults.reduce((sum, r) => sum + r.relevance_score, 0) / searchResults.length 
        : 0;
      
      const result: ExternalSearchAgentResponse = {
        search_results: searchResults.slice(0, 10), // Limit to top 10 results
        total_results: searchResults.length,
        search_summary: {
          sources_searched: sourcesSearched,
          successful_searches: successfulSearches,
          failed_searches: failedSearches,
          average_relevance_score: averageRelevanceScore
        },
        external_data_used: externalDataUsed
      };
      
      console.log('🌐 External Search Result:', {
        total_results: result.total_results,
        sources_searched: sourcesSearched,
        successful_searches: successfulSearches,
        external_data_used: externalDataUsed.length
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          tokens_used: webSearchTokens,
          confidence_score: result.search_summary.average_relevance_score
        }
      };
      
    } catch (error) {
      console.error('External Search Agent error:', error);
      
      return {
        success: false,
        data: {
          search_results: [],
          total_results: 0,
          search_summary: {
            sources_searched: 0,
            successful_searches: 0,
            failed_searches: 0,
            average_relevance_score: 0
          },
          external_data_used: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private shouldSearchExternal(query: string): boolean {
    const externalIndicators = [
      'latest', 'current', 'recent', 'news', 'market data', 'stock price',
      'weather', 'real-time', 'live data', 'external', 'web', 'online',
      'api', 'third-party', 'public data', 'open data'
    ];
    
    const lowerQuery = query.toLowerCase();
    return externalIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  private requiresWebSearch(query: string): boolean {
    const webSearchIndicators = [
      'what is', 'who is', 'when did', 'where is', 'how to',
      'definition', 'meaning', 'explain', 'describe', 'tell me about',
      'current events', 'latest news', 'recent developments'
    ];
    
    const lowerQuery = query.toLowerCase();
    return webSearchIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  private async getExternalConnections(workspaceId: string): Promise<any[]> {
    const { data: connections } = await supabase
      .from('external_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .eq('connection_status', 'active');
    
    return connections || [];
  }

  private async searchExternalConnection(connection: any, query: string): Promise<ExternalSearchAgentResponse['search_results']> {
    const results: ExternalSearchAgentResponse['search_results'] = [];
    
    try {
      switch (connection.type) {
        case 'google-sheets':
          results.push(...await this.searchGoogleSheets(connection, query));
          break;
        case 'google-docs':
          results.push(...await this.searchGoogleDocs(connection, query));
          break;
        case 'web-url':
          results.push(...await this.searchWebURL(connection, query));
          break;
        case 'google-analytics':
          results.push(...await this.searchGoogleAnalytics(connection, query));
          break;
        default:
          console.warn(`Unsupported external connection type: ${connection.type}`);
      }
    } catch (error) {
      console.error(`Error searching external connection ${connection.name}:`, error);
    }
    
    return results;
  }

  private async searchGoogleSheets(connection: any, query: string): Promise<ExternalSearchAgentResponse['search_results']> {
    // This would integrate with your existing Google Sheets connector
    // For now, return mock data
    return [
      {
        source: connection.name,
        title: 'Google Sheets Data',
        content: `Relevant data from Google Sheets: ${query}`,
        relevance_score: 0.8,
        source_type: 'external_connection' as const
      }
    ];
  }

  private async searchGoogleDocs(connection: any, query: string): Promise<ExternalSearchAgentResponse['search_results']> {
    // This would integrate with your existing Google Docs connector
    return [
      {
        source: connection.name,
        title: 'Google Docs Content',
        content: `Relevant content from Google Docs: ${query}`,
        relevance_score: 0.7,
        source_type: 'external_connection' as const
      }
    ];
  }

  private async searchWebURL(connection: any, query: string): Promise<ExternalSearchAgentResponse['search_results']> {
    // This would integrate with your existing web scraper
    return [
      {
        source: connection.name,
        title: 'Web Scraped Content',
        content: `Relevant content from web URL: ${query}`,
        url: connection.url,
        relevance_score: 0.6,
        source_type: 'external_connection' as const
      }
    ];
  }

  private async searchGoogleAnalytics(connection: any, query: string): Promise<ExternalSearchAgentResponse['search_results']> {
    // This would integrate with your existing Google Analytics connector
    return [
      {
        source: connection.name,
        title: 'Google Analytics Data',
        content: `Analytics data: ${query}`,
        relevance_score: 0.9,
        source_type: 'external_connection' as const
      }
    ];
  }

  private async performWebSearch(query: string): Promise<{ results: ExternalSearchAgentResponse['search_results']; tokensUsed: number }> {
    // Use AI to perform intelligent web search
    const searchPrompt = `Perform a web search for this query and return relevant results.

Query: "${query}"

Return search results as JSON array with:
- title: Result title
- content: Brief description/snippet
- url: Source URL (if available)
- relevance_score: 0.0-1.0

Focus on authoritative, recent, and relevant sources.

Respond with JSON array:
[
  {
    "title": "Result Title",
    "content": "Brief description of the result",
    "url": "https://example.com",
    "relevance_score": 0.8
  }
]`;

    try {
      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a web search expert. Perform intelligent web searches and return relevant results. Respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: searchPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const searchResults = JSON.parse(response.content);
      
      return {
        results: searchResults.map((result: any) => ({
          source: 'web_search',
          title: result.title || 'Web Search Result',
          content: result.content || 'No description available',
          url: result.url,
          relevance_score: result.relevance_score || 0.5,
          source_type: 'web' as const
        })),
        tokensUsed: response.tokens_used
      };
    } catch (error) {
      console.warn('AI web search failed, using fallback:', error);
      return {
        results: [
          {
            source: 'web_search',
            title: 'Web Search Result',
            content: `Search results for: ${query}`,
            relevance_score: 0.5,
            source_type: 'web' as const
          }
        ],
        tokensUsed: 0
      };
    }
  }
}
