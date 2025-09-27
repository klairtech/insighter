/**
 * Guardrails and Safety Controls for AI Agent System
 */

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  sanitizedContent?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface UsageLimits {
  maxTokensPerDay: number;
  maxMessagesPerHour: number;
  maxFilesPerQuery: number;
  maxConversationLength: number;
}

/**
 * Default usage limits
 */
export const DEFAULT_USAGE_LIMITS: UsageLimits = {
  maxTokensPerDay: 100000, // 100k tokens per day
  maxMessagesPerHour: 50,   // 50 messages per hour
  maxFilesPerQuery: 5,      // Max 5 files per query
  maxConversationLength: 100 // Max 100 messages per conversation
}

/**
 * Content moderation and safety checks
 */
export function checkContentSafety(content: string): GuardrailResult {
  // Check for potentially harmful content
  const harmfulPatterns = [
    /personal\s+information|pii|ssn|credit\s+card|password|secret/i,
    /hack|exploit|vulnerability|attack|malware/i,
    /illegal|unlawful|criminal|fraud/i,
    /discrimination|hate\s+speech|harassment|racist|sexist|homophobic/i,
    /violence|harm|threat|kill|murder|suicide/i,
    /abuse|harass|stalk|bully|intimidate/i,
    /explicit|pornographic|sexual\s+content|nsfw/i,
    /spam|scam|phishing|malicious/i
  ]

  const riskKeywords = [
    'delete', 'remove', 'drop', 'truncate', 'alter', 'modify',
    'admin', 'root', 'sudo', 'privilege', 'escalation'
  ]

  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  let blocked = false
  let reason = ''

  // Check for harmful patterns
  for (const pattern of harmfulPatterns) {
    if (pattern.test(content)) {
      riskLevel = 'high'
      blocked = true
      reason = 'Content contains potentially harmful or sensitive information'
      break
    }
  }

  // Check for risk keywords in database context
  if (!blocked && riskKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
    riskLevel = 'medium'
    // Don't block, but flag for review
  }

  // Check content length
  if (content.length > 10000) {
    riskLevel = 'high'
    blocked = true
    reason = 'Message too long (max 10,000 characters)'
  }

  // Sanitize content if needed
  let sanitizedContent = content
  if (riskLevel === 'medium') {
    // Remove potential SQL injection patterns
    sanitizedContent = content.replace(/['";\\]/g, '')
  }

  return {
    allowed: !blocked,
    reason: blocked ? reason : undefined,
    sanitizedContent: sanitizedContent !== content ? sanitizedContent : undefined,
    riskLevel
  }
}

/**
 * Check if user has exceeded usage limits
 */
export async function checkUsageLimits(
  userId: string,
  limits: UsageLimits = DEFAULT_USAGE_LIMITS
): Promise<GuardrailResult> {
  try {
    // This would typically query a database to check usage
    // For now, we'll implement basic checks
    console.log(`Checking usage limits for user: ${userId}`, limits);
    
    // Check message frequency (simplified)
    // const now = new Date()
    // const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    // In a real implementation, you would:
    // 1. Query the database for messages in the last hour
    // 2. Query for total tokens used today
    // 3. Check conversation length
    
    // For now, return allowed
    return {
      allowed: true,
      riskLevel: 'low'
    }
  } catch (error) {
    console.error('Error checking usage limits:', error)
    return {
      allowed: false,
      reason: 'Error checking usage limits',
      riskLevel: 'high'
    }
  }
}

/**
 * Validate file access permissions
 */
export function validateFileAccess(
  fileIds: string[],
  userId: string,
  workspaceId: string
): GuardrailResult {
  // Check number of files
  console.log(`Validating file access for user: ${userId}, workspace: ${workspaceId}, files: ${fileIds.length}`);
  if (fileIds.length > DEFAULT_USAGE_LIMITS.maxFilesPerQuery) {
    return {
      allowed: false,
      reason: `Too many files requested (max ${DEFAULT_USAGE_LIMITS.maxFilesPerQuery})`,
      riskLevel: 'medium'
    }
  }

  // In a real implementation, you would:
  // 1. Check if user has access to the workspace
  // 2. Verify each file belongs to the workspace
  // 3. Check file permissions

  return {
    allowed: true,
    riskLevel: 'low'
  }
}

/**
 * Rate limiting check
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): GuardrailResult {
  // This is a simplified rate limiting check
  // In production, you'd use Redis or similar for distributed rate limiting
  console.log(`Rate limiting check for: ${identifier}, max: ${maxRequests}, window: ${windowMs}ms`);
  
  // const now = Date.now()
  // const windowStart = now - windowMs
  
  // For now, always allow (in production, check against stored timestamps)
  return {
    allowed: true,
    riskLevel: 'low'
  }
}

/**
 * Input validation and sanitization
 */
export function validateAndSanitizeInput(input: {
  content: string;
  messageType: string;
  metadata?: Record<string, unknown>;
}): GuardrailResult {
  const { content, messageType, metadata } = input

  // Check content safety
  const contentCheck = checkContentSafety(content)
  if (!contentCheck.allowed) {
    return contentCheck
  }

  // Validate message type
  const validMessageTypes = ['text', 'file_reference', 'system_notification']
  if (!validMessageTypes.includes(messageType)) {
    return {
      allowed: false,
      reason: 'Invalid message type',
      riskLevel: 'medium'
    }
  }

  // Validate metadata if provided
  if (metadata && typeof metadata !== 'object') {
    return {
      allowed: false,
      reason: 'Invalid metadata format',
      riskLevel: 'low'
    }
  }

  return {
    allowed: true,
    sanitizedContent: contentCheck.sanitizedContent || content,
    riskLevel: contentCheck.riskLevel
  }
}

/**
 * Response validation
 */
export function validateAgentResponse(response: {
  content: string;
  metadata: Record<string, unknown>;
  tokensUsed: number;
}): GuardrailResult {
  const { content, metadata, tokensUsed } = response

  // Check response content safety
  const contentCheck = checkContentSafety(content)
  if (!contentCheck.allowed) {
    return contentCheck
  }

  // Check token usage
  if (tokensUsed > 10000) { // Max 10k tokens per response
    return {
      allowed: false,
      reason: 'Response too large (token limit exceeded)',
      riskLevel: 'medium'
    }
  }

  // Validate metadata structure
  if (metadata && typeof metadata !== 'object') {
    return {
      allowed: false,
      reason: 'Invalid response metadata',
      riskLevel: 'low'
    }
  }

  return {
    allowed: true,
    sanitizedContent: contentCheck.sanitizedContent || content,
    riskLevel: contentCheck.riskLevel
  }
}

/**
 * Comprehensive guardrail check
 */
export async function runGuardrails(
  userId: string,
  input: {
    content: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    fileIds?: string[];
    workspaceId?: string;
  }
): Promise<GuardrailResult> {
  try {
    // 1. Input validation
    const inputCheck = validateAndSanitizeInput(input)
    if (!inputCheck.allowed) {
      return inputCheck
    }

    // 2. Usage limits
    const usageCheck = await checkUsageLimits(userId)
    if (!usageCheck.allowed) {
      return usageCheck
    }

    // 3. File access validation
    if (input.fileIds && input.workspaceId) {
      const fileCheck = validateFileAccess(input.fileIds, userId, input.workspaceId)
      if (!fileCheck.allowed) {
        return fileCheck
      }
    }

    // 4. Rate limiting
    const rateLimitCheck = checkRateLimit(userId, 10, 60000) // 10 requests per minute
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck
    }

    return {
      allowed: true,
      sanitizedContent: inputCheck.sanitizedContent,
      riskLevel: 'low'
    }
  } catch (error) {
    console.error('Error running guardrails:', error)
    return {
      allowed: false,
      reason: 'Guardrail check failed',
      riskLevel: 'high'
    }
  }
}
