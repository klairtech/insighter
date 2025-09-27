import { 
  dataSourceFilterAgent,
  dataSourceRankingAgent,
  databaseExecutionCoordinator,
  externalAPIExecutionCoordinator,
  multiSourceQAAgent,
  processWithEnhancedMultiAgentFlow
} from '../enhanced-multi-agent-flow'

// Mock the dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                filtered_sources: [
                  {
                    id: 'test_source_1',
                    relevance_score: 0.9,
                    reasoning: 'Test source for unit testing'
                  }
                ],
                filter_criteria: ['test_criteria'],
                confidence_score: 0.8
              })
            }
          }],
          usage: { total_tokens: 100 }
        }))
      }
    }
  }))
}))

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn(() => Promise.resolve({
        response: {
          text: () => JSON.stringify({
            ranked_sources: [
              {
                id: 'test_source_1',
                rank: 1,
                processing_priority: 'high',
                reasoning: 'Primary test source'
              }
            ],
            processing_strategy: 'single_source',
            source_combination_approach: 'complementary',
            optimization_recommendations: ['Use single source for testing']
          })
        }
      }))
    }))
  }))
}))

describe('Enhanced Multi-Agent Flow', () => {
  const mockWorkspaceId = 'test-workspace-123'
  const mockAgentId = 'test-agent-456'
  const mockUserQuery = 'What are the sales trends for Q1 2024?'
  const mockConversationHistory = [
    {
      sender_type: 'user',
      content: 'Hello, I need help with sales analysis',
      created_at: '2024-01-01T00:00:00Z'
    }
  ]

  describe('dataSourceFilterAgent', () => {
    it('should filter data sources based on user query', async () => {
      const result = await dataSourceFilterAgent(
        mockUserQuery,
        mockWorkspaceId,
        mockConversationHistory
      )

      expect(result).toHaveProperty('filtered_sources')
      expect(result).toHaveProperty('filter_metadata')
      expect(result).toHaveProperty('confidence_score')
      expect(result.filter_metadata).toHaveProperty('total_sources_analyzed')
      expect(result.filter_metadata).toHaveProperty('sources_filtered')
      expect(result.filter_metadata).toHaveProperty('tokens_used')
    })

    it('should handle empty workspace gracefully', async () => {
      const result = await dataSourceFilterAgent(
        mockUserQuery,
        'empty-workspace',
        mockConversationHistory
      )

      expect(result.filtered_sources).toEqual([])
      expect(result.confidence_score).toBe(0.0)
    })
  })

  describe('dataSourceRankingAgent', () => {
    it('should rank filtered sources and determine processing strategy', async () => {
      const mockFilteredSources = [
        {
          id: 'source_1',
          name: 'Sales Database',
          type: 'database' as const,
          connection_type: 'postgresql',
          content_type: 'database',
          confidence_score: 0.8,
          relevance_score: 0.9,
          processing_strategy: 'single_source' as const,
          estimated_processing_time_ms: 2000,
          metadata: {}
        }
      ]

      const result = await dataSourceRankingAgent(
        mockUserQuery,
        mockFilteredSources,
        mockConversationHistory
      )

      expect(result).toHaveProperty('ranked_sources')
      expect(result).toHaveProperty('processing_strategy')
      expect(result).toHaveProperty('source_combination_approach')
      expect(result).toHaveProperty('optimization_recommendations')
      expect(result).toHaveProperty('metadata')
    })

    it('should handle empty filtered sources', async () => {
      const result = await dataSourceRankingAgent(
        mockUserQuery,
        [],
        mockConversationHistory
      )

      expect(result.ranked_sources).toEqual([])
      expect(result.processing_strategy).toBe('single_source')
    })
  })

  describe('databaseExecutionCoordinator', () => {
    it('should execute database queries and return results', async () => {
      const mockSource = {
        id: 'db_source_1',
        name: 'Sales Database',
        type: 'database' as const,
        connection_type: 'postgresql',
        content_type: 'database',
        confidence_score: 0.8,
        relevance_score: 0.9,
        processing_strategy: 'single_source' as const,
        estimated_processing_time_ms: 2000,
        metadata: {}
      }

      const result = await databaseExecutionCoordinator(
        mockSource,
        mockUserQuery,
        mockConversationHistory
      )

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('execution_time_ms')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('tokens_used')
      expect(result).toHaveProperty('processing_time_ms')
    })
  })

  describe('externalAPIExecutionCoordinator', () => {
    it('should execute external API calls and return results', async () => {
      const mockSource = {
        id: 'api_source_1',
        name: 'External API',
        type: 'url' as const,
        connection_type: 'api_endpoint',
        content_type: 'api',
        confidence_score: 0.7,
        relevance_score: 0.8,
        processing_strategy: 'single_source' as const,
        estimated_processing_time_ms: 1500,
        metadata: {}
      }

      const result = await externalAPIExecutionCoordinator(
        mockSource,
        mockUserQuery,
        mockConversationHistory
      )

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('api_endpoint')
      expect(result).toHaveProperty('execution_time_ms')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('tokens_used')
      expect(result).toHaveProperty('processing_time_ms')
    })
  })

  describe('multiSourceQAAgent', () => {
    it('should combine results from multiple sources', async () => {
      const mockSourceResults = [
        {
          success: true,
          data: { sales_data: 'Q1 2024 sales increased by 15%' },
          query_executed: 'SELECT * FROM sales WHERE quarter = "Q1 2024"',
          execution_time_ms: 200,
          rows_affected: 100,
          metadata: {
            database_id: 'db_1',
            database_type: 'postgresql',
            tables_accessed: ['sales'],
            confidence_score: 0.9,
            processing_status: 'completed'
          },
          tokens_used: 50,
          processing_time_ms: 200
        }
      ]

      const result = await multiSourceQAAgent(
        mockUserQuery,
        mockSourceResults,
        mockConversationHistory
      )

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('source_attributions')
      expect(result).toHaveProperty('data_synthesis')
      expect(result).toHaveProperty('follow_up_questions')
      expect(result).toHaveProperty('tokens_used')
      expect(result).toHaveProperty('processing_time_ms')
      expect(result).toHaveProperty('metadata')
    })

    it('should handle empty source results', async () => {
      const result = await multiSourceQAAgent(
        mockUserQuery,
        [],
        mockConversationHistory
      )

      expect(result.content).toContain("couldn't find any relevant data sources")
      expect(result.source_attributions).toEqual([])
      expect(result.metadata.total_sources_processed).toBe(0)
    })
  })

  describe('processWithEnhancedMultiAgentFlow', () => {
    it('should process user query through the complete enhanced flow', async () => {
      const result = await processWithEnhancedMultiAgentFlow(
        mockUserQuery,
        mockWorkspaceId,
        mockAgentId,
        mockConversationHistory
      )

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('tokens_used')
      expect(result).toHaveProperty('processing_time_ms')
      expect(result.metadata).toHaveProperty('processing_status')
      expect(result.metadata).toHaveProperty('agent_id', mockAgentId)
      expect(result.metadata).toHaveProperty('workspace_id', mockWorkspaceId)
      expect(result.metadata).toHaveProperty('data_sources_used')
      expect(result.metadata).toHaveProperty('confidence_score')
    })

    it('should handle errors gracefully and provide fallback response', async () => {
      // Test with invalid workspace ID to trigger error handling
      const result = await processWithEnhancedMultiAgentFlow(
        mockUserQuery,
        'invalid-workspace',
        mockAgentId,
        mockConversationHistory
      )

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('metadata')
      expect(result.metadata.processing_status).toBe('no_sources_available')
      expect(result.metadata.confidence_score).toBe(0.0)
    })
  })

  describe('Error Handling', () => {
    it('should handle AI service failures gracefully', async () => {
      // Mock OpenAI failure
      const mockOpenAI = jest.requireMock('openai').default
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn(() => Promise.reject(new Error('OpenAI API Error')))
          }
        }
      }))

      const result = await dataSourceFilterAgent(
        mockUserQuery,
        mockWorkspaceId,
        mockConversationHistory
      )

      expect(result.filtered_sources).toEqual([])
      expect(result.confidence_score).toBe(0.0)
    })
  })

  describe('Performance', () => {
    it('should complete processing within reasonable time', async () => {
      const startTime = Date.now()
      
      await processWithEnhancedMultiAgentFlow(
        mockUserQuery,
        mockWorkspaceId,
        mockAgentId,
        mockConversationHistory
      )
      
      const processingTime = Date.now() - startTime
      
      // Should complete within 10 seconds (generous for testing)
      expect(processingTime).toBeLessThan(10000)
    })
  })
})
