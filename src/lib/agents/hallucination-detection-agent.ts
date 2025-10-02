/**
 * Hallucination Detection Agent
 * 
 * Detects and prevents hallucinations by analyzing responses for:
 * - Factual accuracy against source data
 * - Logical consistency
 * - Source attribution completeness
 * - Confidence calibration
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export interface HallucinationCheck {
  check_type: 'factual_accuracy' | 'logical_consistency' | 'source_attribution' | 'confidence_calibration' | 'contradiction_detection';
  result: 'passed' | 'failed' | 'warning';
  confidence: number;
  details: string;
  evidence: string[];
}

export interface HallucinationDetectionAgentResponse {
  is_hallucination_detected: boolean;
  hallucination_risk_level: 'low' | 'medium' | 'high' | 'critical';
  overall_confidence: number;
  checks_performed: HallucinationCheck[];
  detected_issues: string[];
  recommendations: string[];
  source_attribution_score: number;
  factual_accuracy_score: number;
  logical_consistency_score: number;
  safe_to_proceed: boolean;
}

export class HallucinationDetectionAgent implements BaseAgent {
  name = 'Hallucination Detection Agent';
  description = 'Detects and prevents hallucinations by analyzing responses for factual accuracy and consistency';

  async execute(context: AgentContext & { 
    sourceResults: any[];
    generatedResponse: string;
    crossValidationResults?: any;
  }): Promise<AgentResponse<HallucinationDetectionAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Hallucination Detection Agent: Analyzing response for hallucinations...');
      
      const { sourceResults, generatedResponse, userQuery, crossValidationResults } = context;
      
      if (!generatedResponse || generatedResponse.trim().length === 0) {
        throw new Error('No generated response available for hallucination detection');
      }

      // Perform comprehensive hallucination checks
      const checks = await this.performHallucinationChecks(
        generatedResponse, 
        sourceResults, 
        userQuery, 
        crossValidationResults
      );
      
      // Analyze results
      const analysis = this.analyzeHallucinationChecks(checks);
      
      // Calculate scores
      const scores = this.calculateHallucinationScores(checks, sourceResults);
      
      // Determine if safe to proceed
      const safeToProceed = this.determineSafety(analysis, scores);
      
      const result: HallucinationDetectionAgentResponse = {
        is_hallucination_detected: analysis.is_hallucination_detected,
        hallucination_risk_level: analysis.risk_level,
        overall_confidence: scores.overall_confidence,
        checks_performed: checks,
        detected_issues: analysis.detected_issues,
        recommendations: analysis.recommendations,
        source_attribution_score: scores.source_attribution_score,
        factual_accuracy_score: scores.factual_accuracy_score,
        logical_consistency_score: scores.logical_consistency_score,
        safe_to_proceed: safeToProceed
      };
      
      const processingTime = Date.now() - startTime;
      
      console.log('🔍 Hallucination Detection Agent Result:', {
        is_hallucination_detected: result.is_hallucination_detected,
        risk_level: result.hallucination_risk_level,
        safe_to_proceed: result.safe_to_proceed,
        overall_confidence: result.overall_confidence
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: 0, // Will be updated by AI calls
          confidence_score: scores.overall_confidence,
          safety_score: safeToProceed ? 1.0 : 0.0
        }
      };
      
    } catch (error) {
      console.error('Hallucination Detection Agent error:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        data: {
          is_hallucination_detected: true, // Default to detected on error
          hallucination_risk_level: 'high',
          overall_confidence: 0.2,
          checks_performed: [],
          detected_issues: ['Hallucination detection failed - response may be unreliable'],
          recommendations: ['Manual review recommended due to detection failure'],
          source_attribution_score: 0.2,
          factual_accuracy_score: 0.2,
          logical_consistency_score: 0.2,
          safe_to_proceed: false
        },
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: 0,
          confidence_score: 0.2,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async performHallucinationChecks(
    response: string,
    sourceResults: any[],
    userQuery: string,
    crossValidationResults?: any
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];
    
    // 1. Factual Accuracy Check
    const factualCheck = await this.checkFactualAccuracy(response, sourceResults, userQuery);
    checks.push(factualCheck);
    
    // 2. Logical Consistency Check
    const logicalCheck = await this.checkLogicalConsistency(response, userQuery);
    checks.push(logicalCheck);
    
    // 3. Source Attribution Check
    const attributionCheck = await this.checkSourceAttribution(response, sourceResults);
    checks.push(attributionCheck);
    
    // 4. Confidence Calibration Check
    const confidenceCheck = await this.checkConfidenceCalibration(response, sourceResults);
    checks.push(confidenceCheck);
    
    // 5. Contradiction Detection Check
    const contradictionCheck = await this.checkContradictions(response, sourceResults, crossValidationResults);
    checks.push(contradictionCheck);
    
    return checks;
  }

  private async checkFactualAccuracy(
    response: string,
    sourceResults: any[],
    userQuery: string
  ): Promise<HallucinationCheck> {
    try {
      const prompt = `You are a factual accuracy checker. Analyze if the response contains facts that can be verified against the provided source data.

USER QUERY: "${userQuery}"

GENERATED RESPONSE: "${response}"

SOURCE DATA:
${sourceResults.map((result, i) => `
Source ${i + 1} (${result.source_id || 'unknown'}):
${JSON.stringify(result.data, null, 2)}
`).join('\n')}

TASK: Check if all factual claims in the response can be supported by the source data.

Respond with JSON:
{
  "result": "passed|failed|warning",
  "confidence": 0.0-1.0,
  "details": "Explanation of findings",
  "evidence": ["List of specific evidence found or missing"]
}`;

      const aiResponse = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a factual accuracy checker. Verify claims against source data. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(aiResponse.content);
      
      return {
        check_type: 'factual_accuracy',
        result: result.result || 'warning',
        confidence: result.confidence || 0.5,
        details: result.details || 'Factual accuracy check completed',
        evidence: result.evidence || []
      };
      
    } catch (error) {
      console.warn('Factual accuracy check failed:', error);
      return {
        check_type: 'factual_accuracy',
        result: 'warning',
        confidence: 0.3,
        details: 'Factual accuracy check failed',
        evidence: ['Check failed due to error']
      };
    }
  }

  private async checkLogicalConsistency(response: string, userQuery: string): Promise<HallucinationCheck> {
    try {
      const prompt = `You are a logical consistency checker. Analyze if the response is logically consistent and coherent.

USER QUERY: "${userQuery}"

RESPONSE: "${response}"

TASK: Check for logical inconsistencies, contradictions, or incoherent statements.

Respond with JSON:
{
  "result": "passed|failed|warning",
  "confidence": 0.0-1.0,
  "details": "Explanation of logical consistency findings",
  "evidence": ["List of specific logical issues or confirmations"]
}`;

      const aiResponse = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a logical consistency checker. Analyze response coherence. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(aiResponse.content);
      
      return {
        check_type: 'logical_consistency',
        result: result.result || 'warning',
        confidence: result.confidence || 0.5,
        details: result.details || 'Logical consistency check completed',
        evidence: result.evidence || []
      };
      
    } catch (error) {
      console.warn('Logical consistency check failed:', error);
      return {
        check_type: 'logical_consistency',
        result: 'warning',
        confidence: 0.3,
        details: 'Logical consistency check failed',
        evidence: ['Check failed due to error']
      };
    }
  }

  private async checkSourceAttribution(response: string, sourceResults: any[]): Promise<HallucinationCheck> {
    try {
      const sourceIds = sourceResults.map(r => r.source_id || 'unknown').filter(id => id !== 'unknown');
      
      const prompt = `You are a source attribution checker. Analyze if the response properly attributes information to sources.

RESPONSE: "${response}"

AVAILABLE SOURCES: ${sourceIds.join(', ')}

TASK: Check if the response properly cites sources for factual claims.

Respond with JSON:
{
  "result": "passed|failed|warning",
  "confidence": 0.0-1.0,
  "details": "Explanation of source attribution quality",
  "evidence": ["List of attribution issues or confirmations"]
}`;

      const aiResponse = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a source attribution checker. Verify proper source citation. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(aiResponse.content);
      
      return {
        check_type: 'source_attribution',
        result: result.result || 'warning',
        confidence: result.confidence || 0.5,
        details: result.details || 'Source attribution check completed',
        evidence: result.evidence || []
      };
      
    } catch (error) {
      console.warn('Source attribution check failed:', error);
      return {
        check_type: 'source_attribution',
        result: 'warning',
        confidence: 0.3,
        details: 'Source attribution check failed',
        evidence: ['Check failed due to error']
      };
    }
  }

  private async checkConfidenceCalibration(response: string, sourceResults: any[]): Promise<HallucinationCheck> {
    try {
      const prompt = `You are a confidence calibration checker. Analyze if the response's confidence level matches the available data quality.

RESPONSE: "${response}"

AVAILABLE DATA SOURCES: ${sourceResults.length}

TASK: Check if the response's confidence level is appropriately calibrated to the data quality and availability.

Respond with JSON:
{
  "result": "passed|failed|warning",
  "confidence": 0.0-1.0,
  "details": "Explanation of confidence calibration",
  "evidence": ["List of confidence calibration issues or confirmations"]
}`;

      const aiResponse = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a confidence calibration checker. Verify appropriate confidence levels. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(aiResponse.content);
      
      return {
        check_type: 'confidence_calibration',
        result: result.result || 'warning',
        confidence: result.confidence || 0.5,
        details: result.details || 'Confidence calibration check completed',
        evidence: result.evidence || []
      };
      
    } catch (error) {
      console.warn('Confidence calibration check failed:', error);
      return {
        check_type: 'confidence_calibration',
        result: 'warning',
        confidence: 0.3,
        details: 'Confidence calibration check failed',
        evidence: ['Check failed due to error']
      };
    }
  }

  private async checkContradictions(
    response: string,
    sourceResults: any[],
    crossValidationResults?: any
  ): Promise<HallucinationCheck> {
    try {
      const prompt = `You are a contradiction detector. Analyze if the response contains contradictions with the source data or cross-validation results.

RESPONSE: "${response}"

SOURCE DATA:
${sourceResults.map((result, i) => `
Source ${i + 1} (${result.source_id || 'unknown'}):
${JSON.stringify(result.data, null, 2)}
`).join('\n')}

${crossValidationResults ? `
CROSS-VALIDATION RESULTS:
${JSON.stringify(crossValidationResults, null, 2)}
` : ''}

TASK: Check for contradictions between the response and source data.

Respond with JSON:
{
  "result": "passed|failed|warning",
  "confidence": 0.0-1.0,
  "details": "Explanation of contradiction findings",
  "evidence": ["List of specific contradictions or confirmations"]
}`;

      const aiResponse = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a contradiction detector. Find contradictions in responses. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(aiResponse.content);
      
      return {
        check_type: 'contradiction_detection',
        result: result.result || 'warning',
        confidence: result.confidence || 0.5,
        details: result.details || 'Contradiction detection check completed',
        evidence: result.evidence || []
      };
      
    } catch (error) {
      console.warn('Contradiction detection check failed:', error);
      return {
        check_type: 'contradiction_detection',
        result: 'warning',
        confidence: 0.3,
        details: 'Contradiction detection check failed',
        evidence: ['Check failed due to error']
      };
    }
  }

  private analyzeHallucinationChecks(checks: HallucinationCheck[]): {
    is_hallucination_detected: boolean;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    detected_issues: string[];
    recommendations: string[];
  } {
    const failedChecks = checks.filter(check => check.result === 'failed');
    const warningChecks = checks.filter(check => check.result === 'warning');
    
    const detectedIssues: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze failed checks
    failedChecks.forEach(check => {
      detectedIssues.push(`${check.check_type}: ${check.details}`);
      recommendations.push(`Address ${check.check_type} issues before proceeding`);
    });
    
    // Analyze warning checks
    warningChecks.forEach(check => {
      if (check.confidence < 0.5) {
        detectedIssues.push(`${check.check_type}: Low confidence (${check.confidence})`);
        recommendations.push(`Review ${check.check_type} for potential issues`);
      }
    });
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (failedChecks.length > 0) {
      riskLevel = failedChecks.length >= 3 ? 'critical' : failedChecks.length >= 2 ? 'high' : 'medium';
    } else if (warningChecks.length > 0) {
      riskLevel = warningChecks.length >= 3 ? 'medium' : 'low';
    }
    
    const isHallucinationDetected = failedChecks.length > 0 || 
      warningChecks.some(check => check.confidence < 0.4);
    
    return {
      is_hallucination_detected: isHallucinationDetected,
      risk_level: riskLevel,
      detected_issues: detectedIssues,
      recommendations: recommendations
    };
  }

  private calculateHallucinationScores(checks: HallucinationCheck[], sourceResults: any[]): {
    overall_confidence: number;
    source_attribution_score: number;
    factual_accuracy_score: number;
    logical_consistency_score: number;
  } {
    const factualCheck = checks.find(c => c.check_type === 'factual_accuracy');
    const logicalCheck = checks.find(c => c.check_type === 'logical_consistency');
    const attributionCheck = checks.find(c => c.check_type === 'source_attribution');
    
    const factualAccuracyScore = factualCheck ? factualCheck.confidence : 0.5;
    const logicalConsistencyScore = logicalCheck ? logicalCheck.confidence : 0.5;
    const sourceAttributionScore = attributionCheck ? attributionCheck.confidence : 0.5;
    
    const overallConfidence = (factualAccuracyScore + logicalConsistencyScore + sourceAttributionScore) / 3;
    
    return {
      overall_confidence: overallConfidence,
      source_attribution_score: sourceAttributionScore,
      factual_accuracy_score: factualAccuracyScore,
      logical_consistency_score: logicalConsistencyScore
    };
  }

  private determineSafety(analysis: any, scores: any): boolean {
    // Don't proceed if critical risk or very low confidence
    if (analysis.risk_level === 'critical' || scores.overall_confidence < 0.3) {
      return false;
    }
    
    // Don't proceed if hallucination detected and high risk
    if (analysis.is_hallucination_detected && analysis.risk_level === 'high') {
      return false;
    }
    
    // Proceed if low risk or medium risk with decent confidence
    return analysis.risk_level === 'low' || 
           (analysis.risk_level === 'medium' && scores.overall_confidence > 0.5);
  }
}
