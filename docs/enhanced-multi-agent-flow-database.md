# Enhanced Multi-Agent Flow with Database Support

## Overview

This document outlines the enhanced multi-agent system that now supports multiple data source types: file-based data, database connections, public URLs, Google Docs, and websites. The system intelligently routes between different data sources and uses specialized agents for each data source type.

## Enhanced Flow Diagram

### Basic Question Handling Flow

When a user asks a basic question about database structure, the system now follows this optimized path:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER ASKS BASIC QUESTION                              │
│                    (e.g., "What tables are in this database?")                  │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        1. AUTHENTICATION & ACCESS                              │
│  • Verify user session (Supabase auth)                                         │
│  • Check agent access permissions (hierarchical access control)                │
│  • Validate user can perform read action                                       │
│  • Check user credit balance (minimal credits for schema queries)              │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        2. CONVERSATION MANAGEMENT                              │
│  • Find existing conversation or create new one                                │
│  • Get conversation context (messages, agent_id, workspace_id)                 │
│  • Save encrypted user message to database                                     │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        3. ENHANCED ROUTER AGENT                               │
│  • Determines data source type: DATABASE                                      │
│  • Assesses query complexity: BASIC                                           │
│  • Detects: can_answer_from_schema = true                                     │
│  • Routes to: Schema Answer Agent (skips Query Agent)                         │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        4. SCHEMA ANSWER AGENT                                 │
│  • Analyzes question against database schema metadata                          │
│  • Extracts relevant table/column/relationship information                     │
│  • Generates natural language response from schema alone                       │
│  • Provides follow-up suggestions for deeper analysis                          │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        5. DIRECT RESPONSE (No Query Execution)                 │
│  • Encrypt agent response                                                     │
│  • Save to database with metadata                                            │
│  • Update conversation last_message_at                                       │
│  • Return comprehensive response to user                                     │
│  • Minimal token usage (no query generation or execution)                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Enhanced Flow Diagram - User Query Processing with RAG & XAI

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER ASKS QUESTION                                    │
│                    (Chat UI or API Endpoint)                                    │
│                    Using Pre-Generated AI Summaries                            │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        1. AUTHENTICATION & ACCESS                              │
│  • Verify user session (Supabase auth)                                         │
│  • Check agent access permissions (hierarchical access control)                │
│  • Validate user can perform write action                                      │
│  • Check user credit balance and deduct credits for operation                  │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        2. CONVERSATION MANAGEMENT                              │
│  • Find existing conversation or create new one                                │
│  • Get conversation context (messages, agent_id, workspace_id)                 │
│  • Save encrypted user message to database                                     │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        3. MAIN PROCESSING (processWithAgent)                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.1 CONVERSATION SUMMARY                              │   │
│  │  • Generate summary of previous conversation context                    │   │
│  │  • Use for better context understanding                                │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.2 QUERY INTENT CLASSIFICATION                       │   │
│  │  • classifyQueryIntent() - AI-powered intent analysis                  │   │
│  │  • Classifies as: analytical, comparative, exploratory, specific_lookup │   │
│  │    continuation, closing, greeting                                     │   │
│  │  • Extracts key entities and context                                   │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.3 QUERY VALIDATION                                 │   │
│  │  • Enhanced validation with conversation context                       │   │
│  │  • Determines if query is valid for data analysis                     │   │
│  │  • Handles special cases: greetings, continuations, closings          │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.4 ENHANCED ROUTER AGENT                            │   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.4.1 DATA SOURCE FILTER AGENT                     │   │   │
│  │  │  • Analyzes AI summaries and conversation context              │   │   │
│  │  │  • Filters 10s of data sources to top candidates              │   │   │
│  │  │  • Uses semantic similarity and keyword matching              │   │   │
│  │  │  • Returns filtered list of potentially relevant sources      │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.4.2 DATA SOURCE RANKING AGENT                    │   │   │
│  │  │  • Ranks filtered sources by relevance and confidence          │   │   │
│  │  │  • Considers conversation history and context                  │   │   │
│  │  │  • Optimizes for multi-source query combinations              │   │   │
│  │  │  • Returns ranked list with confidence scores and reasoning   │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.5 DATA SOURCE EXECUTION COORDINATORS              │   │
│  │  • Execute data retrieval from ranked sources provided by Router     │   │
│  │  • Handle OAuth authentication and API calls                        │   │
│  │  • Manage rate limiting and quota management                        │   │
│  │  • Coordinate parallel data fetching from multiple sources          │   │
│  │  • Return structured data to Content Processor Agent                │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.6 SPECIALIZED PROCESSING AGENTS                    │   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.1 QUERY AGENT (Database)                       │   │   │
│  │  │  • Generates SQL/NoSQL queries based on schema                 │   │   │
│  │  │  • Returns: query, reasoning, confidence_score                 │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.2 SPREADSHEET AGENT (Google Sheets, Airtable)  │   │   │
│  │  │  • Fetches spreadsheet data via OAuth APIs                     │   │   │
│  │  │  • Processes structured data (rows, columns, formulas)         │   │   │
│  │  │  • Returns: structured_data, ai_summaries, confidence_score   │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.3 COLLABORATION AGENT (Notion, Slack, Discord) │   │   │
│  │  │  • Fetches content from collaboration platforms                │   │   │
│  │  │  • Processes messages, pages, channels, threads               │   │   │
│  │  │  • Returns: content_data, metadata, confidence_score          │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.4 VERSION_CONTROL AGENT (GitHub, GitLab)      │   │   │
│  │  │  • Fetches repository data, issues, PRs, commits              │   │   │
│  │  │  • Analyzes code structure and project metrics                │   │   │
│  │  │  • Returns: repo_data, metrics, confidence_score              │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.5 PROJECT_MANAGEMENT AGENT (Jira, Trello, Asana)│   │   │
│  │  │  • Fetches projects, tasks, boards, workflows                 │   │   │
│  │  │  • Analyzes project progress and team productivity            │   │   │
│  │  │  • Returns: project_data, insights, confidence_score          │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.6 CLOUD_STORAGE AGENT (Dropbox, OneDrive)     │   │   │
│  │  │  • Fetches files and folder structures                        │   │   │
│  │  │  • Processes document content and metadata                    │   │   │
│  │  │  • Returns: file_data, structure, confidence_score            │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.6.7 WEB_CONTENT AGENT (URLs, RSS, APIs)         │   │   │
│  │  │  • Fetches and processes web content, RSS feeds, API data     │   │   │
│  │  │  • Extracts relevant information based on question            │   │   │
│  │  │  • Returns: extracted_content, metadata, confidence_score     │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.7 DATA EXECUTION AGENTS                           │   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.7.1 DB AGENT (Database Execution)                │   │   │
│  │  │  • Executes SQL/NoSQL queries with retry logic                 │   │   │
│  │  │  • Returns: query results, execution_time, row_count          │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.7.2 API EXECUTION AGENT                          │   │   │
│  │  │  • Executes API calls to external services                     │   │   │
│  │  │  • Handles OAuth authentication and rate limiting             │   │   │
│  │  │  • Returns: api_data, response_time, status_code              │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  │                        │                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │             3.7.3 CONTENT PROCESSOR AGENT                      │   │   │
│  │  │  • Processes content from all data sources                     │   │   │
│  │  │  • Extracts and structures relevant information               │   │   │
│  │  │  • Returns: processed_content, metadata, confidence_score    │   │   │
│  │  └─────────────────────┬───────────────────────────────────────────┘   │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.8 OAUTH AUTHENTICATION FLOW                       │   │
│  │  • Handles OAuth2 flows for external services (Google, GitHub, etc.)  │   │
│  │  • Manages access/refresh token lifecycle                             │   │
│  │  • Handles token refresh and expiration                               │   │
│  │  • Returns: auth_status, tokens_encrypted, permissions_granted        │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.9 VISUAL AGENT                                     │   │
│  │  • Analyzes query results and user question                          │   │
│  │  • Determines if visualization would be helpful                      │   │
│  │  • Returns: visualization_required (boolean), chart_type, reasoning  │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.10 GRAPH AGENT (if visualization needed)           │   │
│  │  • Creates appropriate chart/graph based on data                      │   │
│  │  • Supports: bar, line, pie, scatter, heatmap, etc.                  │   │
│  │  • Returns: chart_data, chart_config, image_url                      │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.11 Q&A AGENT (Multi-Source Results)               │   │
│  │  • Processes results from all data sources with user question         │   │
│  │  • Generates natural language response with source attribution        │   │
│  │  • Includes insights, trends, and key findings across platforms       │   │
│  │  • Returns: content, follow_up_questions, tokens_used, source_attributions│   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
│                        │                                                       │
│                        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   3.12 RESPONSE VALIDATION                             │   │
│  │  • validateAgentResponse() - content safety checks                    │   │
│  │  • Token usage calculation and tracking                               │   │
│  │  • XAI metrics generation for transparency                            │   │
│  └─────────────────────┬───────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        4. ENHANCED RESPONSE HANDLING (RAG & XAI)             │
│  • Encrypt agent response with XAI reasoning                                │
│  • Save to database with RAG context and metadata                           │
│  • Store SQL/NoSQL queries with explainable reasoning (if applicable)       │
│  • Store API responses and external data with source attribution (if applicable)│
│  • Store visualization data with XAI explanations (if applicable)           │
│  • Store source attributions and cross-platform insights with reasoning    │
│  • Update conversation last_message_at with RAG context                     │
│  • Return comprehensive response with explainable AI reasoning to user      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## RAG & XAI Core Architecture

### **Pre-Generated AI Summaries**

When data sources are established, AI summaries are automatically generated to describe:

- **Data Content**: What data is available in each source
- **Data Structure**: How the data is organized (tables, columns, sheets, etc.)
- **Data Relationships**: How different data sources relate to each other
- **Data Capabilities**: What types of questions each source can answer
- **Data Freshness**: When data was last updated and sync frequency

### **RAG (Retrieval-Augmented Generation) Flow**

1. **Query Understanding**: User question is analyzed for intent and entities
2. **Summary Retrieval**: Pre-generated AI summaries are retrieved and ranked
3. **Context Augmentation**: Relevant summaries are used to augment the query context
4. **Source Selection**: Most relevant data sources are selected based on summary relevance
5. **Data Retrieval**: Actual data is fetched from selected sources
6. **Response Generation**: Final answer is generated using retrieved data and context

### **XAI (Explainable AI) Integration**

- **Source Selection Reasoning**: Clear explanation of why specific sources were chosen
- **Confidence Scoring**: Transparent confidence scores with reasoning
- **Multi-Source Logic**: Explanation of how multiple sources complement each other
- **Query Processing**: Step-by-step explanation of how the query was processed
- **Data Synthesis**: Clear explanation of how data from different sources was combined

### **AI Summary Utilization in Query Processing**

#### **Pre-Generated Summary Structure**

```typescript
{
  source_id: string;
  summary_type: 'database' | 'spreadsheet' | 'document' | 'api' | 'collaboration';
  content_summary: {
    data_overview: string;           // What data is available
    structure_description: string;   // How data is organized
    key_entities: string[];         // Main entities/topics
    data_types: string[];           // Types of data (numbers, text, dates, etc.)
    relationships: string[];        // How this connects to other sources
    capabilities: string[];         // What questions this can answer
  };
  metadata: {
    last_updated: string;
    data_freshness: string;
    source_reliability: number;
    access_frequency: number;
  };
  embeddings: number[];             // Vector embeddings for semantic search
}
```

#### **Query Processing with AI Summaries**

1. **Semantic Matching**: User question is matched against AI summary embeddings
2. **Relevance Scoring**: Summaries are scored based on content relevance
3. **Capability Assessment**: AI summaries indicate if source can answer the question
4. **Context Augmentation**: Relevant summaries provide context for data retrieval
5. **Source Selection**: Most relevant sources are selected based on summary analysis

## Enhanced Router Agent Optimization

### **Two-Stage Approach Benefits**

The Enhanced Router Agent is split into two stages to optimize performance when dealing with 10s of data sources:

#### **Stage 1: Data Source Filter Agent**

- **Purpose**: Quickly filter 10s of sources to top 10-15 candidates using pre-generated AI summaries
- **Input**: Pre-generated AI summaries from data source establishment
- **Optimization**: Uses lightweight semantic analysis and keyword matching against AI summaries
- **Performance**: Processes all sources in parallel with minimal computational overhead
- **Output**: Filtered list of potentially relevant sources based on summary relevance

#### **Stage 2: Data Source Ranking Agent**

- **Purpose**: Deep analysis of filtered sources for final ranking using RAG and XAI
- **Input**: Filtered sources with their pre-generated AI summaries and metadata
- **Optimization**: Focuses computational resources on top candidates only
- **Performance**: Detailed analysis of 10-15 sources instead of 10s of sources
- **Output**: Ranked list with confidence scores, reasoning (XAI), and multi-source combinations

### **Performance Improvements**

1. **Reduced Computational Load**:

   - Stage 1: O(n) lightweight processing for all sources
   - Stage 2: O(k) detailed processing for k filtered sources (k << n)

2. **Better Accuracy**:

   - Stage 1: Broad semantic matching catches relevant sources
   - Stage 2: Deep analysis ensures optimal source selection

3. **Scalability**:

   - Handles 10s of data sources efficiently
   - Can scale to 100s of sources with minimal performance impact

4. **Multi-Source Optimization**:
   - Stage 2 identifies optimal source combinations
   - Considers synergy between different data sources

### **Example: 50 Data Sources**

**Traditional Approach**: Analyze all 50 sources in detail = 50x computational cost

**Two-Stage Approach**:

- Stage 1: Filter 50 → 12 sources (lightweight)
- Stage 2: Rank 12 sources (detailed)
- Total cost: ~12x computational cost (75% reduction)

### **Token Optimization Benefits**

The two-stage router approach provides significant token optimization:

#### **Token Usage Comparison**

- **Traditional Single-Stage**: 50 sources × 200 tokens = 10,000 tokens
- **Two-Stage Approach**:
  - Stage 1: 50 sources × 50 tokens = 2,500 tokens
  - Stage 2: 12 sources × 200 tokens = 2,400 tokens
  - **Total**: 4,900 tokens (51% reduction)

#### **User Experience-First Token Optimization**

1. **Lightweight Filtering**: Stage 1 uses minimal tokens for semantic matching (no UX impact)
2. **Focused Analysis**: Stage 2 only processes top candidates (improves accuracy)
3. **Pre-Generated Summaries**: Reduces need for real-time data analysis (faster responses)
4. **Smart Context Selection**: Prioritizes most relevant context (better answers)
5. **User-Controlled Optimization**: Users choose detail level and explanation depth
6. **Intelligent Caching**: Caches recent results without compromising freshness
7. **Quality Preservation**: Never samples data or skips features that affect answer quality

### **User Experience Principles for Token Optimization**

#### **Core Principles**

1. **Quality First**: Never compromise answer accuracy or completeness for token savings
2. **User Choice**: Let users decide the trade-off between cost and detail level
3. **Transparency**: Always show users what optimizations are being applied
4. **Graceful Degradation**: If tokens are limited, offer alternatives rather than poor results
5. **Performance Benefits**: Optimizations should improve speed and relevance, not just reduce costs

#### **What We DON'T Optimize**

- **Data Sampling**: Always use complete datasets for accurate analysis
- **Feature Skipping**: Never skip XAI explanations or source attributions
- **Context Truncation**: Never cut important context that affects answer quality
- **Response Truncation**: Never cut responses short - let users choose detail level
- **Complexity Reduction**: Never simplify queries in ways that change the meaning

#### **What We DO Optimize**

- **Efficient Routing**: Use two-stage filtering to focus on relevant sources
- **Smart Caching**: Cache results without compromising data freshness
- **Context Prioritization**: Focus on most relevant context while preserving completeness
- **Format Optimization**: Clean up formatting and remove redundancy
- **User Preferences**: Respect user-chosen detail levels and explanation depth

#### **Token Budget Scenarios**

```typescript
{
  token_budget_scenarios: {
    generous_budget: {
      description: "User has sufficient tokens for full analysis";
      approach: "Use all available context and provide comprehensive answers";
      optimizations: ["smart_context_selection", "response_formatting"];
      ux_impact: "optimal";
    }
    moderate_budget: {
      description: "User has moderate tokens, wants good answers";
      approach: "Focus on most relevant sources, provide complete answers";
      optimizations: ["intelligent_caching", "smart_context_selection"];
      ux_impact: "excellent";
    }
    limited_budget: {
      description: "User has limited tokens, needs cost-effective answers";
      approach: "Offer user choice: brief summary or upgrade for full analysis";
      optimizations: ["user_preferences", "intelligent_caching"];
      ux_impact: "user_controlled";
    }
    insufficient_budget: {
      description: "User cannot afford the operation";
      approach: "Suggest alternatives: simplify query, upgrade plan, or purchase credits";
      optimizations: ["none"];
      ux_impact: "graceful_degradation";
    }
  }
}
```

## New Agent Specifications

### 1. **Enhanced Router Agent (Two-Stage Approach)**

#### 1.1 **Data Source Filter Agent**

**Purpose**: Filter 10s of data sources to top candidates using AI summaries and semantic analysis

**Input**:

- User question
- Conversation context and history
- Available data sources with **pre-generated AI summaries** (10s of sources)
- Source metadata (type, name, description, last_accessed, relevance_indicators)
- AI summaries explaining data content and structure from data source establishment

**Process**:

- **Semantic Analysis**: Uses embeddings to find semantic similarity between question and **pre-generated AI summaries**
- **Keyword Matching**: Identifies key terms and matches against AI summary content and source descriptions
- **Context Analysis**: Considers conversation history and previous source usage patterns
- **Source Type Filtering**: Filters by data source categories (database, spreadsheet, etc.)
- **Relevance Scoring**: Calculates initial relevance scores based on AI summary content relevance
- **Top-K Selection**: Selects top 10-15 most relevant sources for detailed analysis
- **Token Optimization**: Uses lightweight processing (~50 tokens per source) while preserving answer quality

**Output**:

```typescript
{
  filtered_sources: Array<{
    source_id: string;
    source_type: string;
    source_name: string;
    relevance_score: number;
    matching_keywords: string[];
    semantic_similarity: number;
    context_relevance: number;
    ai_summary_snippet: string;
  }>;
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

#### 1.2 **Data Source Ranking Agent**

**Purpose**: Rank filtered sources by relevance and optimize for multi-source combinations

**Input**:

- Filtered sources from Data Source Filter Agent
- User question and conversation context
- **Pre-generated AI summaries** and source capabilities
- Data freshness and multi-source query requirements
- RAG context from previous similar queries

**Process**:

- **RAG-Based Analysis**: Uses retrieval-augmented generation to analyze AI summaries against question requirements
- **XAI Reasoning**: Provides explainable AI reasoning for source selection decisions
- **Capability Assessment**: Evaluates if source can answer the specific question type based on AI summaries
- **Data Freshness**: Considers when data was last updated and synced
- **Multi-Source Optimization**: Identifies optimal combinations of sources using RAG context
- **Confidence Calculation**: Calculates final confidence scores with detailed XAI reasoning
- **Ranking and Selection**: Ranks sources and selects top 3-5 for execution with explainable rationale
- **Token Optimization**: Uses focused analysis (~200 tokens per source) on filtered candidates while maintaining comprehensive analysis

**Output**:

```typescript
{
  ranked_sources: Array<{
    source_id: string;
    source_type: string;
    source_name: string;
    confidence_score: number;
    reasoning: string;
    can_answer_question: boolean;
    data_freshness: string;
    estimated_data_quality: number;
    oauth_required: boolean;
    processing_complexity: 'low' | 'medium' | 'high';
  }>;
  multi_source_combinations: Array<{
    combination_id: string;
    sources: string[];
    combined_confidence: number;
    synergy_score: number;
    reasoning: string;
  }>;
  final_recommendation: {
    primary_sources: string[];        // Top 1-3 sources
    secondary_sources: string[];      // Backup sources
    processing_strategy: 'single_source' | 'multi_source_parallel' | 'multi_source_sequential';
    estimated_processing_time_ms: number;
    confidence_score: number;
    reasoning: string;
  };
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

### 2. **Data Source Execution Coordinators**

#### 2.1 **Database Execution Coordinator**

**Purpose**: Execute data retrieval from ranked database sources

**Input**:

- Ranked database sources from Router Agent
- Database connection configurations
- Query requirements and parameters
- OAuth tokens and authentication

**Process**:

- Establishes secure database connections
- Executes SQL/NoSQL queries based on source capabilities
- Handles connection pooling and retry logic
- Manages query timeouts and error handling
- Returns structured data results

**Output**:

```typescript
{
  execution_results: Array<{
    source_id: string;
    query_executed: string;
    data_retrieved: any[];
    execution_time_ms: number;
    row_count: number;
    success: boolean;
    error_message?: string;
  }>;
  metadata: {
    total_sources_processed: number;
    successful_executions: number;
    failed_executions: number;
    total_processing_time_ms: number;
  }
}
```

#### 2.2 **External API Execution Coordinator**

**Purpose**: Execute data retrieval from ranked external sources (APIs, OAuth services)

**Input**:

- Ranked external sources from Router Agent
- OAuth tokens and API credentials
- API endpoints and parameters
- Rate limiting and quota information

**Process**:

- Manages OAuth authentication flows
- Executes API calls with proper headers and authentication
- Handles rate limiting and quota management
- Implements retry logic for failed requests
- Processes API responses and extracts relevant data

**Output**:

```typescript
{
  api_results: Array<{
    source_id: string;
    api_endpoint: string;
    data_retrieved: any;
    response_status: number;
    execution_time_ms: number;
    success: boolean;
    error_message?: string;
    rate_limit_remaining?: number;
  }>;
  metadata: {
    total_apis_called: number;
    successful_calls: number;
    failed_calls: number;
    total_processing_time_ms: number;
    oauth_tokens_refreshed: number;
  }
}
```

#### 2.3 **File Processing Coordinator**

**Purpose**: Execute data retrieval from ranked file sources (documents, spreadsheets, etc.)

**Input**:

- Ranked file sources from Router Agent
- File access credentials and permissions
- File processing parameters
- Content extraction requirements

**Process**:

- Accesses files through appropriate APIs or file systems
- Extracts content using platform-specific methods
- Processes different file formats and structures
- Handles large files with streaming or chunking
- Returns structured content data

**Output**:

```typescript
{
  file_results: Array<{
    source_id: string;
    file_path: string;
    content_extracted: any;
    file_size_bytes: number;
    processing_time_ms: number;
    success: boolean;
    error_message?: string;
    content_type: string;
  }>;
  metadata: {
    total_files_processed: number;
    successful_extractions: number;
    failed_extractions: number;
    total_processing_time_ms: number;
    total_content_size_bytes: number;
  }
}
```

### 3. **Specialized Processing Agents**

#### 3.1 **Schema Answer Agent (Database)**

**Purpose**: Answer basic questions about database structure and metadata without generating queries

**Input**:

- User question
- Database schema metadata (tables, columns, relationships, constraints)
- Database type and capabilities
- AI-generated table/column descriptions

**Process**:

- Analyzes question to determine if it can be answered from schema alone
- Identifies relevant tables, columns, and relationships mentioned
- Extracts information about data types, constraints, and relationships
- Provides descriptive answers about database structure
- Handles questions about available data without querying actual data

**Output**:

```typescript
{
  answer: string;                    // Natural language answer about schema
  schema_info_used: {
    tables_described: string[];
    columns_described: string[];
    relationships_described: string[];
    constraints_mentioned: string[];
  };
  confidence_score: number;
  reasoning: string;
  follow_up_suggestions?: string[];  // Suggestions for deeper analysis
  requires_data_query?: boolean;     // Whether actual data query is needed for complete answer
}
```

**Example Basic Questions Handled**:

- "What tables are in this database?"
- "What columns does the users table have?"
- "What is the relationship between orders and customers?"
- "What data types are used in the products table?"
- "Does the database have any foreign key constraints?"
- "What indexes are available?"
- "How many tables are in this database?"

#### 2.2 **Query Agent (Database)**

**Purpose**: Generate efficient database queries based on user questions and database schema (supports both SQL and NoSQL)

**Input**:

- User question
- Database schema (tables/collections, columns/fields, relationships, constraints)
- Database type (PostgreSQL, MySQL, SQLite, MongoDB, DynamoDB, etc.)
- Conversation context
- Query intent classification

**Process**:

- Analyzes question to identify required data
- Selects optimal tables/collections and relationships
- Generates database-specific query syntax:
  - **SQL Databases**: Generates SQL with proper joins, aggregations
  - **NoSQL Databases**: Generates appropriate query language (MongoDB queries, DynamoDB expressions, etc.)
- Optimizes for performance and efficiency
- Considers aggregations and data grouping
- Handles different data models (relational vs document vs key-value)

**Output**:

```typescript
{
  query: string;                    // SQL query or NoSQL query (MongoDB, DynamoDB, etc.)
  query_type: 'sql' | 'mongodb' | 'dynamodb' | 'cassandra' | 'redis';
  reasoning: string;
  confidence_score: number;
  estimated_execution_time?: number;
  collections_tables_used: string[];
  fields_columns_used: string[];
  aggregation_pipeline?: any[];     // For MongoDB aggregation pipelines
  filter_criteria?: any;            // For NoSQL filter objects
}
```

#### 2.3 **Web Scraper Agent (URLs/Websites)**

**Purpose**: Fetch and process web content to answer user questions

**Input**:

- User question
- URL or website to scrape
- Content extraction requirements
- Conversation context

**Process**:

- Fetches web content using appropriate methods (Puppeteer, Playwright, or simple HTTP)
- Handles different content types (HTML, JSON, XML, RSS feeds)
- Extracts relevant information based on question context
- Processes dynamic content and JavaScript-rendered pages
- Handles authentication and rate limiting
- Cleans and structures extracted content

**Output**:

```typescript
{
  extracted_content: string;
  content_type: 'html' | 'json' | 'xml' | 'rss' | 'text';
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    published_date?: string;
    url: string;
    domain: string;
    content_length: number;
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.4 **Google Docs Agent**

**Purpose**: Fetch and process Google Docs content to answer user questions

**Input**:

- User question
- Google Doc ID or URL
- Document access permissions
- Conversation context

**Process**:

- Authenticates with Google Docs API using OAuth2
- Fetches document content and structure
- Processes document formatting and layout
- Extracts text, tables, images, and other elements
- Handles collaborative documents and comments
- Maintains document structure and hierarchy

**Output**:

```typescript
{
  doc_content: string;
  doc_structure: {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
      level: number;
    }>;
    tables: Array<{
      headers: string[];
      rows: string[][];
    }>;
    images: Array<{
      alt_text: string;
      url: string;
    }>;
  };
  metadata: {
    doc_id: string;
    title: string;
    last_modified: string;
    authors: string[];
    sharing_status: string;
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.5 **Spreadsheet Agent (Google Sheets, Airtable)**

**Purpose**: Fetch and process spreadsheet data to answer user questions

**Input**:

- User question
- Spreadsheet ID and sheet names
- OAuth tokens for authentication
- Range selections and filters
- Conversation context

**Process**:

- Authenticates with OAuth2 for Google Sheets/Airtable APIs
- Fetches spreadsheet data via platform-specific APIs
- Processes structured data (rows, columns, formulas, formatting)
- Handles data type detection and validation
- Generates hierarchical AI summaries (cell → column → sheet → workbook)
- Extracts key insights and patterns

**Output**:

```typescript
{
  structured_data: Array<{
    sheet_name: string;
    headers: string[];
    rows: any[][];
    data_types: string[];
    formulas: string[];
    formatting: any;
  }>;
  ai_summaries: {
    column_descriptions: Record<string, string>;
    sheet_purpose: string;
    workbook_overview: string;
    key_insights: string[];
  };
  metadata: {
    spreadsheet_id: string;
    sheet_count: number;
    total_rows: number;
    total_columns: number;
    last_modified: string;
    sharing_status: string;
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.6 **Collaboration Agent (Notion, Slack, Discord)**

**Purpose**: Fetch and process content from collaboration platforms

**Input**:

- User question
- Platform workspace ID and content identifiers
- OAuth tokens for authentication
- Content type filters (pages, channels, threads)
- Conversation context

**Process**:

- Authenticates with platform-specific OAuth2 flows
- Fetches content based on user permissions and filters
- Processes structured content (pages, messages, channels, threads)
- Extracts metadata and relationships between content
- Handles platform-specific formatting and mentions
- Generates contextual summaries and insights

**Output**:

```typescript
{
  content_data: Array<{
    content_id: string;
    content_type: 'page' | 'message' | 'channel' | 'thread';
    title: string;
    content: string;
    author: string;
    created_at: string;
    updated_at: string;
    metadata: any;
  }>;
  relationships: Array<{
    source_id: string;
    target_id: string;
    relationship_type: string;
  }>;
  insights: {
    key_topics: string[];
    active_participants: string[];
    content_trends: any;
    collaboration_patterns: any;
  };
  metadata: {
    platform: 'notion' | 'slack' | 'discord';
    workspace_id: string;
    content_count: number;
    date_range: { start: string; end: string };
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.7 **Version Control Agent (GitHub, GitLab)**

**Purpose**: Fetch and process repository data and code analysis

**Input**:

- User question
- Repository URL and access token
- Analysis scope (commits, issues, PRs, code)
- Time range and filters
- Conversation context

**Process**:

- Authenticates with Git platform API using access tokens
- Fetches repository metadata, issues, PRs, commits, code structure
- Analyzes code patterns, dependencies, and project metrics
- Processes commit history and contributor activity
- Extracts project insights and development trends
- Handles large repositories with pagination

**Output**:

```typescript
{
  repository_data: {
    metadata: {
      name: string;
      description: string;
      language: string;
      stars: number;
      forks: number;
      last_commit: string;
    };
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      date: string;
      files_changed: number;
    }>;
    issues: Array<{
      number: number;
      title: string;
      state: string;
      labels: string[];
      created_at: string;
    }>;
    pull_requests: Array<{
      number: number;
      title: string;
      state: string;
      author: string;
      created_at: string;
    }>;
  };
  code_analysis: {
    file_structure: any;
    dependencies: string[];
    code_metrics: {
      lines_of_code: number;
      complexity_score: number;
      test_coverage: number;
    };
    contributors: Array<{
      username: string;
      commits: number;
      lines_added: number;
      lines_removed: number;
    }>;
  };
  insights: {
    development_velocity: any;
    popular_files: string[];
    bug_patterns: string[];
    feature_trends: string[];
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.8 **Project Management Agent (Jira, Trello, Asana)**

**Purpose**: Fetch and process project and task management data

**Input**:

- User question
- Project/board identifiers and access tokens
- Time range and status filters
- Team and priority filters
- Conversation context

**Process**:

- Authenticates with project management platform APIs
- Fetches projects, tasks, boards, workflows, and team data
- Analyzes project progress, team productivity, and task distribution
- Processes sprint/iteration data and milestone tracking
- Extracts insights about project health and team performance
- Handles different project management methodologies

**Output**:

```typescript
{
  project_data: {
    projects: Array<{
      id: string;
      name: string;
      status: string;
      team_size: number;
      deadline: string;
      progress_percentage: number;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      assignee: string;
      created_at: string;
      due_date: string;
      story_points?: number;
    }>;
    boards: Array<{
      id: string;
      name: string;
      columns: string[];
      card_count: number;
    }>;
  };
  analytics: {
    team_productivity: {
      tasks_completed: number;
      average_completion_time: number;
      velocity_trend: any;
    };
    project_health: {
      on_time_percentage: number;
      budget_utilization: number;
      risk_factors: string[];
    };
    workload_distribution: Record<string, number>;
  };
  insights: {
    bottlenecks: string[];
    top_performers: string[];
    project_risks: string[];
    improvement_suggestions: string[];
  };
  metadata: {
    platform: 'jira' | 'trello' | 'asana';
    workspace_id: string;
    project_count: number;
    task_count: number;
    date_range: { start: string; end: string };
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

#### 2.9 **Cloud Storage Agent (Dropbox, OneDrive, SharePoint)**

**Purpose**: Fetch and process files and folder structures from cloud storage

**Input**:

- User question
- Storage account identifiers and access tokens
- File/folder filters and search criteria
- Content type filters
- Conversation context

**Process**:

- Authenticates with cloud storage platform APIs
- Fetches file and folder structures with metadata
- Processes document content and file relationships
- Handles different file types and formats
- Extracts file metadata and sharing information
- Generates content summaries and organizational insights

**Output**:

```typescript
{
  file_data: Array<{
    file_id: string;
    name: string;
    path: string;
    file_type: string;
    size: number;
    created_at: string;
    modified_at: string;
    shared_with: string[];
    content_preview?: string;
  }>;
  folder_structure: {
    root_folders: string[];
    folder_hierarchy: any;
    total_files: number;
    total_size: number;
  };
  content_analysis: {
    file_types: Record<string, number>;
    largest_files: Array<{ name: string; size: number }>;
    recently_modified: Array<{ name: string; modified_at: string }>;
    shared_files: Array<{ name: string; shared_with: string[] }>;
  };
  insights: {
    storage_usage: any;
    collaboration_patterns: any;
    file_organization: any;
    access_patterns: any;
  };
  metadata: {
    platform: 'dropbox' | 'onedrive' | 'sharepoint';
    account_id: string;
    total_files: number;
    total_folders: number;
    total_size: number;
  };
  confidence_score: number;
  processing_time_ms: number;
  error_message?: string;
}
```

### 3. **Data Execution Agents**

#### 3.1 **DB Agent (Database Execution)**

**Purpose**: Execute database queries and handle connections (supports both SQL and NoSQL)

**Input**:

- Database query from Query Agent (SQL, MongoDB, DynamoDB, etc.)
- Database connection details
- Query execution parameters
- Database type and driver information

**Process**:

- Establishes secure database connection using appropriate driver
- Executes query using database-specific methods:
  - **SQL**: Uses SQL drivers (pg, mysql2, sqlite3, etc.)
  - **MongoDB**: Uses MongoDB driver with find() or aggregate()
  - **DynamoDB**: Uses AWS SDK with scan/query operations
  - **Cassandra**: Uses Cassandra driver with CQL
- Handles connection errors and timeouts
- Provides detailed error feedback for query improvement
- Implements retry logic (max 3 attempts)
- Normalizes results across different database types

**Output**:

```typescript
{
  query_results: any[];              // Normalized results array
  execution_time_ms: number;
  document_count: number;            // For NoSQL (documents/items)
  row_count: number;                 // For SQL (rows)
  success: boolean;
  error_message?: string;
  error_type?: string;
  database_type: string;             // 'postgresql', 'mongodb', 'dynamodb', etc.
  raw_results?: any;                 // Original database response
}
```

#### 3.2 **Content Processor Agent**

**Purpose**: Process web content, Google Docs, and URLs to extract relevant information

**Input**:

- Raw content from Web Scraper Agent or Google Docs Agent
- User question and context
- Content processing requirements
- Conversation context

**Process**:

- Analyzes content structure and relevance
- Extracts key information based on user question
- Processes different content formats (HTML, JSON, structured documents)
- Handles content summarization and key point extraction
- Identifies tables, lists, and structured data
- Removes noise and irrelevant content
- Structures information for Q&A processing

**Output**:

```typescript
{
  processed_content: string;
  structured_data: {
    key_points: string[];
    tables: Array<{
      headers: string[];
      rows: string[][];
      relevance_score: number;
    }>;
    lists: Array<{
      items: string[];
      relevance_score: number;
    }>;
    metrics: Array<{
      label: string;
      value: string;
      context: string;
    }>;
  };
  metadata: {
    content_type: string;
    word_count: number;
    processing_time_ms: number;
    relevance_score: number;
  };
  confidence_score: number;
  error_message?: string;
}
```

### 4. **OAuth Authentication Flow**

#### 4.1 **OAuth Flow Manager**

**Purpose**: Handle OAuth2 authentication flows for external services

**Input**:

- Platform type (Google, GitHub, Notion, Slack, etc.)
- Required scopes and permissions
- User workspace context
- Redirect URLs and state management

**Process**:

- Initiates OAuth2 authorization flow with appropriate provider
- Manages state and security tokens during authentication
- Handles authorization code exchange for access/refresh tokens
- Stores encrypted tokens securely in database
- Manages token refresh and expiration
- Handles permission scope management

**Output**:

```typescript
{
  auth_status: 'success' | 'failed' | 'requires_user_action';
  tokens: {
    access_token: string;        // Encrypted
    refresh_token: string;       // Encrypted
    expires_at: string;
    scope: string[];
  };
  user_info: {
    platform: string;
    user_id: string;
    email: string;
    name: string;
    permissions_granted: string[];
  };
  connection_id: string;
  error_message?: string;
}
```

#### 4.2 **Token Management System**

**Purpose**: Manage OAuth token lifecycle and security

**Features**:

- **Automatic Token Refresh**: Refreshes tokens before expiration
- **Token Encryption**: Encrypts all tokens at rest using AES-256
- **Scope Management**: Tracks and manages permission scopes
- **Token Rotation**: Periodic token rotation for security
- **Revocation Handling**: Handles token revocation and re-authentication

**Token Lifecycle**:

```typescript
{
  token_lifecycle: {
    creation: {
      timestamp: string;
      expires_in: number;
      scope: string[];
    };
    refresh: {
      last_refresh: string;
      next_refresh: string;
      refresh_count: number;
    };
    expiration: {
      expires_at: string;
      grace_period_hours: 24;
      auto_refresh_enabled: boolean;
    };
    revocation: {
      revoked_at?: string;
      revocation_reason?: string;
      requires_reauth: boolean;
    };
  };
  security: {
    encryption_algorithm: 'AES-256-GCM';
    key_rotation_interval: '90_days';
    audit_logging: boolean;
  };
}
```

### 5. **Enhanced Retry Logic with Infinite Loop Protection**

- Only retries if query execution fails (not for empty results)
- Provides specific error feedback to Query Agent
- **Maximum 3 attempts** with exponential backoff (1s, 2s, 4s delays)
- **Timeout per attempt**: 30 seconds maximum per query execution
- **Circuit breaker pattern**: If 3 consecutive failures, mark source as unavailable for 5 minutes
- **Retry conditions**: Only retry on transient errors (timeout, connection, temporary unavailability)
- **No retry conditions**: Never retry on permanent errors (syntax errors, permission denied, invalid credentials)
- Each retry includes improved error context and learning from previous attempts
- **Global retry budget**: Maximum 10 total retries across all sources per user session per hour

### 4. **Visual Agent**

**Purpose**: Determine if visualization would enhance the response

**Input**:

- Query results data
- User question
- Query intent classification
- Data characteristics (numeric, categorical, temporal)

**Process**:

- Analyzes data structure and patterns
- Considers question type and user intent
- Determines optimal visualization type
- Evaluates if visualization adds value

**Output**:

```typescript
{
  visualization_required: boolean;
  chart_type: "bar" | "line" | "pie" | "scatter" | "heatmap" | "table";
  reasoning: string;
  confidence_score: number;
}
```

### 5. **Graph Agent (Advanced Visualization)**

**Purpose**: Create interactive and advanced visualizations from query results using D3.js and other visualization libraries

**Input**:

- Query results data
- Visualization requirements from Visual Agent
- Chart configuration preferences
- Data source metadata
- User interaction preferences

**Process**:

- Analyzes data structure and patterns for optimal visualization
- Selects appropriate visualization library (D3.js, Chart.js, Plotly, etc.)
- Creates interactive visualizations with:
  - **D3.js**: For custom, complex visualizations (force-directed graphs, treemaps, sankey diagrams)
  - **Chart.js**: For standard charts with animations
  - **Plotly**: For scientific and statistical visualizations
  - **Observable Plot**: For grammar of graphics approach
- Implements interactive features:
  - Zoom, pan, and brush interactions
  - Hover tooltips with detailed information
  - Click events for data exploration
  - Filtering and selection capabilities
  - Animation and transitions
- Generates both static images and interactive HTML/JavaScript
- Stores visualization metadata and configuration

**Output**:

```typescript
{
  visualization_type: 'interactive' | 'static' | 'both';
  chart_data: any;
  chart_config: {
    library: 'd3' | 'chartjs' | 'plotly' | 'observable_plot';
    chart_type: string;
    interactive_features: string[];
    animation_config?: any;
    color_scheme: string;
    responsive: boolean;
  };
  static_image_url: string;           // For API responses and chat
  interactive_url: string;            // For web interface
  html_content?: string;              // Embedded interactive HTML
  javascript_code?: string;           // D3.js or other library code
  metadata: {
    data_points: number;
    dimensions: number;
    complexity_score: number;
    rendering_time_ms: number;
    file_size_kb: number;
  };
  accessibility: {
    alt_text: string;
    screen_reader_description: string;
    color_blind_friendly: boolean;
    keyboard_navigation: boolean;
  };
}
```

## Response Format

### API Response

```typescript
{
  content: string;                    // Natural language answer
  database_query?: {
    query: string;                    // SQL query, MongoDB query, etc.
    query_type: 'sql' | 'mongodb' | 'dynamodb' | 'cassandra' | 'redis';
    query_language: string;           // Human-readable query description
  };
  visualization?: {
    image_url: string;               // URL to stored visualization
    chart_type: string;              // Type of chart created
    chart_data: any;                 // Raw chart data
  };
  metadata: {
    data_source: 'database' | 'files';
    database_id?: string;
    database_type?: string;           // 'postgresql', 'mongodb', 'dynamodb', etc.
    collections_tables_used?: string[];
    execution_time_ms?: number;
    document_count?: number;          // For NoSQL
    row_count?: number;               // For SQL
    confidence_score: number;
    processing_status: string;
  };
  tokens_used: number;
  processing_time_ms: number;
}
```

### Chat UI Response

- **Text Answer**: Natural language response
- **Database Query**: Collapsible code block below message (SQL, MongoDB, etc.)
- **Visualization**: Image displayed above message (like WhatsApp)

## Database Schema Requirements

### Data Source Tables

#### Unified External Connections Table

```sql
CREATE TABLE external_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR NOT NULL,
  connection_type VARCHAR NOT NULL CHECK (connection_type IN (
    'postgresql', 'mysql', 'sqlite', 'bigquery', 'mongodb', 'redis',
    'google-sheets', 'google-docs', 'notion', 'airtable', 'slack',
    'discord', 'github', 'gitlab', 'jira', 'trello', 'asana',
    'sharepoint', 'onedrive', 'dropbox', 'website-url', 'rss-feed', 'api-endpoint'
  )),
  content_type VARCHAR CHECK (content_type IN (
    'database', 'spreadsheet', 'document', 'collaboration',
    'version_control', 'project_management', 'cloud_storage',
    'api', 'website', 'rss'
  )),
  connection_config_encrypted TEXT, -- OAuth tokens, API keys, credentials
  sync_config JSONB, -- Sync frequency, filters, transformations
  last_sync TIMESTAMP,
  content_summary TEXT,
  ai_definitions JSONB, -- Hierarchical AI definitions
  schema_metadata JSONB, -- Structure for non-database sources
  data_sample JSONB, -- Sample data for AI analysis
  connection_status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Legacy Database Connections Table (for backward compatibility)

```sql
CREATE TABLE database_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR NOT NULL,
  database_type VARCHAR NOT NULL, -- 'postgresql', 'mysql', 'sqlite', 'mongodb', 'dynamodb', 'cassandra', 'redis'
  connection_string_encrypted TEXT,
  schema_metadata JSONB, -- Tables/collections, columns/fields, relationships, indexes
  ai_definitions JSONB,  -- AI-generated table/column/field descriptions
  query_capabilities JSONB, -- Supported query types, aggregation functions, etc.
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### OAuth Tokens Table

```sql
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY,
  external_connection_id UUID REFERENCES external_connections(id),
  platform VARCHAR NOT NULL, -- 'google', 'github', 'notion', 'slack', etc.
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMP,
  scope TEXT[], -- Array of granted permissions
  token_type VARCHAR DEFAULT 'Bearer',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Legacy URL Sources Table (for backward compatibility)

```sql
CREATE TABLE url_sources (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR NOT NULL,
  url VARCHAR NOT NULL,
  domain VARCHAR,
  content_type VARCHAR, -- 'html', 'json', 'xml', 'rss', 'text'
  description TEXT,
  last_scraped TIMESTAMP,
  content_summary TEXT,
  ai_definitions JSONB, -- AI-generated content descriptions
  scraping_config JSONB, -- Scraping rules, selectors, authentication
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Legacy Google Docs Sources Table (for backward compatibility)

```sql
CREATE TABLE google_docs_sources (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR NOT NULL,
  doc_id VARCHAR NOT NULL,
  doc_url VARCHAR,
  title VARCHAR,
  description TEXT,
  last_accessed TIMESTAMP,
  content_summary TEXT,
  ai_definitions JSONB, -- AI-generated document descriptions
  sharing_status VARCHAR, -- 'private', 'shared', 'public'
  authors JSONB, -- Array of author emails
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Processing History Tables

#### Query History Table

```sql
CREATE TABLE query_history (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  database_connection_id UUID REFERENCES database_connections(id),
  query TEXT,                        -- SQL query, MongoDB query, etc.
  query_type VARCHAR,                -- 'sql', 'mongodb', 'dynamodb', etc.
  query_results JSONB,
  execution_time_ms INTEGER,
  document_count INTEGER,            -- For NoSQL databases
  row_count INTEGER,                 -- For SQL databases
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Web Content History Table

```sql
CREATE TABLE web_content_history (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  url_source_id UUID REFERENCES url_sources(id),
  extracted_content TEXT,
  content_type VARCHAR,
  processing_time_ms INTEGER,
  content_length INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Google Docs History Table

```sql
CREATE TABLE google_docs_history (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  doc_source_id UUID REFERENCES google_docs_sources(id),
  doc_content TEXT,
  doc_structure JSONB,
  processing_time_ms INTEGER,
  content_length INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Visualizations Table

```sql
CREATE TABLE visualizations (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  query_history_id UUID REFERENCES query_history(id),
  chart_type VARCHAR,
  chart_data JSONB,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Considerations

### 1. **Basic Question Detection Logic**

#### **Query Complexity Classification Algorithm**:

```typescript
function classifyQueryComplexity(
  userQuestion: string,
  databaseSchema: DatabaseSchema
): QueryComplexityAssessment {
  const question = userQuestion.toLowerCase();

  // Basic question patterns
  const basicPatterns = [
    /what tables? (are )?in (this )?database/i,
    /what columns? (are )?in (the )?\w+ table/i,
    /how (are|do) \w+ and \w+ (related|connected)/i,
    /what (data )?types? (are )?used/i,
    /what (indexes?|constraints?) (are )?available/i,
    /how many tables? (are )?in/i,
    /describe (the )?\w+ table/i,
    /what (is|are) the structure/i,
    /show (me )?the schema/i,
  ];

  // Check for basic patterns
  const isBasicQuestion = basicPatterns.some((pattern) =>
    pattern.test(question)
  );

  if (isBasicQuestion) {
    return {
      complexity: "basic",
      requiresQueryGeneration: false,
      canAnswerFromSchema: true,
      estimatedTokens: 50,
      estimatedCredits: 1,
    };
  }

  // Complex question patterns
  const complexPatterns = [
    /show me|find|get|list|count|sum|average|max|min|top \d+/i,
    /where|when|how many|how much|what is the (total|average|maximum|minimum)/i,
    /compare|analyze|trend|pattern|insight/i,
  ];

  const isComplexQuestion = complexPatterns.some((pattern) =>
    pattern.test(question)
  );

  if (isComplexQuestion) {
    return {
      complexity: "complex",
      requiresQueryGeneration: true,
      canAnswerFromSchema: false,
      estimatedTokens: 500,
      estimatedCredits: 10,
    };
  }

  // Default to intermediate
  return {
    complexity: "intermediate",
    requiresQueryGeneration: true,
    canAnswerFromSchema: false,
    estimatedTokens: 200,
    estimatedCredits: 5,
  };
}
```

#### **Schema Answer Agent Implementation**:

```typescript
async function schemaAnswerAgent(
  userQuestion: string,
  databaseSchema: DatabaseSchema,
  aiDefinitions: AIDefinitions
): Promise<SchemaAnswerResponse> {
  const question = userQuestion.toLowerCase();

  // Extract relevant schema information
  const relevantInfo = extractRelevantSchemaInfo(question, databaseSchema);

  // Generate natural language response
  const response = await generateSchemaResponse(
    userQuestion,
    relevantInfo,
    aiDefinitions
  );

  return {
    answer: response,
    schema_info_used: relevantInfo,
    confidence_score: calculateConfidence(relevantInfo),
    reasoning: "Answered from schema metadata without querying data",
    follow_up_suggestions: generateFollowUpSuggestions(
      question,
      databaseSchema
    ),
    requires_data_query: false,
  };
}
```

### 2. **Performance Optimizations**

#### **Schema Caching Strategy**:

```typescript
{
  schema_caching: {
    cache_duration_hours: 24,        // Schema rarely changes
    cache_key: "schema_{database_id}",
    cache_invalidation: {
      triggers: ["schema_update", "table_added", "column_modified"],
      auto_refresh: false,           // Manual refresh on changes
    }
  }
}
```

#### **Response Time Optimization**:

- **Basic Questions**: <500ms response time
- **Schema Caching**: Reduces response time by 80%
- **Minimal Token Usage**: 50-100 tokens vs 500-1000 for complex queries
- **No Database Connection**: Avoids connection overhead

### 3. **Security**

- Encrypt database connection strings
- Use read-only database connections
- Implement query timeout limits
- Sanitize user inputs to prevent SQL injection

### 2. **Performance**

- Cache database schemas
- Implement query result caching
- Use connection pooling
- Optimize SQL query generation

### 3. **Error Handling**

- Graceful degradation for database failures
- Clear error messages for users
- Comprehensive logging for debugging
- Fallback to file-based analysis if database fails

### 4. **Scalability**

- Support multiple database types
- Handle large result sets efficiently
- Implement pagination for large queries
- Use async processing for complex operations

## Integration Points

### 1. **Existing Router Agent Enhancement**

- Add database detection logic
- Route to appropriate agent based on data source
- Maintain backward compatibility with file-based routing

### 2. **Q&A Agent Enhancement**

- Handle both file and database result contexts
- Maintain consistent response format
- Support mixed data source responses

### 3. **Response Handling Enhancement**

- Store SQL queries and visualizations
- Generate appropriate URLs for API responses
- Format responses for chat UI display

## Basic Question Handling Examples

### 1. **Schema Structure Questions**

#### **Example 1: Table Discovery**

**User Question**: "What tables are in this database?"

**Enhanced Router Agent Output**:

```typescript
{
  database_id: "sales_db_123",
  confidence_score: 0.95,
  reasoning: "User is asking about database structure, not data content",
  query_complexity: "basic",
  requires_query_generation: false,
  can_answer_from_schema: true,
  schema_metadata_sufficient: {
    tables_mentioned: ["all"],
    columns_mentioned: [],
    relationships_mentioned: [],
    data_types_available: []
  }
}
```

**Schema Answer Agent Output**:

```typescript
{
  answer: "This database contains 5 tables:\n\n1. **users** - Customer information and profiles\n2. **orders** - Order details and status\n3. **products** - Product catalog and inventory\n4. **order_items** - Individual items within orders\n5. **categories** - Product categorization\n\nEach table is designed to support the e-commerce workflow, with users placing orders that contain multiple products.",
  schema_info_used: {
    tables_described: ["users", "orders", "products", "order_items", "categories"],
    columns_described: [],
    relationships_described: ["users->orders", "orders->order_items", "products->order_items", "products->categories"],
    constraints_mentioned: []
  },
  confidence_score: 0.95,
  reasoning: "Successfully identified all tables from schema metadata",
  follow_up_suggestions: [
    "Would you like to see the columns in any specific table?",
    "Are you interested in the relationships between these tables?",
    "Would you like to analyze data from any of these tables?"
  ],
  requires_data_query: false
}
```

#### **Example 2: Column Information**

**User Question**: "What columns does the users table have?"

**Schema Answer Agent Output**:

```typescript
{
  answer: "The **users** table contains the following columns:\n\n• **id** (INTEGER, PRIMARY KEY) - Unique user identifier\n• **email** (VARCHAR(255), UNIQUE) - User's email address\n• **first_name** (VARCHAR(100)) - User's first name\n• **last_name** (VARCHAR(100)) - User's last name\n• **created_at** (TIMESTAMP) - Account creation date\n• **updated_at** (TIMESTAMP) - Last profile update\n• **status** (ENUM: 'active', 'inactive', 'suspended') - Account status\n• **subscription_tier** (VARCHAR(50)) - User's subscription level\n\nThe table includes proper indexing on email and created_at for performance.",
  schema_info_used: {
    tables_described: ["users"],
    columns_described: ["id", "email", "first_name", "last_name", "created_at", "updated_at", "status", "subscription_tier"],
    relationships_described: [],
    constraints_mentioned: ["PRIMARY KEY", "UNIQUE", "INDEX"]
  },
  confidence_score: 0.98,
  reasoning: "Complete column information available from schema metadata",
  follow_up_suggestions: [
    "Would you like to see sample data from the users table?",
    "Are you interested in the relationship between users and orders?",
    "Would you like to analyze user registration trends?"
  ],
  requires_data_query: false
}
```

#### **Example 3: Relationship Questions**

**User Question**: "How are orders and customers related?"

**Schema Answer Agent Output**:

```typescript
{
  answer: "The **orders** and **users** (customers) tables are related through a **one-to-many** relationship:\n\n• **users.id** (PRIMARY KEY) → **orders.user_id** (FOREIGN KEY)\n• One customer can have multiple orders\n• Each order belongs to exactly one customer\n• The relationship is enforced by a foreign key constraint\n\nAdditionally, orders connect to products through the **order_items** junction table:\n• **orders.id** → **order_items.order_id**\n• **products.id** → **order_items.product_id**\n• This creates a many-to-many relationship between orders and products",
  schema_info_used: {
    tables_described: ["orders", "users", "order_items", "products"],
    columns_described: ["users.id", "orders.user_id", "orders.id", "order_items.order_id", "products.id", "order_items.product_id"],
    relationships_described: ["users->orders", "orders->order_items", "products->order_items"],
    constraints_mentioned: ["FOREIGN KEY", "PRIMARY KEY"]
  },
  confidence_score: 0.92,
  reasoning: "Relationship information clearly defined in schema metadata",
  follow_up_suggestions: [
    "Would you like to see a visual diagram of these relationships?",
    "Are you interested in analyzing order patterns by customer?",
    "Would you like to see the most popular products across all orders?"
  ],
  requires_data_query: false
}
```

### 2. **Database Capability Questions**

#### **Example 4: Data Type Information**

**User Question**: "What data types are used in the products table?"

**Schema Answer Agent Output**:

```typescript
{
  answer: "The **products** table uses the following data types:\n\n• **id** - INTEGER (Primary Key)\n• **name** - VARCHAR(255) (Product name)\n• **description** - TEXT (Detailed product description)\n• **price** - DECIMAL(10,2) (Price with 2 decimal places)\n• **category_id** - INTEGER (Foreign key to categories)\n• **stock_quantity** - INTEGER (Available inventory)\n• **weight** - DECIMAL(8,3) (Product weight in kg)\n• **is_active** - BOOLEAN (Product availability status)\n• **created_at** - TIMESTAMP (Creation date)\n• **updated_at** - TIMESTAMP (Last modification)\n\nThe table uses appropriate data types for e-commerce data, with DECIMAL for precise pricing and TEXT for longer descriptions.",
  schema_info_used: {
    tables_described: ["products"],
    columns_described: ["id", "name", "description", "price", "category_id", "stock_quantity", "weight", "is_active", "created_at", "updated_at"],
    relationships_described: ["products->categories"],
    constraints_mentioned: ["PRIMARY KEY", "FOREIGN KEY"]
  },
  confidence_score: 0.96,
  reasoning: "Complete data type information available from schema",
  follow_up_suggestions: [
    "Would you like to see products with low stock quantities?",
    "Are you interested in price analysis across categories?",
    "Would you like to find the most expensive products?"
  ],
  requires_data_query: false
}
```

### 3. **Complexity Assessment Examples**

#### **Example 5: Basic vs Complex Question Comparison**

**Basic Question**: "What tables are in this database?"

- **Query Complexity**: `basic`
- **Requires Query Generation**: `false`
- **Can Answer From Schema**: `true`
- **Processing Path**: Router → Schema Answer Agent → Direct Response
- **Token Usage**: ~50-100 tokens
- **Response Time**: <1 second

**Complex Question**: "Show me the top 10 customers by total order value in the last 6 months"

- **Query Complexity**: `complex`
- **Requires Query Generation**: `true`
- **Can Answer From Schema**: `false`
- **Processing Path**: Router → Query Agent → DB Agent → Q&A Agent → Response
- **Token Usage**: ~500-1000 tokens
- **Response Time**: 3-10 seconds

### 4. **Credit System Integration for Basic Questions**

#### **Token Usage for Basic Questions**:

```typescript
{
  basic_question_credits: {
    schema_queries: {
      estimated_tokens: 50,        // Minimal token usage
      estimated_credits: 1,        // 1 credit (rounded up from 0.05)
      processing_time_ms: 500,     // Fast response
      cache_eligible: true,        // Can be cached for 24 hours
    }
  }
}
```

#### **Credit Optimization**:

- Basic schema questions use minimal credits (1 credit vs 10-50 for complex queries)
- Responses can be cached to avoid repeated credit charges
- Users get more value from their credit balance
- Encourages exploration of database structure before complex analysis

## NoSQL Database Support Examples

### MongoDB Example

**User Question**: "Show me the top 5 customers by total order value"

**Query Agent Output**:

```typescript
{
  query: `db.orders.aggregate([
    { $group: { _id: "$customer_id", total_value: { $sum: "$amount" } } },
    { $lookup: { from: "customers", localField: "_id", foreignField: "id", as: "customer" } },
    { $unwind: "$customer" },
    { $project: { customer_name: "$customer.name", total_value: 1 } },
    { $sort: { total_value: -1 } },
    { $limit: 5 }
  ])`,
  query_type: 'mongodb',
  reasoning: 'Using aggregation pipeline to group orders by customer, join with customers collection, and sort by total value',
  collections_tables_used: ['orders', 'customers'],
  fields_columns_used: ['customer_id', 'amount', 'name'],
  aggregation_pipeline: [
    { $group: { _id: "$customer_id", total_value: { $sum: "$amount" } } },
    { $lookup: { from: "customers", localField: "_id", foreignField: "id", as: "customer" } },
    { $unwind: "$customer" },
    { $project: { customer_name: "$customer.name", total_value: 1 } },
    { $sort: { total_value: -1 } },
    { $limit: 5 }
  ]
}
```

### DynamoDB Example

**User Question**: "Find all products with price greater than $100"

**Query Agent Output**:

```typescript
{
  query: `{
    TableName: "products",
    FilterExpression: "price > :price",
    ExpressionAttributeValues: {
      ":price": 100
    }
  }`,
  query_type: 'dynamodb',
  reasoning: 'Using scan operation with filter expression to find products above $100',
  collections_tables_used: ['products'],
  fields_columns_used: ['price'],
  filter_criteria: {
    FilterExpression: "price > :price",
    ExpressionAttributeValues: {
      ":price": 100
    }
  }
}
```

### Cassandra Example

**User Question**: "Get all orders for customer ID 12345"

**Query Agent Output**:

```typescript
{
  query: `SELECT * FROM orders WHERE customer_id = ?`,
  query_type: 'cassandra',
  reasoning: 'Using CQL SELECT with WHERE clause for customer-specific orders',
  collections_tables_used: ['orders'],
  fields_columns_used: ['customer_id'],
  filter_criteria: { customer_id: 12345 }
}
```

## Database-Specific Query Generation

### MongoDB Query Patterns

- **Simple Find**: `db.collection.find({field: value})`
- **Aggregation**: Complex aggregation pipelines for analytics
- **Text Search**: Full-text search capabilities
- **Geospatial**: Location-based queries
- **Indexing**: Optimized queries using indexes

### DynamoDB Query Patterns

- **Query**: Primary key and sort key queries
- **Scan**: Table scans with filters
- **Batch Operations**: Batch get/put operations
- **Global Secondary Index**: GSI-based queries
- **Local Secondary Index**: LSI-based queries

### Cassandra Query Patterns

- **Partition Key Queries**: Efficient single-partition queries
- **Clustering Key Queries**: Range queries within partitions
- **Secondary Index**: Queries using secondary indexes
- **Batch Operations**: Batch mutations
- **Materialized Views**: Pre-computed query results

## Query Optimization Strategies

### MongoDB

- Use appropriate indexes for query patterns
- Leverage aggregation pipeline optimization
- Consider compound indexes for multi-field queries
- Use projection to limit returned fields

### DynamoDB

- Design partition keys for even distribution
- Use sort keys for range queries
- Implement Global Secondary Indexes for alternative access patterns
- Consider eventual consistency for better performance

### Cassandra

- Design partition keys for data distribution
- Use clustering keys for sorting and range queries
- Implement materialized views for complex queries
- Consider denormalization for read optimization

## Error Handling for NoSQL

### MongoDB Errors

- Connection timeouts
- Index not found errors
- Aggregation pipeline errors
- Memory limit exceeded

### DynamoDB Errors

- Throttling exceptions
- Conditional check failures
- Item size exceeded
- Provisioned throughput exceeded

### Cassandra Errors

- Unavailable exceptions
- Read/write timeout exceptions
- Invalid query exceptions
- Schema disagreement

## Performance Considerations

### MongoDB

- Connection pooling
- Read preferences (primary, secondary, nearest)
- Write concerns
- Aggregation pipeline optimization

### DynamoDB

- Provisioned vs on-demand capacity
- Batch operations for efficiency
- Consistent vs eventual reads
- Auto-scaling configuration

### Cassandra

- Consistency levels
- Connection pooling
- Prepared statements
- Batch operations

## Web Content and Google Docs Examples

### Web Scraping Example

**User Question**: "What are the latest product prices from this e-commerce site?"

**Web Scraper Agent Output**:

```typescript
{
  extracted_content: "Product A: $29.99, Product B: $49.99, Product C: $19.99...",
  content_type: 'html',
  metadata: {
    title: "E-commerce Store - Products",
    description: "Latest product catalog with prices",
    url: "https://example-store.com/products",
    domain: "example-store.com",
    content_length: 15420
  },
  confidence_score: 0.85,
  processing_time_ms: 2300
}
```

**Content Processor Agent Output**:

```typescript
{
  processed_content: "The store currently offers 15 products with prices ranging from $19.99 to $199.99...",
  structured_data: {
    key_points: [
      "Product A: $29.99 (20% off)",
      "Product B: $49.99 (Best seller)",
      "Product C: $19.99 (New arrival)"
    ],
    tables: [{
      headers: ["Product", "Price", "Discount", "Status"],
      rows: [
        ["Product A", "$29.99", "20% off", "In Stock"],
        ["Product B", "$49.99", "None", "Best Seller"],
        ["Product C", "$19.99", "10% off", "New"]
      ],
      relevance_score: 0.95
    }],
    metrics: [
      { label: "Total Products", value: "15", context: "Available in catalog" },
      { label: "Price Range", value: "$19.99 - $199.99", context: "Lowest to highest price" },
      { label: "Average Price", value: "$67.45", context: "Mean price across all products" }
    ]
  },
  confidence_score: 0.90
}
```

### Google Docs Example

**User Question**: "What are the key findings from the quarterly report?"

**Google Docs Agent Output**:

```typescript
{
  doc_content: "Q3 2024 Quarterly Report - Revenue increased by 15%...",
  doc_structure: {
    title: "Q3 2024 Quarterly Business Report",
    sections: [
      {
        heading: "Executive Summary",
        content: "Revenue increased by 15% compared to Q2 2024...",
        level: 1
      },
      {
        heading: "Financial Performance",
        content: "Total revenue: $2.5M, Net profit: $450K...",
        level: 2
      }
    ],
    tables: [{
      headers: ["Metric", "Q2 2024", "Q3 2024", "Change"],
      rows: [
        ["Revenue", "$2.17M", "$2.5M", "+15%"],
        ["Profit", "$380K", "$450K", "+18%"],
        ["Customers", "1,250", "1,450", "+16%"]
      ]
    }]
  },
  metadata: {
    doc_id: "1ABC123def456GHI789jkl",
    title: "Q3 2024 Quarterly Business Report",
    last_modified: "2024-10-15T10:30:00Z",
    authors: ["john.doe@company.com", "jane.smith@company.com"],
    sharing_status: "shared"
  },
  confidence_score: 0.92
}
```

**Content Processor Agent Output**:

```typescript
{
  processed_content: "The Q3 2024 report shows strong growth with revenue up 15% and profit up 18%...",
  structured_data: {
    key_points: [
      "Revenue increased by 15% to $2.5M",
      "Net profit grew 18% to $450K",
      "Customer base expanded by 16% to 1,450",
      "All key metrics showing positive growth"
    ],
    metrics: [
      { label: "Revenue Growth", value: "15%", context: "Q2 to Q3 2024" },
      { label: "Profit Growth", value: "18%", context: "Q2 to Q3 2024" },
      { label: "Customer Growth", value: "16%", context: "Q2 to Q3 2024" }
    ]
  },
  confidence_score: 0.88
}
```

## Mixed Data Source Queries

### Example: Combining Database and Web Data

**User Question**: "Compare our internal sales data with competitor pricing from their website"

**Enhanced Router Agent Output**:

```typescript
{
  data_sources: [
    {
      type: "database",
      source_id: "sales_db_123",
      confidence_score: 0.95,
      reasoning: "Internal sales data needed for comparison",
    },
    {
      type: "url",
      source_id: "competitor_site_456",
      confidence_score: 0.85,
      reasoning: "Competitor pricing information required",
    },
  ];
}
```

**Processing Flow**:

1. **Data Source Filter Agent** → Filters 50+ sources to top 8 candidates
2. **Data Source Ranking Agent** → Ranks sources and selects database + URL as optimal combination
3. **Database Execution Coordinator** → **Query Agent** → **DB Agent** (gets internal sales data)
4. **External API Execution Coordinator** → **Web Scraper Agent** → **Content Processor Agent** (gets competitor pricing)
5. **Multi-Source Q&A Agent** combines both data sources for comprehensive comparison

### Example: Cross-Platform Project Analysis

**User Question**: "Analyze our project progress across Jira, GitHub, and Slack"

**Enhanced Router Agent Output**:

```typescript
{
  data_sources: [
    {
      type: "project_management",
      source_id: "jira_project_123",
      platform: "jira",
      confidence_score: 0.9,
      reasoning: "Project management data needed for task analysis",
    },
    {
      type: "version_control",
      source_id: "github_repo_456",
      platform: "github",
      confidence_score: 0.85,
      reasoning: "Code development progress required",
    },
    {
      type: "collaboration",
      source_id: "slack_workspace_789",
      platform: "slack",
      confidence_score: 0.8,
      reasoning: "Team communication and coordination data needed",
    },
  ];
}
```

**Processing Flow**:

1. **Data Source Filter Agent** → Filters 30+ sources to top 6 candidates (Jira, GitHub, Slack, etc.)
2. **Data Source Ranking Agent** → Ranks sources and selects Jira + GitHub + Slack as optimal combination
3. **External API Execution Coordinator** → **Project Management Agent** → **API Execution Agent** (gets Jira data)
4. **External API Execution Coordinator** → **Version Control Agent** → **API Execution Agent** (gets GitHub data)
5. **External API Execution Coordinator** → **Collaboration Agent** → **API Execution Agent** (gets Slack data)
6. **Multi-Source Q&A Agent** combines all data sources for holistic project analysis

**Multi-Source Q&A Agent Output**:

```typescript
{
  content: "Based on analysis across Jira, GitHub, and Slack, here's your project status:\n\n**Development Progress**: 15 tasks completed this sprint (75% of planned)\n**Code Activity**: 23 commits with 5 pull requests merged\n**Team Communication**: 45 messages in project channels, 3 blockers discussed\n\n**Key Insights**:\n- Development velocity is 15% above target\n- Most active communication happens in #frontend channel\n- Code review process is taking longer than expected\n\n**Recommendations**:\n- Consider increasing code review capacity\n- Frontend team may need additional support\n- Overall project is on track for delivery",
  source_attributions: [
    {
      source_type: "project_management",
      source_id: "jira_project_123",
      contribution: "Task completion data and sprint progress",
      confidence_score: 0.9,
    },
    {
      source_type: "version_control",
      source_id: "github_repo_456",
      contribution: "Code development metrics and commit activity",
      confidence_score: 0.85,
    },
    {
      source_type: "collaboration",
      source_id: "slack_workspace_789",
      contribution: "Team communication patterns and blockers",
      confidence_score: 0.8,
    },
  ],
  data_synthesis: {
    primary_insights: [
      "Development velocity increased 15% this sprint",
      "Most active communication happens in #frontend channel",
      "Code review process is taking longer than expected"
    ],
    supporting_evidence: [
      "Jira shows 15/20 tasks completed",
      "GitHub shows 23 commits and 5 merged PRs",
      "Slack shows 45 messages with 3 blocker discussions"
    ],
    conflicting_information: [],
    gaps_identified: [
      "No direct correlation between Slack activity and task completion",
      "GitHub activity doesn't reflect all development work"
    ]
  },
  metadata: {
    data_source: "multi_source",
    sources_processed: 3,
    processing_strategy: "holistic",
    confidence_score: 0.85,
  }
}
```

### Example: Spreadsheet and Database Integration

**User Question**: "Compare our Google Sheets budget data with our PostgreSQL financial database"

**Enhanced Router Agent Output**:

```typescript
{
  data_sources: [
    {
      type: "spreadsheet",
      source_id: "google_sheets_budget_123",
      platform: "google-sheets",
      confidence_score: 0.9,
      reasoning: "Budget planning data in Google Sheets",
    },
    {
      type: "database",
      source_id: "postgresql_finance_456",
      platform: "postgresql",
      confidence_score: 0.95,
      reasoning: "Actual financial transactions in database",
    },
  ];
}
```

**Processing Flow**:

1. **Data Source Filter Agent** → Filters 25+ sources to top 5 candidates (Google Sheets, PostgreSQL, etc.)
2. **Data Source Ranking Agent** → Ranks sources and selects Google Sheets + PostgreSQL as optimal combination
3. **File Processing Coordinator** → **Spreadsheet Agent** → **API Execution Agent** (gets Google Sheets data)
4. **Database Execution Coordinator** → **Query Agent** → **DB Agent** (gets PostgreSQL data)
5. **Multi-Source Q&A Agent** compares budget vs actual spending

**Multi-Source Q&A Agent Output**:

```typescript
{
  content: "Budget vs Actual Analysis:\n\n**Budget Overview (Google Sheets)**:\n- Total Budget: $50,000\n- Marketing: $15,000\n- Development: $25,000\n- Operations: $10,000\n\n**Actual Spending (Database)**:\n- Total Spent: $47,500\n- Marketing: $14,200 (5% under budget)\n- Development: $26,800 (7% over budget)\n- Operations: $6,500 (35% under budget)\n\n**Key Findings**:\n- Overall spending is 5% under budget\n- Development exceeded budget by $1,800\n- Operations significantly under-spent by $3,500\n\n**Recommendations**:\n- Investigate development overage\n- Consider reallocating operations budget\n- Overall financial health is positive",
  source_attributions: [
    {
      source_type: "spreadsheet",
      source_id: "google_sheets_budget_123",
      contribution: "Planned budget allocations and targets",
      confidence_score: 0.9,
    },
    {
      source_type: "database",
      source_id: "postgresql_finance_456",
      contribution: "Actual transaction data and spending records",
      confidence_score: 0.95,
    },
  ],
  data_synthesis: {
    primary_insights: [
      "Overall spending is 5% under budget",
      "Development exceeded budget by $1,800",
      "Operations significantly under-spent by $3,500"
    ],
    supporting_evidence: [
      "Google Sheets shows $50,000 total budget",
      "Database shows $47,500 total spent",
      "Development category shows $26,800 vs $25,000 budget"
    ],
    conflicting_information: [],
    gaps_identified: [
      "No breakdown of development overage by subcategory",
      "Operations under-spending reason not clear"
    ]
  },
  metadata: {
    data_source: "multi_source",
    sources_processed: 2,
    processing_strategy: "comparative",
    confidence_score: 0.92,
  }
}
```

## Advanced Web Content Processing

### Dynamic Content Handling

- **JavaScript Rendering**: Uses Puppeteer/Playwright for SPAs
- **Authentication**: Handles login forms and session management
- **Rate Limiting**: Respects robots.txt and implements delays
- **Content Updates**: Tracks content changes and re-scrapes when needed

### Content Type Support

- **HTML**: Extracts text, tables, lists, and structured data
- **JSON APIs**: Processes REST API responses and GraphQL queries
- **XML/RSS**: Parses feeds and structured XML documents
- **PDFs**: Extracts text and tables from PDF documents
- **Images**: OCR processing for text extraction from images

### Google Docs Integration

- **Real-time Collaboration**: Handles live document updates
- **Permission Management**: Respects sharing settings and access controls
- **Format Preservation**: Maintains document structure and formatting
- **Comment Processing**: Includes comments and suggestions in analysis

## Performance Optimizations

### Web Scraping

- **Caching**: Stores scraped content with TTL
- **Parallel Processing**: Multiple URLs scraped simultaneously
- **Smart Retries**: Exponential backoff for failed requests
- **Content Diffing**: Only processes changed content

### Google Docs

- **Incremental Updates**: Only fetches changed sections
- **Batch Operations**: Processes multiple documents together
- **Connection Pooling**: Reuses API connections
- **Rate Limit Management**: Respects Google API quotas

## Security Considerations

### Web Scraping

- **User-Agent Rotation**: Prevents blocking
- **Proxy Support**: Routes through different IPs
- **Content Validation**: Sanitizes scraped content
- **Legal Compliance**: Respects terms of service

### Google Docs

- **OAuth2 Security**: Secure authentication flow
- **Permission Validation**: Checks document access rights
- **Data Encryption**: Encrypts sensitive document content
- **Audit Logging**: Tracks document access and modifications

## Router Agent Decision Handling

### 1. **When Router Agent Cannot Decide (Low Confidence)**

#### **Scenario**: All data sources have confidence scores below 0.5

**Enhanced Router Agent Response**:

```typescript
{
  decision_status: 'uncertain',
  confidence_score: 0.3,
  reasoning: 'Unable to determine the most relevant data source for this question',
  available_sources: [
    {
      source_type: 'database',
      source_id: 'sales_db',
      confidence_score: 0.4,
      reasoning: 'Contains sales data but unclear if it matches the question'
    },
    {
      source_type: 'file',
      source_id: 'report_pdf',
      confidence_score: 0.3,
      reasoning: 'Might contain relevant information but needs clarification'
    }
  ],
  clarification_questions: [
    'Are you looking for sales data from our database?',
    'Do you want information from the quarterly report PDF?',
    'Could you be more specific about what data you need?'
  ],
  fallback_strategy: 'ask_clarification'
}
```

**System Response**:

```typescript
{
  content: "I found a few potential data sources that might help answer your question, but I need some clarification to give you the best answer. Are you looking for:\n\n1. Sales data from our database\n2. Information from the quarterly report PDF\n3. Something else?\n\nCould you be more specific about what data you need?",
  metadata: {
    processing_status: 'requires_clarification',
    data_source: 'multiple',
    confidence_score: 0.3,
    clarification_required: true
  }
}
```

### 2. **When Router Agent Identifies Multiple Relevant Sources**

#### **Scenario A**: Multiple sources with high confidence (>0.7)

**Enhanced Router Agent Response**:

```typescript
{
  decision_status: 'multiple_high_confidence',
  primary_source: {
    source_type: 'database',
    source_id: 'sales_db',
    confidence_score: 0.9,
    reasoning: 'Contains the most relevant sales data for this question'
  },
  secondary_sources: [
    {
      source_type: 'file',
      source_id: 'sales_report_pdf',
      confidence_score: 0.8,
      reasoning: 'Contains additional sales insights and analysis'
    },
    {
      source_type: 'url',
      source_id: 'competitor_analysis',
      confidence_score: 0.75,
      reasoning: 'Provides market context and competitor data'
    }
  ],
  processing_strategy: 'multi_source_analysis',
  source_combination_approach: 'complementary'
}
```

**System Processing Flow**:

1. **Primary Source Processing**: Process the highest confidence source first
2. **Secondary Source Processing**: Process additional sources in parallel
3. **Multi-Source Q&A Agent**: Combines insights from all sources
4. **Comprehensive Response**: Provides unified answer with source attribution

#### **Scenario B**: Mixed source types with similar confidence

**Enhanced Router Agent Response**:

```typescript
{
  decision_status: 'mixed_sources',
  source_ranking: [
    {
      source_type: 'database',
      source_id: 'customer_db',
      confidence_score: 0.8,
      reasoning: 'Contains customer data and purchase history'
    },
    {
      source_type: 'google_docs',
      source_id: 'customer_feedback_doc',
      confidence_score: 0.75,
      reasoning: 'Contains qualitative customer feedback'
    },
    {
      source_type: 'url',
      source_id: 'market_research_site',
      confidence_score: 0.7,
      reasoning: 'Provides market trends and customer behavior insights'
    }
  ],
  processing_strategy: 'multi_source_analysis',
  source_combination_approach: 'holistic'
}
```

### 3. **Multi-Source Processing Strategies**

#### **Strategy 1: Complementary Analysis**

- **Use Case**: Sources provide different aspects of the same topic
- **Example**: Database (quantitative data) + PDF (qualitative analysis)
- **Processing**: Combine data for comprehensive insights

#### **Strategy 2: Comparative Analysis**

- **Use Case**: Sources provide different perspectives on the same topic
- **Example**: Internal data + Competitor website data
- **Processing**: Compare and contrast findings

#### **Strategy 3: Holistic Analysis**

- **Use Case**: Sources provide different types of information
- **Example**: Database (facts) + Google Docs (context) + Website (trends)
- **Processing**: Synthesize into unified narrative

#### **Strategy 4: Validation Analysis**

- **Use Case**: Sources provide similar information for verification
- **Example**: Multiple databases with overlapping data
- **Processing**: Cross-validate and identify discrepancies

### 4. **Multi-Source Q&A Agent Enhancement**

**Enhanced Q&A Agent for Multi-Source Processing**:

```typescript
{
  content: string;                    // Unified response combining all sources
  source_attributions: Array<{
    source_type: 'database' | 'file' | 'url' | 'google_docs';
    source_id: string;
    contribution: string;             // What this source contributed
    confidence_score: number;
  }>;
  data_synthesis: {
    primary_insights: string[];       // Key findings from primary source
    supporting_evidence: string[];    // Supporting data from other sources
    conflicting_information?: string[]; // Any contradictions found
    gaps_identified?: string[];       // Information gaps across sources
  };
  metadata: {
    data_source: 'multi_source';
    sources_processed: number;
    processing_strategy: 'complementary' | 'comparative' | 'holistic' | 'validation';
    confidence_score: number;
  };
}
```

### 5. **Decision Thresholds and Fallback Strategies**

#### **Confidence Thresholds**:

- **High Confidence (>0.8)**: Process immediately with primary source
- **Medium Confidence (0.5-0.8)**: Process with primary source, mention alternatives
- **Low Confidence (<0.5)**: Ask for clarification or use fallback strategy

#### **Fallback Strategies**:

1. **Ask Clarification**:

   ```typescript
   {
     strategy: 'ask_clarification',
     questions: string[];
     suggested_sources: string[];
   }
   ```

2. **Process All Relevant Sources**:

   ```typescript
   {
     strategy: 'process_all',
     sources: Array<{source_id: string, confidence_score: number}>;
     approach: 'comprehensive_analysis';
   }
   ```

3. **Use Most Recent Source**:

   ```typescript
   {
     strategy: 'most_recent',
     criteria: 'last_updated' | 'last_accessed';
   }
   ```

4. **Use Most Comprehensive Source**:
   ```typescript
   {
     strategy: 'most_comprehensive',
     criteria: 'data_volume' | 'schema_completeness';
   }
   ```

### 6. **Error Handling for Multi-Source Scenarios**

#### **Partial Source Failure**:

```typescript
{
  processing_status: 'partial_success',
  successful_sources: Array<{
    source_id: string;
    source_type: string;
    data_retrieved: boolean;
  }>;
  failed_sources: Array<{
    source_id: string;
    source_type: string;
    error_message: string;
    retry_attempted: boolean;
  }>;
  response_strategy: 'continue_with_available' | 'request_retry' | 'fallback_to_alternatives';
}
```

#### **Source Conflict Resolution**:

```typescript
{
  conflict_detected: boolean;
  conflicting_sources: Array<{
    source_id: string;
    conflicting_data: any;
    confidence_score: number;
  }>;
  resolution_strategy: "present_both" | "use_highest_confidence" | "ask_user";
  resolution_reasoning: string;
}
```

### 7. **User Experience Enhancements**

#### **Progressive Disclosure**:

- Show primary source results first
- Allow user to request additional sources
- Provide source comparison on demand

#### **Source Transparency**:

- Always show which sources were used
- Provide confidence scores for each source
- Explain why certain sources were chosen

#### **Interactive Source Selection**:

- Allow users to specify preferred sources
- Provide source previews before processing
- Enable source exclusion/inclusion

## Advanced Visualization Examples

### D3.js Interactive Visualizations

#### **Force-Directed Graph Example**

```typescript
// User Question: "Show me the relationships between customers and products"
{
  visualization_type: 'interactive',
  chart_config: {
    library: 'd3',
    chart_type: 'force_directed_graph',
    interactive_features: ['zoom', 'pan', 'node_drag', 'hover_tooltips', 'click_expand'],
    animation_config: {
      duration: 1000,
      easing: 'ease-in-out',
      node_repulsion: 300,
      link_distance: 100
    }
  },
  html_content: '<div id="force-graph"></div>',
  javascript_code: `
    // D3.js force-directed graph implementation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));
  `,
  accessibility: {
    alt_text: "Interactive network graph showing customer-product relationships",
    screen_reader_description: "Force-directed graph with 150 nodes and 300 links",
    color_blind_friendly: true,
    keyboard_navigation: true
  }
}
```

#### **Sankey Diagram Example**

```typescript
// User Question: "Show me the flow of revenue through different channels"
{
  visualization_type: 'interactive',
  chart_config: {
    library: 'd3',
    chart_type: 'sankey_diagram',
    interactive_features: ['hover_highlight', 'click_filter', 'zoom', 'tooltips'],
    color_scheme: 'category10'
  },
  interactive_features: [
    'Hover over flows to see exact values',
    'Click nodes to filter connected flows',
    'Zoom and pan for detailed exploration'
  ]
}
```

#### **Treemap Example**

```typescript
// User Question: "Show me the hierarchical breakdown of sales by region and product"
{
  visualization_type: 'interactive',
  chart_config: {
    library: 'd3',
    chart_type: 'treemap',
    interactive_features: ['click_drill_down', 'hover_details', 'breadcrumb_navigation'],
    responsive: true
  }
}
```

### Chart.js Standard Visualizations

#### **Animated Bar Chart**

```typescript
{
  visualization_type: 'interactive',
  chart_config: {
    library: 'chartjs',
    chart_type: 'bar',
    interactive_features: ['hover_animation', 'click_legend', 'responsive_resize'],
    animation_config: {
      duration: 2000,
      easing: 'easeOutBounce'
    }
  }
}
```

### Plotly Scientific Visualizations

#### **3D Scatter Plot**

```typescript
{
  visualization_type: 'interactive',
  chart_config: {
    library: 'plotly',
    chart_type: '3d_scatter',
    interactive_features: ['3d_rotation', 'zoom', 'pan', 'hover_3d', 'color_scale'],
    responsive: true
  }
}
```

## Additional Edge Cases and Flow Enhancements

### 1. **Data Quality and Validation Edge Cases**

#### **Scenario**: Incomplete or corrupted data

```typescript
{
  data_quality_issues: {
    missing_values: number;
    corrupted_records: number;
    data_type_mismatches: number;
    outliers_detected: number;
  }
  validation_strategy: "clean_and_proceed" | "ask_user" | "use_partial_data";
  data_cleaning_applied: {
    missing_value_handling: "interpolate" | "exclude" | "default_value";
    outlier_handling: "keep" | "remove" | "flag";
    data_type_corrections: Array<{
      field: string;
      original_type: string;
      corrected_type: string;
    }>;
  }
}
```

#### **Scenario**: Data too large for processing

```typescript
{
  data_size_handling: {
    total_records: number;
    max_processable_records: number;
    sampling_strategy: "random" | "stratified" | "time_based" | "top_n";
    sample_size: number;
    sampling_reasoning: string;
  }
}
```

### 2. **Authentication and Permission Edge Cases**

#### **Scenario**: Expired or invalid credentials

```typescript
{
  authentication_status: "valid" |
    "expired" |
    "invalid" |
    "insufficient_permissions";
  retry_strategy: "refresh_token" |
    "re_authenticate" |
    "use_cached_data" |
    "fallback_source";
  permission_issues: Array<{
    resource: string;
    required_permission: string;
    current_permission: string;
    suggested_action: string;
  }>;
}
```

#### **Scenario**: Rate limiting and API quotas

```typescript
{
  rate_limit_status: {
    requests_remaining: number;
    reset_time: string;
    quota_exceeded: boolean;
  }
  fallback_strategy: "wait_and_retry" |
    "use_cached_data" |
    "reduce_scope" |
    "alternative_source";
}
```

### 3. **Network and Connectivity Edge Cases**

#### **Scenario**: Network timeouts and connection failures

```typescript
{
  connectivity_issues: {
    timeout_occurred: boolean;
    connection_failed: boolean;
    dns_resolution_failed: boolean;
    ssl_certificate_issues: boolean;
  }
  retry_config: {
    max_retries: number;              // Maximum 3 attempts
    retry_delay_ms: number;           // Base delay (1000ms)
    exponential_backoff: boolean;     // true - delays: 1s, 2s, 4s
    max_total_retry_time_ms: number;  // 30 seconds total timeout
    circuit_breaker_threshold: number; // 3 consecutive failures
    circuit_breaker_duration_ms: number; // 5 minutes cooldown
    retry_conditions: string[];       // ['timeout', 'connection_failed', 'temporary_unavailable']
    no_retry_conditions: string[];    // ['syntax_error', 'permission_denied', 'invalid_credentials']
    global_retry_budget: number;      // 10 retries per user per hour
  }
  fallback_sources: Array<{
    source_id: string;
    source_type: string;
    confidence_score: number;
  }>;
}
```

### 4. **Content Processing Edge Cases**

#### **Scenario**: Unsupported file formats or content types

```typescript
{
  content_processing_issues: {
    unsupported_format: boolean;
    corrupted_content: boolean;
    encoding_issues: boolean;
    password_protected: boolean;
  }
  conversion_attempts: Array<{
    format: string;
    success: boolean;
    error_message?: string;
  }>;
  fallback_content: string; // Simplified or alternative content
}
```

#### **Scenario**: Dynamic content that changes during processing

```typescript
{
  content_stability: {
    content_changed_during_processing: boolean;
    change_detected_at: string;
    change_type: "minor" | "major" | "structural";
    reprocessing_required: boolean;
  }
  version_control: {
    content_version: string;
    processing_timestamp: string;
    content_hash: string;
  }
}
```

### 5. **Visualization Edge Cases**

#### **Scenario**: Data unsuitable for visualization

```typescript
{
  visualization_suitability: {
    data_points: number;
    dimensions: number;
    data_types: string[];
    visualization_recommended: boolean;
    alternative_suggestions: string[];
  };
  fallback_visualization: {
    chart_type: 'table' | 'text_summary' | 'simple_chart';
    reasoning: string;
  };
}
```

#### **Scenario**: Browser compatibility issues

```typescript
{
  browser_compatibility: {
    d3_supported: boolean;
    webgl_supported: boolean;
    canvas_supported: boolean;
    svg_supported: boolean;
  }
  fallback_visualization: {
    library: "chartjs" | "static_image" | "table";
    reasoning: string;
  }
}
```

### 6. **Performance and Scalability Edge Cases**

#### **Scenario**: Processing time exceeds limits

```typescript
{
  performance_issues: {
    processing_time_ms: number;
    max_allowed_time_ms: number;
    timeout_occurred: boolean;
    memory_usage_mb: number;
    max_memory_mb: number;
  }
  optimization_strategies: {
    data_sampling: boolean;
    parallel_processing: boolean;
    caching_enabled: boolean;
    incremental_processing: boolean;
  }
}
```

#### **Scenario**: Concurrent request handling

```typescript
{
  concurrency_management: {
    active_requests: number;
    max_concurrent_requests: number;
    queue_position: number;
    estimated_wait_time_ms: number;
  }
  request_prioritization: {
    priority_score: number;
    user_tier: "free" | "premium" | "enterprise";
    request_type: "standard" | "priority" | "urgent";
  }
}
```

### 7. **Enhanced Error Recovery and Fallback Strategies**

#### **Cascading Fallback System**

```typescript
{
  fallback_cascade: [
    {
      level: 1,
      strategy: "retry_with_backoff",
      max_attempts: 3,
      max_total_time_ms: 30000, // 30 seconds total
      conditions: ["network_error", "timeout"],
      infinite_loop_protection: {
        max_retries_per_source: 3,
        cooldown_period_ms: 300000, // 5 minutes
        global_retry_budget: 10, // per user per hour
        retry_conditions: ["transient_errors_only"],
      },
    },
    {
      level: 2,
      strategy: "use_cached_data",
      max_age_hours: 24,
      conditions: ["source_unavailable", "authentication_failed"],
      infinite_loop_protection: {
        cache_validation_required: true,
        max_cache_attempts: 1,
        fallback_on_cache_failure: true,
      },
    },
    {
      level: 3,
      strategy: "alternative_source",
      max_alternative_sources: 3, // Prevent trying infinite sources
      conditions: ["primary_source_failed", "data_corrupted"],
      infinite_loop_protection: {
        source_blacklist: true, // Don't retry failed sources
        max_source_attempts: 1,
        timeout_per_source_ms: 15000, // 15 seconds per alternative
      },
    },
    {
      level: 4,
      strategy: "simplified_processing",
      max_simplification_attempts: 2, // Prevent infinite simplification
      conditions: ["complexity_too_high", "performance_issues"],
      infinite_loop_protection: {
        complexity_reduction_limit: 0.5, // Max 50% data reduction
        processing_time_limit_ms: 10000, // 10 seconds max
        fallback_on_timeout: true,
      },
    },
    {
      level: 5,
      strategy: "ask_user_for_guidance",
      conditions: ["all_automatic_strategies_failed"],
      infinite_loop_protection: {
        max_user_prompts: 1, // Only ask once
        timeout_for_user_response_ms: 300000, // 5 minutes
        fallback_response:
          "Unable to process request with available data sources",
      },
    },
  ];
}
```

### 8. **Enhanced Monitoring and Observability**

#### **Comprehensive Metrics Collection**

```typescript
{
  system_metrics: {
    processing_time_ms: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    network_bandwidth_mb: number;
    error_rate_percent: number;
  }
  user_metrics: {
    satisfaction_score: number;
    response_accuracy: number;
    visualization_quality: number;
    interaction_engagement: number;
  }
  business_metrics: {
    requests_per_minute: number;
    successful_completions: number;
    user_retention_rate: number;
    feature_usage_stats: Record<string, number>;
  }
}
```

### 9. **Advanced Caching and Optimization**

#### **Intelligent Caching Strategy**

```typescript
{
  caching_strategy: {
    data_cache: {
      ttl_seconds: number;
      max_size_mb: number;
      eviction_policy: "lru" | "lfu" | "ttl";
    }
    visualization_cache: {
      ttl_seconds: number;
      max_visualizations: number;
      compression_enabled: boolean;
    }
    query_cache: {
      ttl_seconds: number;
      max_queries: number;
      parameter_normalization: boolean;
    }
  }
  cache_hit_rates: {
    data_cache: number;
    visualization_cache: number;
    query_cache: number;
  }
}
```

### 10. **Enhanced User Experience Features**

#### **Progressive Loading and Streaming**

```typescript
{
  progressive_loading: {
    enabled: boolean;
    stages: [
      'initial_response',
      'data_processing',
      'visualization_generation',
      'interactive_features'
    ];
    streaming_updates: boolean;
    user_notifications: boolean;
  };
  real_time_updates: {
    data_refresh_interval_ms: number;
    visualization_updates: boolean;
    live_data_sources: string[];
  };
}
```

## Infinite Loop Protection and Safety Mechanisms

### 1. **Global Retry Budget System**

```typescript
{
  global_retry_limits: {
    max_retries_per_user_per_hour: 10;
    max_retries_per_source_per_hour: 5;
    max_concurrent_retries: 3;
    retry_budget_reset_interval_ms: 3600000; // 1 hour
  }
  retry_tracking: {
    user_id: string;
    current_hour_retries: number;
    source_retry_counts: Record<string, number>;
    last_retry_timestamp: string;
    retry_budget_remaining: number;
  }
}
```

### 2. **Circuit Breaker Pattern Implementation**

```typescript
{
  circuit_breaker: {
    failure_threshold: 3; // 3 consecutive failures
    recovery_timeout_ms: 300000; // 5 minutes
    half_open_max_calls: 1; // Test with 1 call when half-open
    state: "closed" | "open" | "half_open";
    failure_count: number;
    last_failure_time: string;
    next_attempt_time: string;
  }
  source_health_status: {
    source_id: string;
    is_healthy: boolean;
    consecutive_failures: number;
    last_success_time: string;
    circuit_breaker_state: string;
  }
}
```

### 3. **Timeout and Deadline Management**

```typescript
{
  timeout_management: {
    global_request_timeout_ms: 120000;     // 2 minutes total
    per_operation_timeout_ms: 30000;       // 30 seconds per operation
    retry_timeout_ms: 10000;               // 10 seconds per retry
    visualization_timeout_ms: 60000;       // 1 minute for visualization
    user_interaction_timeout_ms: 300000;   // 5 minutes for user response
  };
  deadline_tracking: {
    request_start_time: string;
    deadline: string;
    time_remaining_ms: number;
    operations_completed: string[];
    operations_pending: string[];
  };
}
```

### 4. **Retry Condition Classification**

```typescript
{
  retry_conditions: {
    transient_errors: [
      "network_timeout",
      "connection_refused",
      "temporary_unavailable",
      "rate_limit_exceeded",
      "server_overloaded",
    ];
    permanent_errors: [
      "syntax_error",
      "permission_denied",
      "invalid_credentials",
      "resource_not_found",
      "malformed_request",
    ];
    never_retry_errors: [
      "authentication_failed",
      "authorization_denied",
      "invalid_query_syntax",
      "data_corruption",
      "unsupported_operation",
    ];
  }
  error_classification: {
    error_code: string;
    error_type: "transient" | "permanent" | "never_retry";
    retry_allowed: boolean;
    max_retry_attempts: number;
    retry_delay_ms: number;
  }
}
```

### 5. **Exponential Backoff with Jitter**

```typescript
{
  backoff_strategy: {
    base_delay_ms: 1000;               // 1 second
    max_delay_ms: 30000;               // 30 seconds max
    exponential_multiplier: 2;         // Double each time
    jitter_range: 0.1;                 // ±10% randomization
    max_retry_attempts: 3;
    calculated_delays: [1000, 2000, 4000]; // Actual delays with jitter
  };
  retry_schedule: {
    attempt_1: { delay_ms: 1000, timestamp: string };
    attempt_2: { delay_ms: 2000, timestamp: string };
    attempt_3: { delay_ms: 4000, timestamp: string };
    total_retry_time_ms: 7000;
  };
}
```

### 6. **Source Blacklisting and Health Monitoring**

```typescript
{
  source_blacklist: {
    blacklisted_sources: Array<{
      source_id: string;
      blacklist_reason: string;
      blacklist_timestamp: string;
      blacklist_duration_ms: number;
      retry_after_timestamp: string;
    }>;
    health_check_interval_ms: 300000; // 5 minutes
    auto_remove_after_ms: 1800000; // 30 minutes
  }
  health_monitoring: {
    source_id: string;
    health_score: number; // 0-100
    response_time_avg_ms: number;
    success_rate_percent: number;
    last_health_check: string;
    recommended_action: "healthy" | "degraded" | "unhealthy" | "blacklist";
  }
}
```

### 7. **Request Deduplication and Idempotency**

```typescript
{
  request_deduplication: {
    request_hash: string; // Hash of request parameters
    duplicate_detection_window_ms: 60000; // 1 minute
    cached_response_ttl_ms: 300000; // 5 minutes
    idempotency_key: string;
  }
  duplicate_prevention: {
    identical_requests_in_window: number;
    use_cached_response: boolean;
    cache_hit: boolean;
    cache_timestamp: string;
  }
}
```

### 8. **Resource Exhaustion Protection**

```typescript
{
  resource_limits: {
    max_memory_usage_mb: 512; // 512MB per request
    max_cpu_time_ms: 30000; // 30 seconds CPU time
    max_network_bandwidth_mb: 100; // 100MB network usage
    max_file_size_mb: 50; // 50MB file processing
    max_concurrent_operations: 5; // 5 concurrent operations
  }
  resource_monitoring: {
    current_memory_usage_mb: number;
    current_cpu_time_ms: number;
    current_network_usage_mb: number;
    resource_exhaustion_risk: "low" | "medium" | "high" | "critical";
    recommended_action: string;
  }
}
```

### 9. **Cascading Failure Prevention**

```typescript
{
  cascade_prevention: {
    max_fallback_levels: 5;            // Maximum 5 fallback levels
    level_timeout_ms: 15000;           // 15 seconds per level
    total_cascade_timeout_ms: 75000;   // 75 seconds total
    failure_propagation_blocked: boolean;
    isolation_boundaries: string[];    // ['database', 'web', 'files']
  };
  failure_isolation: {
    isolated_components: string[];
    cross_component_dependencies: Array<{
      component_a: string;
      component_b: string;
      dependency_type: 'critical' | 'optional';
    }>;
    isolation_strategy: 'fail_fast' | 'graceful_degradation' | 'circuit_breaker';
  };
}
```

### 10. **Monitoring and Alerting for Infinite Loops**

```typescript
{
  infinite_loop_detection: {
    retry_pattern_analysis: {
      consecutive_identical_retries: number;
      retry_frequency_per_minute: number;
      total_retry_time_ms: number;
      suspicious_pattern_detected: boolean;
    }
    alerting_thresholds: {
      max_retries_per_minute: 10;
      max_total_retry_time_ms: 60000; // 1 minute
      max_consecutive_failures: 5;
      alert_triggered: boolean;
    }
    automatic_intervention: {
      auto_blacklist_source: boolean;
      auto_reduce_retry_attempts: boolean;
      auto_escalate_to_admin: boolean;
      intervention_timestamp: string;
    }
  }
}
```

### 11. **Implementation Example: Safe Retry Function**

```typescript
async function safeRetryWithProtection<T>(
  operation: () => Promise<T>,
  context: RetryContext
): Promise<T> {
  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = Math.min(context.maxRetries, 3);
  const globalTimeout = context.globalTimeoutMs || 30000;

  // Check global retry budget
  if (context.retryBudget <= 0) {
    throw new Error("Retry budget exhausted");
  }

  // Check circuit breaker
  if (context.circuitBreaker?.state === "open") {
    throw new Error("Circuit breaker is open");
  }

  while (attempt < maxAttempts) {
    const attemptStartTime = Date.now();

    // Check if we've exceeded global timeout
    if (attemptStartTime - startTime > globalTimeout) {
      throw new Error("Global timeout exceeded");
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Operation timeout")),
            context.operationTimeoutMs || 10000
          )
        ),
      ]);

      // Success - reset circuit breaker
      if (context.circuitBreaker) {
        context.circuitBreaker.failureCount = 0;
        context.circuitBreaker.state = "closed";
      }

      return result;
    } catch (error) {
      attempt++;
      context.retryBudget--;

      // Classify error
      const errorType = classifyError(error);
      if (errorType === "never_retry") {
        throw error;
      }

      if (errorType === "permanent" || attempt >= maxAttempts) {
        // Update circuit breaker
        if (context.circuitBreaker) {
          context.circuitBreaker.failureCount++;
          if (context.circuitBreaker.failureCount >= 3) {
            context.circuitBreaker.state = "open";
            context.circuitBreaker.nextAttemptTime = Date.now() + 300000; // 5 minutes
          }
        }
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        context.baseDelayMs *
          Math.pow(2, attempt - 1) *
          (1 + Math.random() * 0.1),
        context.maxDelayMs || 30000
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retry attempts exceeded");
}
```

## Credit System Integration

### 1. **Credit Management and Validation**

#### **Credit Check and Deduction Flow**

```typescript
{
  credit_validation: {
    user_id: string;
    operation_type: "database_query" |
      "web_scraping" |
      "file_processing" |
      "visualization" |
      "multi_source";
    estimated_credits_required: number;
    current_balance: number;
    credit_tier: "free" | "premium" | "enterprise";
    validation_result: "sufficient" | "insufficient" | "exceeded_limit";
  }
  credit_deduction: {
    credits_charged: number;
    remaining_balance: number;
    transaction_id: string;
    deduction_timestamp: string;
    operation_breakdown: Array<{
      component: string;
      credits_used: number;
      reason: string;
    }>;
  }
}
```

#### **Token-Based Credit System**

```typescript
{
  credit_system: {
    token_to_credit_ratio: 1000; // 1 credit = 1000 tokens
    token_calculation: {
      input_tokens: number; // User message + context tokens
      output_tokens: number; // AI response tokens
      processing_tokens: number; // Internal processing tokens
      total_tokens: number; // Sum of all tokens
    }
    credit_calculation: {
      tokens_used: number;
      credits_consumed: number; // Math.ceil(tokens_used / 1000)
      remaining_tokens: number; // 1000 - (tokens_used % 1000)
    }
    token_tracking: {
      by_agent: {
        query_intent_classification: number;
        router_agent: number;
        query_agent: number;
        db_agent: number;
        web_scraper_agent: number;
        google_docs_agent: number;
        content_processor_agent: number;
        visual_agent: number;
        graph_agent: number;
        qa_agent: number;
      }
      by_operation: {
        database_query: number;
        web_scraping: number;
        file_processing: number;
        visualization_generation: number;
        multi_source_analysis: number;
      }
    }
  }
}
```

### 2. **Credit Validation at Each Stage**

#### **Pre-Processing Token Estimation**

```typescript
{
  pre_processing_validation: {
    estimated_tokens: {
      user_message_tokens: number;
      context_tokens: number;
      processing_tokens: number;
      estimated_output_tokens: number;
      total_estimated_tokens: number;
    };
    estimated_credits: number; // Math.ceil(total_estimated_tokens / 1000)
    user_balance: number;
    sufficient_credits: boolean;
    fallback_message?: string;
    upgrade_suggestion?: {
      current_tier: string;
      recommended_tier: string;
      additional_credits_needed: number;
    };
  };
}
```

#### **Real-Time Token Monitoring**

```typescript
{
  real_time_monitoring: {
    tokens_used_so_far: number;
    credits_consumed_so_far: number;
    estimated_remaining_tokens: number;
    projected_total_tokens: number;
    projected_total_credits: number;
    balance_after_completion: number;
    low_balance_warning: boolean;
    stop_processing_threshold: number;
    token_usage_by_agent: Record<string, number>;
  }
}
```

### 3. **Credit System Database Schema**

#### **User Credits Table**

```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  current_balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  credit_tier VARCHAR NOT NULL DEFAULT 'free',
  monthly_allowance INTEGER DEFAULT 100, -- Free tier allowance
  last_reset_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Credit Transactions Table**

```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  transaction_type VARCHAR NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus'
  amount INTEGER NOT NULL, -- Positive for credits added, negative for usage
  operation_type VARCHAR, -- 'database_query', 'web_scraping', etc.
  operation_id UUID, -- Reference to specific operation
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### **Token Usage Tracking Table**

```sql
CREATE TABLE token_usage_tracking (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID REFERENCES conversations(id),
  token_breakdown JSONB NOT NULL, -- Detailed breakdown of token usage by agent
  total_tokens_used INTEGER NOT NULL,
  credits_consumed INTEGER NOT NULL, -- Math.ceil(total_tokens_used / 1000)
  processing_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. **Credit Validation in Agent Flow**

#### **Enhanced Router Agent with Token Estimation**

```typescript
{
  router_agent_enhanced: {
    data_source_routing: {
      // ... existing routing logic
    };
    token_estimation: {
      estimated_tokens_by_source: Array<{
        source_type: string;
        source_id: string;
        estimated_tokens: number;
        estimated_credits: number; // Math.ceil(estimated_tokens / 1000)
        confidence_score: number;
      }>;
      total_estimated_tokens: number;
      total_estimated_credits: number;
      user_can_afford: boolean;
      recommended_sources: string[]; // Sources within budget
    };
  };
}
```

#### **Token-Aware Processing**

```typescript
{
  token_aware_processing: {
    before_processing: {
      reserve_credits: number;
      estimated_tokens: number;
      estimated_credits: number;
      processing_approved: boolean;
    }
    during_processing: {
      tokens_used_so_far: number;
      credits_consumed_so_far: number;
      remaining_token_budget: number;
      can_continue: boolean;
      token_optimization_applied: boolean;
    }
    after_processing: {
      actual_tokens_used: number;
      actual_credits_consumed: number;
      refund_credits: number; // If processing failed or used fewer tokens
      final_balance: number;
      token_breakdown: Record<string, number>;
    }
  }
}
```

### 5. **Credit System Fallback Strategies**

#### **Insufficient Credits Scenarios**

```typescript
{
  insufficient_credits_handling: {
    scenario_1_free_tier_limit: {
      message: "You've reached your monthly limit of 100,000 free tokens (100 credits). This operation requires {estimated_tokens} tokens. Upgrade to Premium for unlimited access or wait until next month for your tokens to reset.";
      actions: ["upgrade_prompt", "wait_for_reset", "purchase_credits"];
    }
    scenario_2_premium_limit: {
      message: "You've used all your purchased tokens. This operation requires {estimated_tokens} tokens but you have {remaining_tokens} tokens remaining. Purchase more credits to continue or upgrade to Enterprise for unlimited access.";
      actions: ["purchase_credits", "upgrade_to_enterprise"];
    }
    scenario_3_expensive_operation: {
      message: "This operation requires {estimated_tokens} tokens ({estimated_credits} credits) but you only have {remaining_tokens} tokens ({remaining_credits} credits). Consider simplifying your request or upgrading your plan.";
      actions: ["simplify_request", "upgrade_plan", "purchase_credits"];
    }
  }
}
```

#### **User Experience-First Token Optimization**

```typescript
{
  token_optimization: {
    // HIGH IMPACT, LOW UX IMPACT
    intelligent_caching: {
      enabled: boolean;
      cache_fresh_data: boolean;        // Only cache recent, relevant data
      cache_age_hours: 24;             // Reasonable cache duration
      tokens_saved: number;
      ux_impact: 'none';               // No impact on user experience
    };

    // MEDIUM IMPACT, MINIMAL UX IMPACT
    smart_context_selection: {
      enabled: boolean;
      prioritize_relevant_context: boolean;  // Focus on most relevant context
      max_context_tokens: 8000;             // Generous context limit
      tokens_saved: number;
      ux_impact: 'minimal';                 // Slight improvement in relevance
    };

    // LOW IMPACT, NO UX IMPACT
    response_formatting: {
      enabled: boolean;
      optimize_markdown: boolean;       // Clean formatting without content loss
      remove_redundancy: boolean;       // Remove duplicate information
      tokens_saved: number;
      ux_impact: 'none';               // Actually improves readability
    };

    // USER-CONTROLLED OPTIMIZATIONS
    user_preferences: {
      response_detail_level: 'full' | 'summary' | 'brief';  // User choice
      include_explanations: boolean;    // User can choose XAI level
      max_response_length: number;      // User-defined limit
      tokens_saved: number;
      ux_impact: 'user_controlled';     // User decides the trade-off
    };

    // AVOIDED: Aggressive optimizations that hurt UX
    avoided_optimizations: {
      data_sampling: 'disabled',        // Never sample data - always use full dataset
      complexity_reduction: 'disabled', // Never skip features
      context_truncation: 'disabled',   // Never cut important context
      response_truncation: 'disabled',  // Never cut responses short
    };
  };
}
```

### 6. **Credit System API Integration**

#### **Token Estimation Endpoint**

```typescript
// GET /api/credits/estimate
{
  user_id: string;
  user_message: string;
  context_size: number;
  response: {
    estimated_tokens: {
      input_tokens: number;
      context_tokens: number;
      processing_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    estimated_credits: number;
    current_balance: number;
    sufficient_credits: boolean;
    can_proceed: boolean;
    fallback_message?: string;
    upgrade_options?: Array<{
      tier: string;
      monthly_cost: number;
      tokens_included: number;
      credits_included: number;
      benefits: string[];
    }>;
  };
}
```

#### **Token Deduction Endpoint**

```typescript
// POST /api/credits/deduct
{
  user_id: string;
  operation_id: string;
  tokens_used: number;
  credits_to_deduct: number; // Math.ceil(tokens_used / 1000)
  token_breakdown: Array<{
    agent: string;
    tokens: number;
    credits: number;
  }>;
  response: {
    success: boolean;
    transaction_id: string;
    new_balance: number;
    tokens_consumed: number;
    credits_deducted: number;
  }
}
```

### 7. **Credit System Error Handling**

#### **Token-Related Error Responses**

```typescript
{
  token_errors: {
    insufficient_tokens: {
      error_code: 'INSUFFICIENT_TOKENS';
      message: string;
      current_balance: number;
      required_tokens: number;
      required_credits: number;
      suggested_actions: string[];
    };
    token_limit_exceeded: {
      error_code: 'TOKEN_LIMIT_EXCEEDED';
      message: string;
      daily_token_limit: number;
      monthly_token_limit: number;
      daily_credit_limit: number;
      monthly_credit_limit: number;
      reset_time: string;
    };
    payment_required: {
      error_code: 'PAYMENT_REQUIRED';
      message: string;
      payment_url: string;
      upgrade_options: Array<{
        plan: string;
        price: number;
        tokens_included: number;
        credits_included: number;
        features: string[];
      }>;
    };
  };
}
```

### 8. **Credit System Monitoring and Analytics**

#### **Token Usage Analytics**

```typescript
{
  token_analytics: {
    user_metrics: {
      total_tokens_used: number;
      total_credits_consumed: number;
      average_tokens_per_request: number;
      average_credits_per_request: number;
      most_token_intensive_operations: Array<{
        operation_type: string;
        average_tokens: number;
        average_credits: number;
        frequency: number;
      }>;
      token_optimization_opportunities: string[];
    };
    system_metrics: {
      total_tokens_consumed: number;
      total_credits_consumed: number;
      revenue_generated: number;
      token_utilization_rate: number;
      credit_utilization_rate: number;
      popular_operations: Array<{
        operation: string;
        usage_count: number;
        total_tokens: number;
        total_credits: number;
      }>;
    };
    agent_metrics: {
      token_usage_by_agent: Record<string, {
        total_tokens: number;
        total_credits: number;
        average_tokens_per_call: number;
        call_count: number;
      }>;
    };
  };
}
```

### 9. **Credit System Implementation in Flow**

#### **Enhanced Process With Agent**

```typescript
async function processWithAgentWithTokens(
  conversation: ConversationContext,
  userMessage: string
): Promise<AgentResponse> {
  // Step 1: Token estimation and credit validation
  const tokenEstimate = await estimateTokenUsage(
    userMessage,
    conversation.context,
    "multi_agent_processing"
  );

  const creditCheck = await validateUserCredits(
    conversation.user_id,
    tokenEstimate.total_tokens,
    tokenEstimate.estimated_credits
  );

  if (!creditCheck.sufficient_credits) {
    return {
      content: creditCheck.fallback_message,
      metadata: {
        processing_status: "insufficient_credits",
        estimated_tokens: tokenEstimate.total_tokens,
        estimated_credits: tokenEstimate.estimated_credits,
        current_balance: creditCheck.current_balance,
        upgrade_options: creditCheck.upgrade_options,
      },
      tokens_used: 0,
      processing_time_ms: 0,
    };
  }

  // Step 2: Reserve credits
  const creditReservation = await reserveCredits(
    conversation.user_id,
    tokenEstimate.estimated_credits
  );

  let totalTokensUsed = 0;
  const tokenBreakdown: Record<string, number> = {};

  try {
    // Step 3: Process with existing logic and track tokens
    const result = await processWithAgentWithTokenTracking(
      conversation,
      userMessage,
      (agentName: string, tokens: number) => {
        tokenBreakdown[agentName] = tokens;
        totalTokensUsed += tokens;
      }
    );

    // Step 4: Calculate actual credits consumed
    const actualCreditsConsumed = Math.ceil(totalTokensUsed / 1000);

    // Step 5: Deduct actual credits used
    await deductCredits(
      conversation.user_id,
      creditReservation.transaction_id,
      totalTokensUsed,
      actualCreditsConsumed,
      tokenBreakdown
    );

    // Step 6: Refund any over-reserved credits
    const refundAmount = creditReservation.amount - actualCreditsConsumed;
    if (refundAmount > 0) {
      await refundCredits(
        conversation.user_id,
        creditReservation.transaction_id,
        refundAmount
      );
    }

    return {
      ...result,
      tokens_used: totalTokensUsed,
      credits_consumed: actualCreditsConsumed,
      token_breakdown: tokenBreakdown,
    };
  } catch (error) {
    // Step 7: Refund all reserved credits on failure
    await refundCredits(
      conversation.user_id,
      creditReservation.transaction_id,
      creditReservation.amount
    );
    throw error;
  }
}

// Helper function to estimate token usage
async function estimateTokenUsage(
  userMessage: string,
  context: any,
  operationType: string
): Promise<{
  input_tokens: number;
  context_tokens: number;
  processing_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_credits: number;
}> {
  // Use OpenAI's tiktoken or similar to estimate tokens
  const inputTokens = estimateTokens(userMessage);
  const contextTokens = estimateTokens(JSON.stringify(context));
  const processingTokens = estimateProcessingTokens(operationType);
  const outputTokens = estimateOutputTokens(operationType);

  const totalTokens =
    inputTokens + contextTokens + processingTokens + outputTokens;
  const estimatedCredits = Math.ceil(totalTokens / 1000);

  return {
    input_tokens: inputTokens,
    context_tokens: contextTokens,
    processing_tokens: processingTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_credits: estimatedCredits,
  };
}
```

## Summary

This enhanced system provides a comprehensive solution for file-based, database-driven, web content, and Google Docs data analysis, with intelligent routing, robust error handling, rich interactive visualizations using D3.js and other advanced libraries, sophisticated handling of all edge cases including uncertainty, multi-source scenarios, performance issues, system failures, and a complete credit system for monetization and resource management.

### Key Enhancements for Basic Question Handling

1. **Intelligent Query Complexity Assessment**: The system now automatically detects when a user's question can be answered from database schema metadata alone, avoiding unnecessary query generation and execution.

2. **Schema Answer Agent**: A new specialized agent that handles basic questions about database structure, relationships, and metadata without requiring SQL/NoSQL query generation.

3. **Optimized Processing Path**: Basic questions follow a streamlined path that bypasses the Query Agent and DB Agent, resulting in faster responses and lower token usage.

4. **Credit System Integration**: Basic schema questions consume minimal credits (1 credit vs 10-50 for complex queries), providing better value to users and encouraging database exploration.

5. **Performance Benefits**:

   - **Response Time**: <500ms for basic questions vs 3-10 seconds for complex queries
   - **Token Usage**: 50-100 tokens vs 500-1000 tokens for complex queries
   - **Resource Efficiency**: No database connections or query execution required
   - **Caching**: Schema responses can be cached for 24 hours

6. **User Experience Improvements**:
   - Faster responses for common database exploration questions
   - More affordable credit usage for basic operations
   - Better guidance with follow-up suggestions
   - Encourages users to understand database structure before complex analysis

### Example Basic Questions Handled

- "What tables are in this database?"
- "What columns does the users table have?"
- "How are orders and customers related?"
- "What data types are used in the products table?"
- "Does the database have any foreign key constraints?"
- "What indexes are available?"
- "How many tables are in this database?"

This enhancement significantly improves the user experience for database exploration while maintaining the full power of the system for complex analytical queries.
