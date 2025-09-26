import crypto from 'crypto';
import { encryptText, decryptText, encryptObject, decryptObject, hashForIndex } from './encryption';

/**
 * API-specific encryption utilities
 * These mirror the chat encryption system but are specifically for API tracking
 */

/**
 * Encrypt API request content
 */
export function encryptApiRequest(content: string): string {
  return encryptText(content);
}

/**
 * Decrypt API request content
 */
export function decryptApiRequest(encryptedContent: string): string {
  return decryptText(encryptedContent);
}

/**
 * Encrypt API response content
 */
export function encryptApiResponse(content: string): string {
  return encryptText(content);
}

/**
 * Decrypt API response content
 */
export function decryptApiResponse(encryptedContent: string): string {
  return decryptText(encryptedContent);
}

/**
 * Encrypt API conversation title
 */
export function encryptApiConversationTitle(title: string): string {
  return encryptText(title);
}

/**
 * Decrypt API conversation title
 */
export function decryptApiConversationTitle(encryptedTitle: string): string {
  return decryptText(encryptedTitle);
}

/**
 * Encrypt API metadata
 */
export function encryptApiMetadata(metadata: Record<string, unknown>): string {
  return encryptObject(metadata);
}

/**
 * Decrypt API metadata
 */
export function decryptApiMetadata(encryptedMetadata: string): Record<string, unknown> {
  return decryptObject(encryptedMetadata);
}

/**
 * Create hash for API content indexing
 */
export function hashApiContent(content: string): string {
  return hashForIndex(content);
}

/**
 * Create hash for API token (for tracking without storing the actual token)
 */
export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate conversation title from request content
 */
export function generateApiConversationTitle(requestContent: string): string {
  // Truncate and clean the request content for title
  const cleanContent = requestContent
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  if (cleanContent.length <= 50) {
    return cleanContent;
  }
  
  return cleanContent.substring(0, 47) + '...';
}

/**
 * Validate API conversation data
 */
export function validateApiConversationData(data: {
  userId: string;
  agentId: string;
  externalConversationId: string;
}): boolean {
  return !!(
    data.userId &&
    data.agentId &&
    data.externalConversationId &&
    data.userId.length > 0 &&
    data.agentId.length > 0 &&
    data.externalConversationId.length > 0
  );
}

/**
 * Create API interaction metadata
 */
export function createApiInteractionMetadata(data: {
  ipAddress?: string;
  userAgent?: string;
  dataSources?: string[];
  contextData?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ip_address: data.ipAddress || 'unknown',
    user_agent: data.userAgent || 'unknown',
    data_sources: data.dataSources || [],
    context_data: data.contextData || {},
    timestamp: new Date().toISOString(),
    version: 'v1'
  };
}
