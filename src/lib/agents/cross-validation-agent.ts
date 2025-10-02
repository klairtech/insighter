/**
 * Cross-Validation Agent
 * 
 * Validates results across multiple data sources to detect inconsistencies,
 * verify facts, and provide confidence scores for data reliability.
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
import { callAIWithOpenAIPrimary } from '../ai-utils';

export interface CrossValidationResult {
  source_id: string;
  data: any;
  confidence_score: number;
  validation_status: 'validated' | 'inconsistent' | 'unverified' | 'contradicted';
  inconsistencies: string[];
  supporting_sources: string[];
  contradicting_sources: string[];
}

export interface CrossValidationAgentResponse {
  overall_confidence: number;
  validation_results: CrossValidationResult[];
  inconsistencies_detected: boolean;
  recommendations: string[];
  data_quality_score: number;
  reliability_assessment: {
    high_confidence_sources: string[];
    medium_confidence_sources: string[];
    low_confidence_sources: string[];
  };
}

export class CrossValidationAgent implements BaseAgent {
  name = 'Cross-Validation Agent';
  description = 'Validates results across multiple data sources to detect inconsistencies and provide confidence scores';

  async execute(context: AgentContext & { sourceResults: any[] }): Promise<AgentResponse<CrossValidationAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Cross-Validation Agent: Validating results across sources...');
      
      const { sourceResults, userQuery } = context;
      
      if (!sourceResults || sourceResults.length === 0) {
        throw new Error('No source results available for cross-validation');
      }

      // Perform cross-validation analysis
      const validationResults = await this.performCrossValidation(sourceResults, userQuery);
      
      // Calculate overall confidence and data quality
      const overallConfidence = this.calculateOverallConfidence(validationResults);
      const dataQualityScore = this.calculateDataQualityScore(validationResults);
      
      // Detect inconsistencies
      const inconsistenciesDetected = validationResults.some(result => 
        result.validation_status === 'inconsistent' || result.validation_status === 'contradicted'
      );
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(validationResults, inconsistenciesDetected);
      
      // Assess source reliability
      const reliabilityAssessment = this.assessSourceReliability(validationResults);
      
      const result: CrossValidationAgentResponse = {
        overall_confidence: overallConfidence,
        validation_results: validationResults,
        inconsistencies_detected: inconsistenciesDetected,
        recommendations: recommendations,
        data_quality_score: dataQualityScore,
        reliability_assessment: reliabilityAssessment
      };
      
      const processingTime = Date.now() - startTime;
      
      console.log('🔍 Cross-Validation Agent Result:', {
        overall_confidence: result.overall_confidence,
        inconsistencies_detected: result.inconsistencies_detected,
        data_quality_score: result.data_quality_score,
        sources_validated: result.validation_results.length
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: 0, // Will be updated by AI calls
          confidence_score: overallConfidence,
          validation_completeness: validationResults.length / sourceResults.length
        }
      };
      
    } catch (error) {
      console.error('Cross-Validation Agent error:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        data: {
          overall_confidence: 0.3,
          validation_results: [],
          inconsistencies_detected: true,
          recommendations: ['Cross-validation failed - results may be unreliable'],
          data_quality_score: 0.3,
          reliability_assessment: {
            high_confidence_sources: [],
            medium_confidence_sources: [],
            low_confidence_sources: []
          }
        },
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: 0,
          confidence_score: 0.3,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async performCrossValidation(sourceResults: any[], userQuery: string): Promise<CrossValidationResult[]> {
    const validationResults: CrossValidationResult[] = [];
    
    for (const result of sourceResults) {
      if (!result.success || !result.data) {
        validationResults.push({
          source_id: result.source_id || 'unknown',
          data: result.data,
          confidence_score: 0.1,
          validation_status: 'unverified',
          inconsistencies: ['Source failed to provide data'],
          supporting_sources: [],
          contradicting_sources: []
        });
        continue;
      }

      // Perform AI-based cross-validation
      const validation = await this.validateSourceResult(result, sourceResults, userQuery);
      validationResults.push(validation);
    }
    
    return validationResults;
  }

  private async validateSourceResult(
    sourceResult: any, 
    allResults: any[], 
    userQuery: string
  ): Promise<CrossValidationResult> {
    try {
      const otherResults = allResults.filter(r => r !== sourceResult && r.success && r.data);
      
      const validationPrompt = `You are a data validation expert. Analyze the following data source result and cross-validate it against other sources.

USER QUERY: "${userQuery}"

SOURCE TO VALIDATE:
- Source ID: ${sourceResult.source_id || 'unknown'}
- Data: ${JSON.stringify(sourceResult.data, null, 2)}

OTHER SOURCES FOR COMPARISON:
${otherResults.map((r, i) => `
Source ${i + 1} (${r.source_id || 'unknown'}):
${JSON.stringify(r.data, null, 2)}
`).join('\n')}

VALIDATION TASKS:
1. Check if the data is consistent with other sources
2. Identify any contradictions or inconsistencies
3. Assess the reliability and completeness of the data
4. Determine confidence score (0.0-1.0)
5. Identify supporting and contradicting sources

Respond with JSON:
{
  "confidence_score": 0.85,
  "validation_status": "validated|inconsistent|unverified|contradicted",
  "inconsistencies": ["List of specific inconsistencies found"],
  "supporting_sources": ["Source IDs that support this data"],
  "contradicting_sources": ["Source IDs that contradict this data"],
  "reasoning": "Explanation of validation decision"
}`;

      const response = await callAIWithOpenAIPrimary([
        {
          role: 'system',
          content: 'You are a data validation expert. Cross-validate data sources and detect inconsistencies. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: validationPrompt
        }
      ], {
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const validation = JSON.parse(response.content);
      
      return {
        source_id: sourceResult.source_id || 'unknown',
        data: sourceResult.data,
        confidence_score: validation.confidence_score || 0.5,
        validation_status: validation.validation_status || 'unverified',
        inconsistencies: validation.inconsistencies || [],
        supporting_sources: validation.supporting_sources || [],
        contradicting_sources: validation.contradicting_sources || []
      };
      
    } catch (error) {
      console.warn('AI validation failed for source:', sourceResult.source_id, error);
      return {
        source_id: sourceResult.source_id || 'unknown',
        data: sourceResult.data,
        confidence_score: 0.3,
        validation_status: 'unverified',
        inconsistencies: ['AI validation failed'],
        supporting_sources: [],
        contradicting_sources: []
      };
    }
  }

  private calculateOverallConfidence(validationResults: CrossValidationResult[]): number {
    if (validationResults.length === 0) return 0;
    
    const totalConfidence = validationResults.reduce((sum, result) => sum + result.confidence_score, 0);
    return totalConfidence / validationResults.length;
  }

  private calculateDataQualityScore(validationResults: CrossValidationResult[]): number {
    if (validationResults.length === 0) return 0;
    
    const qualityFactors = validationResults.map(result => {
      let score = result.confidence_score;
      
      // Penalize inconsistencies
      if (result.validation_status === 'inconsistent') score *= 0.7;
      if (result.validation_status === 'contradicted') score *= 0.4;
      if (result.validation_status === 'unverified') score *= 0.6;
      
      // Bonus for supporting sources
      if (result.supporting_sources.length > 0) score *= 1.1;
      
      return Math.min(score, 1.0);
    });
    
    return qualityFactors.reduce((sum, score) => sum + score, 0) / qualityFactors.length;
  }

  private generateRecommendations(validationResults: CrossValidationResult[], inconsistenciesDetected: boolean): string[] {
    const recommendations: string[] = [];
    
    if (inconsistenciesDetected) {
      recommendations.push('⚠️ Data inconsistencies detected - results should be interpreted with caution');
    }
    
    const lowConfidenceSources = validationResults.filter(r => r.confidence_score < 0.5);
    if (lowConfidenceSources.length > 0) {
      recommendations.push(`🔍 ${lowConfidenceSources.length} sources have low confidence scores - consider additional verification`);
    }
    
    const contradictedSources = validationResults.filter(r => r.validation_status === 'contradicted');
    if (contradictedSources.length > 0) {
      recommendations.push(`❌ ${contradictedSources.length} sources show contradicted data - these results may be unreliable`);
    }
    
    const highConfidenceSources = validationResults.filter(r => r.confidence_score > 0.8);
    if (highConfidenceSources.length > 0) {
      recommendations.push(`✅ ${highConfidenceSources.length} sources have high confidence scores - these results are reliable`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All sources validated successfully - results appear reliable');
    }
    
    return recommendations;
  }

  private assessSourceReliability(validationResults: CrossValidationResult[]): {
    high_confidence_sources: string[];
    medium_confidence_sources: string[];
    low_confidence_sources: string[];
  } {
    const highConfidence: string[] = [];
    const mediumConfidence: string[] = [];
    const lowConfidence: string[] = [];
    
    validationResults.forEach(result => {
      if (result.confidence_score >= 0.8) {
        highConfidence.push(result.source_id);
      } else if (result.confidence_score >= 0.5) {
        mediumConfidence.push(result.source_id);
      } else {
        lowConfidence.push(result.source_id);
      }
    });
    
    return {
      high_confidence_sources: highConfidence,
      medium_confidence_sources: mediumConfidence,
      low_confidence_sources: lowConfidence
    };
  }
}
