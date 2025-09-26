/**
 * Comprehensive Token Tracking Utilities
 * Tracks tokens from user input through all processing stages to final output
 */

/**
 * Estimate token count for text (rough approximation)
 * This is a simplified tokenizer - in production, you'd want to use tiktoken or similar
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is conservative and may vary by model
  const charCount = text.length
  const estimatedTokens = Math.ceil(charCount / 4)
  
  // Add some overhead for special tokens, formatting, etc.
  return Math.max(1, estimatedTokens + Math.ceil(estimatedTokens * 0.1))
}

/**
 * Calculate tokens for a complete message including system prompts and context
 */
export function calculateMessageTokens(
  systemPrompt: string,
  userMessage: string,
  context?: string
): {
  systemTokens: number
  userTokens: number
  contextTokens: number
  totalTokens: number
} {
  const systemTokens = estimateTokenCount(systemPrompt)
  const userTokens = estimateTokenCount(userMessage)
  const contextTokens = context ? estimateTokenCount(context) : 0
  const totalTokens = systemTokens + userTokens + contextTokens

  return {
    systemTokens,
    userTokens,
    contextTokens,
    totalTokens
  }
}

/**
 * Calculate tokens for file content and summaries
 */
export function calculateFileContentTokens(
  fileContent: string,
  summary?: string,
  keyPoints?: string[],
  tags?: string[]
): {
  contentTokens: number
  summaryTokens: number
  metadataTokens: number
  totalTokens: number
} {
  const contentTokens = estimateTokenCount(fileContent)
  const summaryTokens = summary ? estimateTokenCount(summary) : 0
  const keyPointsText = keyPoints ? keyPoints.join(' ') : ''
  const tagsText = tags ? tags.join(' ') : ''
  const metadataTokens = estimateTokenCount(keyPointsText + ' ' + tagsText)
  const totalTokens = contentTokens + summaryTokens + metadataTokens

  return {
    contentTokens,
    summaryTokens,
    metadataTokens,
    totalTokens
  }
}

/**
 * Calculate tokens for conversation history
 */
export function calculateConversationHistoryTokens(
  messages: Array<{
    sender_type: string
    content: string
    created_at: string
  }>
): number {
  if (!messages || messages.length === 0) return 0
  
  const historyText = messages
    .map(msg => `${msg.sender_type}: ${msg.content}`)
    .join('\n')
  
  return estimateTokenCount(historyText)
}

/**
 * Comprehensive token tracking for the entire agent processing pipeline
 */
export interface TokenTrackingData {
  // Input tokens
  userInputTokens: number
  systemPromptTokens: number
  contextTokens: number
  
  // Processing tokens
  routerAgentTokens: number
  qaAgentTokens: number
  fileContentTokens: number
  conversationHistoryTokens: number
  
  // Output tokens
  agentResponseTokens: number
  
  // Totals
  totalInputTokens: number
  totalProcessingTokens: number
  totalOutputTokens: number
  totalTokensUsed: number
  
  // Breakdown by stage
  stageBreakdown: {
    input: number
    routing: number
    fileProcessing: number
    qaGeneration: number
    output: number
  }
}

/**
 * Calculate comprehensive token usage for agent processing
 */
export function calculateComprehensiveTokenUsage(
  userMessage: string,
  systemPrompt: string,
  context: string,
  routerTokens: number,
  qaTokens: number,
  fileContent: string,
  conversationHistory: Array<{ sender_type: string; content: string; created_at: string }>,
  agentResponse: string
): TokenTrackingData {
  // Input stage
  const userInputTokens = estimateTokenCount(userMessage)
  const systemPromptTokens = estimateTokenCount(systemPrompt)
  const contextTokens = estimateTokenCount(context)
  const totalInputTokens = userInputTokens + systemPromptTokens + contextTokens
  
  // Processing stage
  const routerAgentTokens = routerTokens
  const qaAgentTokens = qaTokens
  const fileContentTokens = estimateTokenCount(fileContent)
  const conversationHistoryTokens = calculateConversationHistoryTokens(conversationHistory)
  const totalProcessingTokens = routerAgentTokens + qaAgentTokens + fileContentTokens + conversationHistoryTokens
  
  // Output stage
  const agentResponseTokens = estimateTokenCount(agentResponse)
  const totalOutputTokens = agentResponseTokens
  
  // Grand total
  const totalTokensUsed = totalInputTokens + totalProcessingTokens + totalOutputTokens
  
  // Stage breakdown
  const stageBreakdown = {
    input: totalInputTokens,
    routing: routerAgentTokens,
    fileProcessing: fileContentTokens + conversationHistoryTokens,
    qaGeneration: qaAgentTokens,
    output: totalOutputTokens
  }

  return {
    userInputTokens,
    systemPromptTokens,
    contextTokens,
    routerAgentTokens,
    qaAgentTokens,
    fileContentTokens,
    conversationHistoryTokens,
    agentResponseTokens,
    totalInputTokens,
    totalProcessingTokens,
    totalOutputTokens,
    totalTokensUsed,
    stageBreakdown
  }
}
