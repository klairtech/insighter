/**
 * Guardrails Agent
 * 
 * Responsible for content safety, policy compliance, and request validation
 */

import { BaseAgent, AgentContext, AgentResponse, GuardrailsResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export class GuardrailsAgent implements BaseAgent {
  name = 'Guardrails Agent';
  description = 'Ensures content safety and policy compliance for user requests';

  async execute(context: AgentContext): Promise<AgentResponse<GuardrailsResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🛡️ Guardrails Agent: Analyzing request safety...');
      
      const { userQuery, conversationHistory } = context;
      
      // First, check for obvious violations using pattern matching
      const patternCheck = this.performPatternSafetyCheck(userQuery);
      if (patternCheck.blocked) {
        console.log('🛡️ Guardrails Agent: Request blocked by pattern matching');
        return {
          success: true,
          data: {
            allowed: false,
            reason: patternCheck.reason,
            confidence: 0.95,
            risk_level: 'high',
            flagged_keywords: patternCheck.flaggedKeywords
          },
          metadata: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: 0,
            confidence_score: 0.95
          }
        };
      }
      
      // Get recent conversation context
      const recentConversation = conversationHistory
        .slice(-3)
        .map(msg => `${msg.sender_type}: ${msg.content}`)
        .join('\n');

      const guardrailsPrompt = `You are a Guardrails Agent responsible for content safety and policy compliance.

USER REQUEST: "${userQuery}"

${recentConversation ? `RECENT CONVERSATION:\n${recentConversation}\n` : ''}

Analyze this request for:
1. **Content Safety**: Harmful, illegal, or inappropriate content
2. **Data Privacy**: Requests for personal/sensitive information
3. **System Security**: Attempts to access system files or execute code
4. **Business Policy**: Requests outside the scope of data analysis
5. **Resource Abuse**: Excessive or resource-intensive requests

POLICY GUIDELINES:
- ✅ ALLOW: Data analysis, business insights, file processing, database queries
- ❌ BLOCK: Personal information requests, system access, harmful content, illegal activities
- ⚠️ FLAG: Complex queries that might be resource-intensive

Respond with JSON:
{
  "allowed": true/false,
  "reason": "Brief explanation of decision",
  "confidence": 0.0-1.0,
  "risk_level": "low/medium/high",
  "suggested_alternatives": ["Alternative approaches if blocked"]
}`;

      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a content safety guardrails agent. Analyze requests for safety and compliance. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: guardrailsPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      
      // Additional heuristic checks
      const additionalChecks = this.performHeuristicChecks(userQuery);
      
      // Combine AI analysis with heuristic checks
      const finalResult: GuardrailsResponse = {
        allowed: result.allowed && additionalChecks.allowed,
        reason: result.reason || additionalChecks.reason,
        confidence: Math.min(result.confidence || 0.8, additionalChecks.confidence),
        risk_level: this.determineRiskLevel(result, additionalChecks),
        suggested_alternatives: result.suggested_alternatives || []
      };

      const processingTime = Date.now() - startTime;
      
      console.log('🛡️ Guardrails Result:', {
        allowed: finalResult.allowed,
        risk_level: finalResult.risk_level,
        confidence: finalResult.confidence
      });

      return {
        success: true,
        data: finalResult,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: response.tokens_used || 0,
          confidence_score: finalResult.confidence
        }
      };

    } catch (error) {
      console.error('Guardrails Agent error:', error);
      
      // Fallback: Allow request but with high risk level
      return {
        success: true,
        data: {
          allowed: true,
          reason: 'Guardrails analysis failed - allowing with caution',
          confidence: 0.3,
          risk_level: 'high',
          suggested_alternatives: []
        },
        metadata: {
          processing_time_ms: Date.now() - startTime,
          tokens_used: 0,
          confidence_score: 0.3
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private performHeuristicChecks(userQuery: string): { allowed: boolean; reason?: string; confidence: number } {
    const query = userQuery.toLowerCase();
    
    // Block obvious harmful patterns
    const blockedPatterns = [
      'password', 'secret', 'private key', 'api key',
      'delete', 'drop table', 'truncate', 'alter table',
      'system', 'admin', 'root', 'sudo',
      'exec', 'eval', 'script', 'javascript:',
      'personal information', 'ssn', 'credit card'
    ];
    
    for (const pattern of blockedPatterns) {
      if (query.includes(pattern)) {
        return {
          allowed: false,
          reason: `Request contains potentially harmful pattern: ${pattern}`,
          confidence: 0.9
        };
      }
    }
    
    // Flag resource-intensive patterns
    const intensivePatterns = [
      'all data', 'everything', 'entire database',
      'export all', 'download all', 'copy all'
    ];
    
    for (const pattern of intensivePatterns) {
      if (query.includes(pattern)) {
        return {
          allowed: true,
          reason: 'Resource-intensive request detected',
          confidence: 0.7
        };
      }
    }
    
    return {
      allowed: true,
      confidence: 0.8
    };
  }

  private performPatternSafetyCheck(query: string): { blocked: boolean; reason?: string; flaggedKeywords?: string[] } {
    const lowerQuery = query.toLowerCase();
    
    // Define blocked patterns
    const blockedPatterns = {
      security: [
        /(hack|exploit|vulnerability|attack|breach|inject)/i,
        /(sql injection|xss|csrf|ddos)/i,
        /(backdoor|malware|virus|trojan)/i
      ],
      illegal: [
        /(illegal|unlawful|criminal|fraud|scam)/i,
        /(steal|theft|robbery|kidnap)/i,
        /(drugs|weapons|violence|harm)/i
      ],
      privacy: [
        /(personal data|private information|confidential)/i,
        /(ssn|social security|credit card|password)/i,
        /(spy|surveillance|tracking)/i
      ],
      system: [
        /(system files|root access|admin privileges)/i,
        /(execute code|run script|command line)/i,
        /(delete files|format disk|shutdown)/i
      ]
    };
    
    const flaggedKeywords: string[] = [];
    
    for (const [category, patterns] of Object.entries(blockedPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuery)) {
          flaggedKeywords.push(category);
          return {
            blocked: true,
            reason: `Request contains ${category} related content that violates our usage policies`,
            flaggedKeywords: [category]
          };
        }
      }
    }
    
    return { blocked: false };
  }

  private determineRiskLevel(aiResult: any, heuristicResult: any): 'low' | 'medium' | 'high' {
    if (!aiResult.allowed || !heuristicResult.allowed) {
      return 'high';
    }
    
    if (aiResult.risk_level === 'high' || heuristicResult.reason?.includes('Resource-intensive')) {
      return 'high';
    }
    
    if (aiResult.risk_level === 'medium' || aiResult.confidence < 0.7) {
      return 'medium';
    }
    
    return 'low';
  }
}
