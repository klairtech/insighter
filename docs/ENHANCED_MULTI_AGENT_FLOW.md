# Enhanced Multi-Agent Flow Implementation

## Overview

The Enhanced Multi-Agent Flow system implements the comprehensive Q&A and chat window API flow as specified in the `enhanced-multi-agent-flow-database.md` document. This system provides intelligent data source selection, multi-source processing, and comprehensive response generation with full source attribution.

## Architecture

The enhanced flow consists of several specialized agents working together:

```
User Query → Data Source Filter Agent → Data Source Ranking Agent → Execution Coordinators → Multi-Source Q&A Agent → Response
```

### 1. Data Source Filter Agent

**Purpose**: Filters available data sources to identify the most relevant candidates for the user's query.

**Process**:

- Analyzes all available data sources in the workspace (databases, files, APIs)
- Uses AI to score relevance of each source to the user's query
- Selects top 8 most relevant sources
- Provides filtering criteria and confidence scores

**Output**:

```typescript
{
  filtered_sources: DataSource[];
  filter_metadata: {
    total_sources_analyzed: number;
    sources_filtered: number;
    filter_criteria: string[];
    processing_time_ms: number;
    tokens_used: number;
    estimated_credits: number;
  };
  confidence_score: number;
}
```

### 2. Data Source Ranking Agent

**Purpose**: Ranks filtered sources and determines the optimal processing strategy.

**Process**:

- Analyzes filtered sources for optimal processing order
- Determines processing strategy (single_source, multi_source_parallel, multi_source_sequential)
- Chooses source combination approach (complementary, verification, comprehensive)
- Provides optimization recommendations

**Output**:

```typescript
{
  ranked_sources: DataSource[];
  processing_strategy: 'single_source' | 'multi_source_parallel' | 'multi_source_sequential';
  source_combination_approach: 'complementary' | 'verification' | 'comprehensive';
  optimization_recommendations: string[];
  metadata: {
    ranking_algorithm: string;
    sources_ranked: number;
    processing_time_ms: number;
    optimization_applied: boolean;
    tokens_used: number;
    estimated_credits: number;
  };
}
```

### 3. Database Execution Coordinator

**Purpose**: Executes queries on database sources.

**Process**:

- Connects to database sources
- Executes optimized queries based on user query
- Returns structured data with execution metadata
- Handles errors and provides fallback responses

**Output**:

```typescript
{
  success: boolean;
  data: any;
  query_executed?: string;
  execution_time_ms: number;
  rows_affected?: number;
  error_message?: string;
  metadata: {
    database_id: string;
    database_type: string;
    tables_accessed: string[];
    confidence_score: number;
    processing_status: string;
  };
  tokens_used: number;
  processing_time_ms: number;
}
```

### 4. External API Execution Coordinator

**Purpose**: Executes API calls and web scraping for external data sources.

**Process**:

- Handles external API calls and web scraping
- Manages rate limiting and authentication
- Returns structured data with source attribution
- Provides error handling and fallback responses

**Output**:

```typescript
{
  success: boolean;
  data: any;
  api_endpoint: string;
  execution_time_ms: number;
  response_status: number;
  error_message?: string;
  metadata: {
    source_type: string;
    source_id: string;
    confidence_score: number;
    processing_status: string;
  };
  tokens_used: number;
  processing_time_ms: number;
}
```

### 5. Multi-Source Q&A Agent

**Purpose**: Combines results from all data sources to provide comprehensive responses.

**Process**:

- Analyzes results from all processed sources
- Identifies key insights and patterns
- Combines information from multiple sources
- Identifies conflicts and gaps in data
- Generates comprehensive response with source attribution
- Suggests relevant follow-up questions

**Output**:

```typescript
{
  content: string;
  source_attributions: Array<{
    source_type: 'database' | 'file' | 'url' | 'google_docs' | 'api_endpoint';
    source_id: string;
    contribution: string;
    confidence_score: number;
    data_points_used?: number;
    processing_time_ms?: number;
  }>;
  data_synthesis: {
    primary_insights: string[];
    supporting_evidence: string[];
    conflicting_information?: string[];
    gaps_identified?: string[];
    cross_source_validation: boolean;
    confidence_assessment: string;
  };
  follow_up_questions: string[];
  tokens_used: number;
  processing_time_ms: number;
  metadata: {
    total_sources_processed: number;
    processing_strategy: string;
    confidence_score: number;
    response_quality_score: number;
  };
}
```

## Processing Strategies

### Single Source Processing

- Uses only the highest-ranked data source
- Fastest processing time
- Suitable for simple queries with clear primary data source

### Multi-Source Parallel Processing

- Processes multiple sources simultaneously
- Optimal for complex queries requiring comprehensive data
- Balances speed and completeness

### Multi-Source Sequential Processing

- Processes sources in order of importance
- Allows for early termination if sufficient data is found
- Good for queries where primary source is most important

## Source Combination Approaches

### Complementary

- Sources provide different but related information
- Combines diverse perspectives for comprehensive analysis
- Example: Database sales data + external market research

### Verification

- Sources provide similar information for cross-validation
- Identifies discrepancies and inconsistencies
- Example: Multiple databases with overlapping data

### Comprehensive

- Sources provide complete coverage of the topic
- Ensures no important information is missed
- Example: Internal data + external benchmarks + industry reports

## API Integration

The enhanced multi-agent flow is integrated into all chat API endpoints:

### Updated Endpoints

1. **`/api/chat/agents/[agentId]/messages`** - Standard chat messages
2. **`/api/chat/agents/[agentId]/messages/stream`** - Streaming chat messages
3. **`/api/chat/conversations/[conversationId]/messages`** - Conversation messages
4. **`/api/conversations/[conversationId]/messages`** - Unified messages API
5. **`/api/agents/[id]/chat`** - Agent API endpoint

### Usage

All endpoints now use `processWithEnhancedAgent()` instead of `processWithAgent()`, which:

1. Automatically uses the enhanced multi-agent flow
2. Falls back to standard processing if enhanced flow fails
3. Maintains backward compatibility
4. Provides comprehensive source attribution and confidence scoring

## Token Tracking and Credit System

The enhanced flow includes comprehensive token tracking:

- **Input tokens**: User message and context
- **Processing tokens**: Internal agent processing
- **Output tokens**: Generated response
- **Total tokens**: Sum of all token usage
- **Credit calculation**: Math.ceil(total_tokens / 1000)

Token tracking is provided for:

- Each individual agent
- Overall processing pipeline
- Source-specific processing
- Response generation

## Source Attribution

Every response includes detailed source attribution:

- **Source type**: Database, file, URL, API endpoint, etc.
- **Source ID**: Unique identifier for the data source
- **Contribution**: What the source contributed to the response
- **Confidence score**: How confident the system is in this source's data
- **Data points used**: Number of data points from this source
- **Processing time**: How long it took to process this source

## Error Handling

The enhanced flow includes comprehensive error handling:

1. **Graceful degradation**: Falls back to standard processing if enhanced flow fails
2. **Source-specific errors**: Individual source failures don't stop the entire process
3. **Detailed error reporting**: Specific error messages for debugging
4. **Retry mechanisms**: Automatic retries for transient failures
5. **Fallback responses**: Meaningful responses even when some sources fail

## Performance Optimization

The system includes several performance optimizations:

1. **Parallel processing**: Multiple sources processed simultaneously when possible
2. **Intelligent caching**: File content and query results are cached
3. **Dynamic content allocation**: More relevant sources get more processing time
4. **Early termination**: Processing stops when sufficient data is found
5. **Token optimization**: Efficient prompt engineering to minimize token usage

## Monitoring and Analytics

The enhanced flow provides comprehensive monitoring:

- **Processing time tracking**: Detailed timing for each step
- **Token usage monitoring**: Real-time token consumption tracking
- **Source performance metrics**: Success rates and processing times per source
- **Confidence scoring**: Quality assessment of responses
- **Error rate tracking**: Monitoring of failures and fallbacks

## Future Enhancements

Planned enhancements include:

1. **Real-time source monitoring**: Live health checks for data sources
2. **Adaptive processing strategies**: Dynamic strategy selection based on query complexity
3. **Advanced caching**: Intelligent caching with invalidation strategies
4. **Source quality scoring**: Historical performance-based source ranking
5. **Custom agent configurations**: Workspace-specific agent behavior tuning

## Configuration

The enhanced multi-agent flow can be configured through environment variables:

- `ENHANCED_MULTI_AGENT_ENABLED`: Enable/disable enhanced flow (default: true)
- `MAX_SOURCES_PER_QUERY`: Maximum number of sources to process (default: 8)
- `PARALLEL_PROCESSING_LIMIT`: Maximum parallel source processing (default: 3)
- `SOURCE_TIMEOUT_MS`: Timeout for individual source processing (default: 30000)
- `FALLBACK_TO_STANDARD`: Enable fallback to standard processing (default: true)

## Testing

The enhanced flow includes comprehensive testing:

1. **Unit tests**: Individual agent testing
2. **Integration tests**: End-to-end flow testing
3. **Performance tests**: Load and stress testing
4. **Error simulation**: Failure scenario testing
5. **Source validation**: Data source connectivity testing

## Conclusion

The Enhanced Multi-Agent Flow provides a robust, scalable, and intelligent system for processing user queries across multiple data sources. It combines the power of AI-driven source selection with comprehensive data processing and attribution, delivering high-quality responses with full transparency and confidence scoring.

The system is designed to be:

- **Reliable**: Comprehensive error handling and fallback mechanisms
- **Scalable**: Efficient processing strategies and performance optimization
- **Transparent**: Full source attribution and confidence scoring
- **Flexible**: Configurable processing strategies and source combinations
- **Maintainable**: Clean architecture with comprehensive monitoring and testing
