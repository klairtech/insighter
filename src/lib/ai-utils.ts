/**
 * AI Utilities
 * 
 * Common AI functions used across agents
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { callAIWithRateLimit } from './llm-rate-limiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';
const OPENAI_BACKUP_MODEL = process.env.OPENAI_BACKUP_MODEL || 'gpt-4o-mini';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface AIResponse {
  content: string;
  tokens_used: number;
  model_used: string;
  fallback_used: boolean;
}

/**
 * Helper function to call AI model with fallback logic and rate limiting
 * Primary: Claude, Backup: OpenAI
 */
export async function callAIWithFallback(
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  options: {
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  } = {}
): Promise<AIResponse> {
  const { temperature = 0.3, max_tokens = 1000, response_format } = options;
  
  // Estimate tokens for rate limiting (rough approximation)
  const estimatedTokens = Math.max(100, messages.reduce((sum, msg) => sum + msg.content.length / 4, 0) + max_tokens);
  
  try {
    return await callAIWithRateLimit(
      'claude',
      async () => {
        console.log('🤖 Attempting Claude API call...');
        
        const claudeResponse = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: max_tokens,
          temperature: temperature,
          messages: messages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.role === 'system' ? `System: ${msg.content}` : msg.content
          }))
        });
        
        const content = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text : '';
        const tokensUsed = claudeResponse.usage?.input_tokens + claudeResponse.usage?.output_tokens || 0;
        
        if (tokensUsed === 0) {
          console.warn('⚠️ Claude API returned 0 tokens - this may indicate a tracking issue');
        }
        
        console.log('✅ Claude API call successful');
        
        return {
          content,
          tokens_used: tokensUsed,
          model_used: CLAUDE_MODEL,
          fallback_used: false
        };
      },
      estimatedTokens,
      'openai',
      async () => {
        console.log('🤖 Attempting OpenAI backup...');
        
        const openaiResponse = await openai.chat.completions.create({
          model: OPENAI_BACKUP_MODEL,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
          response_format: response_format
        });
        
        const content = openaiResponse.choices[0]?.message?.content || '';
        const tokensUsed = openaiResponse.usage?.total_tokens || 0;
        
        if (tokensUsed === 0) {
          console.warn('⚠️ OpenAI API returned 0 tokens - this may indicate a tracking issue');
        }
        
        console.log('✅ OpenAI backup successful');
        
        return {
          content,
          tokens_used: tokensUsed,
          model_used: OPENAI_BACKUP_MODEL,
          fallback_used: true
        };
      }
    );
    
  } catch (error) {
    console.error('❌ Both Claude and OpenAI failed:', error);
    throw new Error(`AI API calls failed: ${error}`);
  }
}

/**
 * Helper function to call AI model with OpenAI as primary and Claude as fallback
 * Primary: OpenAI, Backup: Claude
 */
export async function callAIWithOpenAIPrimary(
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  options: {
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  } = {}
): Promise<AIResponse> {
  const { temperature = 0.3, max_tokens = 1000, response_format } = options;
  
  // Estimate tokens for rate limiting (rough approximation)
  const estimatedTokens = Math.max(100, messages.reduce((sum, msg) => sum + msg.content.length / 4, 0) + max_tokens);
  
  try {
    return await callAIWithRateLimit(
      'openai',
      async () => {
        console.log('🤖 Attempting OpenAI API call...');
        
        const openaiResponse = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
          response_format: response_format
        });
        
        const content = openaiResponse.choices[0]?.message?.content || '';
        const tokensUsed = openaiResponse.usage?.total_tokens || 0;
        
        if (tokensUsed === 0) {
          console.warn('⚠️ OpenAI API returned 0 tokens - this may indicate a tracking issue');
        }
        
        console.log('✅ OpenAI API call successful');
        
        return {
          content,
          tokens_used: tokensUsed,
          model_used: OPENAI_MODEL,
          fallback_used: false
        };
      },
      estimatedTokens,
      'claude',
      async () => {
        console.log('🤖 Attempting Claude backup...');
        
        const claudeResponse = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: max_tokens,
          temperature: temperature,
          messages: messages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: msg.role === 'system' ? `System: ${msg.content}` : msg.content
          }))
        });
        
        const content = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text : '';
        const tokensUsed = claudeResponse.usage?.input_tokens + claudeResponse.usage?.output_tokens || 0;
        
        if (tokensUsed === 0) {
          console.warn('⚠️ Claude API returned 0 tokens - this may indicate a tracking issue');
        }
        
        console.log('✅ Claude backup successful');
        
        return {
          content,
          tokens_used: tokensUsed,
          model_used: CLAUDE_MODEL,
          fallback_used: true
        };
      }
    );
    
  } catch (error) {
    console.error('❌ Both OpenAI and Claude failed:', error);
    throw new Error(`AI API calls failed: ${error}`);
  }
}

/**
 * Helper function to call AI model with Claude as primary and OpenAI as fallback
 * Primary: Claude, Backup: OpenAI (for coding/query tasks)
 */
export async function callAIWithClaudePrimary(
  messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
  options: {
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
  } = {}
): Promise<AIResponse> {
  // This is the same as the original callAIWithFallback function
  return callAIWithFallback(messages, options);
}
