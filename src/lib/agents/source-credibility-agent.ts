/**
 * Source Credibility Assessment Agent
 * 
 * Assesses the credibility and reliability of data sources based on:
 * - Data freshness and update frequency
 * - Historical accuracy and success rates
 * - Data completeness and quality
 * - Source reputation and usage patterns
 */

import { BaseAgent, AgentContext, AgentResponse } from './types';
// import { callAIWithOpenAIPrimary } from '../ai-utils';

export interface SourceCredibilityMetrics {
  source_id: string;
  credibility_score: number; // 0.0 - 1.0
  data_freshness_score: number;
  completeness_score: number;
  reliability_score: number;
  usage_frequency_score: number;
  last_updated: string;
  update_frequency: 'high' | 'medium' | 'low' | 'unknown';
  data_quality_indicators: {
    has_missing_values: boolean;
    has_duplicates: boolean;
    has_outliers: boolean;
    schema_consistency: boolean;
  };
  historical_performance: {
    success_rate: number;
    error_rate: number;
    average_response_time: number;
    last_error_date?: string;
  };
  recommendations: string[];
}

export interface SourceCredibilityAgentResponse {
  overall_credibility_score: number;
  source_metrics: SourceCredibilityMetrics[];
  high_credibility_sources: string[];
  medium_credibility_sources: string[];
  low_credibility_sources: string[];
  credibility_warnings: string[];
  recommendations: string[];
  data_quality_summary: {
    total_sources: number;
    high_quality_sources: number;
    medium_quality_sources: number;
    low_quality_sources: number;
    average_credibility: number;
  };
}

export class SourceCredibilityAgent implements BaseAgent {
  name = 'Source Credibility Assessment Agent';
  description = 'Assesses the credibility and reliability of data sources based on multiple quality metrics';

  async execute(context: AgentContext & { sourceResults: any[] }): Promise<AgentResponse<SourceCredibilityAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Source Credibility Agent: Assessing source credibility...');
      
      const { sourceResults, workspaceId } = context;
      
      if (!sourceResults || sourceResults.length === 0) {
        throw new Error('No source results available for credibility assessment');
      }

      // Assess credibility for each source
      const sourceMetrics = await this.assessSourceCredibility(sourceResults, workspaceId);
      
      // Calculate overall metrics
      const overallCredibilityScore = this.calculateOverallCredibility(sourceMetrics);
      
      // Categorize sources by credibility
      const credibilityCategories = this.categorizeSourcesByCredibility(sourceMetrics);
      
      // Generate warnings and recommendations
      const warnings = this.generateCredibilityWarnings(sourceMetrics);
      const recommendations = this.generateCredibilityRecommendations(sourceMetrics, warnings);
      
      // Create data quality summary
      const dataQualitySummary = this.createDataQualitySummary(sourceMetrics);
      
      const result: SourceCredibilityAgentResponse = {
        overall_credibility_score: overallCredibilityScore,
        source_metrics: sourceMetrics,
        high_credibility_sources: credibilityCategories.high,
        medium_credibility_sources: credibilityCategories.medium,
        low_credibility_sources: credibilityCategories.low,
        credibility_warnings: warnings,
        recommendations: recommendations,
        data_quality_summary: dataQualitySummary
      };
      
      const processingTime = Date.now() - startTime;
      
      console.log('🔍 Source Credibility Agent Result:', {
        overall_credibility_score: result.overall_credibility_score,
        high_credibility_sources: result.high_credibility_sources.length,
        medium_credibility_sources: result.medium_credibility_sources.length,
        low_credibility_sources: result.low_credibility_sources.length
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: 0, // Will be updated by AI calls
          confidence_score: overallCredibilityScore,
          sources_assessed: sourceMetrics.length
        }
      };
      
    } catch (error) {
      console.error('Source Credibility Agent error:', error);
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        data: {
          overall_credibility_score: 0.3,
          source_metrics: [],
          high_credibility_sources: [],
          medium_credibility_sources: [],
          low_credibility_sources: [],
          credibility_warnings: ['Source credibility assessment failed'],
          recommendations: ['Manual review of source reliability recommended'],
          data_quality_summary: {
            total_sources: 0,
            high_quality_sources: 0,
            medium_quality_sources: 0,
            low_quality_sources: 0,
            average_credibility: 0.3
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

  private async assessSourceCredibility(sourceResults: any[], workspaceId: string): Promise<SourceCredibilityMetrics[]> {
    const metrics: SourceCredibilityMetrics[] = [];
    
    for (const result of sourceResults) {
      try {
        const sourceMetrics = await this.assessIndividualSource(result, workspaceId);
        metrics.push(sourceMetrics);
      } catch (error) {
        console.warn(`Failed to assess credibility for source ${result.source_id}:`, error);
        // Add default low-credibility metrics
        metrics.push({
          source_id: result.source_id || 'unknown',
          credibility_score: 0.2,
          data_freshness_score: 0.2,
          completeness_score: 0.2,
          reliability_score: 0.2,
          usage_frequency_score: 0.2,
          last_updated: new Date().toISOString(),
          update_frequency: 'unknown',
          data_quality_indicators: {
            has_missing_values: true,
            has_duplicates: false,
            has_outliers: false,
            schema_consistency: false
          },
          historical_performance: {
            success_rate: 0.2,
            error_rate: 0.8,
            average_response_time: 5000,
            last_error_date: new Date().toISOString()
          },
          recommendations: ['Source assessment failed - manual review required']
        });
      }
    }
    
    return metrics;
  }

  private async assessIndividualSource(sourceResult: any, workspaceId: string): Promise<SourceCredibilityMetrics> {
    const sourceId = sourceResult.source_id || 'unknown';
    
    // Get historical performance data (this would come from your database)
    const historicalPerformance = await this.getHistoricalPerformance(sourceId, workspaceId);
    
    // Assess data quality
    const dataQuality = await this.assessDataQuality(sourceResult);
    
    // Calculate individual scores
    const dataFreshnessScore = this.calculateDataFreshnessScore(sourceResult);
    const completenessScore = this.calculateCompletenessScore(sourceResult);
    const reliabilityScore = this.calculateReliabilityScore(historicalPerformance);
    const usageFrequencyScore = this.calculateUsageFrequencyScore(sourceId, workspaceId);
    
    // Calculate overall credibility score
    const credibilityScore = (
      dataFreshnessScore * 0.25 +
      completenessScore * 0.25 +
      reliabilityScore * 0.30 +
      usageFrequencyScore * 0.20
    );
    
    // Generate recommendations
    const recommendations = this.generateSourceRecommendations({
      credibilityScore,
      dataFreshnessScore,
      completenessScore,
      reliabilityScore,
      usageFrequencyScore,
      dataQuality
    });
    
    return {
      source_id: sourceId,
      credibility_score: credibilityScore,
      data_freshness_score: dataFreshnessScore,
      completeness_score: completenessScore,
      reliability_score: reliabilityScore,
      usage_frequency_score: usageFrequencyScore,
      last_updated: sourceResult.last_updated || new Date().toISOString(),
      update_frequency: this.determineUpdateFrequency(sourceResult),
      data_quality_indicators: dataQuality,
      historical_performance: historicalPerformance,
      recommendations: recommendations
    };
  }

  private async getHistoricalPerformance(sourceId: string, workspaceId: string): Promise<{
    success_rate: number;
    error_rate: number;
    average_response_time: number;
    last_error_date?: string;
  }> {
    try {
      // This would query your database for historical performance data
      // For now, return mock data
      return {
        success_rate: 0.85,
        error_rate: 0.15,
        average_response_time: 2000,
        last_error_date: undefined
      };
    } catch (error) {
      console.warn('Failed to get historical performance:', error);
      return {
        success_rate: 0.5,
        error_rate: 0.5,
        average_response_time: 5000,
        last_error_date: new Date().toISOString()
      };
    }
  }

  private async assessDataQuality(sourceResult: any): Promise<{
    has_missing_values: boolean;
    has_duplicates: boolean;
    has_outliers: boolean;
    schema_consistency: boolean;
  }> {
    try {
      if (!sourceResult.data) {
        return {
          has_missing_values: true,
          has_duplicates: false,
          has_outliers: false,
          schema_consistency: false
        };
      }
      
      const data = sourceResult.data;
      let hasMissingValues = false;
      let hasDuplicates = false;
      let hasOutliers = false;
      let schemaConsistency = true;
      
      if (Array.isArray(data)) {
        // Check for missing values
        hasMissingValues = data.some(row => 
          Object.values(row).some(value => value === null || value === undefined || value === '')
        );
        
        // Check for duplicates (simplified)
        const uniqueRows = new Set(data.map(row => JSON.stringify(row)));
        hasDuplicates = uniqueRows.size < data.length;
        
        // Check for outliers (simplified - would need more sophisticated analysis)
        hasOutliers = this.detectOutliers(data);
        
        // Check schema consistency
        if (data.length > 0) {
          const firstRowKeys = Object.keys(data[0]);
          schemaConsistency = data.every(row => 
            Object.keys(row).length === firstRowKeys.length &&
            firstRowKeys.every(key => key in row)
          );
        }
      }
      
      return {
        has_missing_values: hasMissingValues,
        has_duplicates: hasDuplicates,
        has_outliers: hasOutliers,
        schema_consistency: schemaConsistency
      };
      
    } catch (error) {
      console.warn('Data quality assessment failed:', error);
      return {
        has_missing_values: true,
        has_duplicates: false,
        has_outliers: false,
        schema_consistency: false
      };
    }
  }

  private detectOutliers(data: any[]): boolean {
    // Simplified outlier detection
    // In a real implementation, this would use statistical methods
    try {
      if (data.length < 3) return false;
      
      // Check numeric columns for outliers
      const numericColumns = this.getNumericColumns(data);
      
      for (const column of numericColumns) {
        const values = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
        if (values.length < 3) continue;
        
        const sorted = values.sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const outliers = values.filter(v => v < lowerBound || v > upperBound);
        if (outliers.length > values.length * 0.1) { // More than 10% outliers
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private getNumericColumns(data: any[]): string[] {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow).filter(key => {
      const value = firstRow[key];
      return typeof value === 'number' || !isNaN(parseFloat(value));
    });
  }

  private calculateDataFreshnessScore(sourceResult: any): number {
    try {
      const lastUpdated = sourceResult.last_updated;
      if (!lastUpdated) return 0.5;
      
      const updateDate = new Date(lastUpdated);
      const now = new Date();
      const daysSinceUpdate = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Score based on how recent the data is
      if (daysSinceUpdate <= 1) return 1.0;
      if (daysSinceUpdate <= 7) return 0.8;
      if (daysSinceUpdate <= 30) return 0.6;
      if (daysSinceUpdate <= 90) return 0.4;
      return 0.2;
    } catch (error) {
      return 0.3;
    }
  }

  private calculateCompletenessScore(sourceResult: any): number {
    try {
      if (!sourceResult.data) return 0.0;
      
      const data = sourceResult.data;
      if (Array.isArray(data) && data.length === 0) return 0.0;
      
      // Check data completeness
      let totalFields = 0;
      let missingFields = 0;
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          Object.values(row).forEach(value => {
            totalFields++;
            if (value === null || value === undefined || value === '') {
              missingFields++;
            }
          });
        });
      } else if (typeof data === 'object') {
        Object.values(data).forEach(value => {
          totalFields++;
          if (value === null || value === undefined || value === '') {
            missingFields++;
          }
        });
      }
      
      if (totalFields === 0) return 0.0;
      return 1.0 - (missingFields / totalFields);
    } catch (error) {
      return 0.3;
    }
  }

  private calculateReliabilityScore(historicalPerformance: any): number {
    try {
      const successRate = historicalPerformance.success_rate || 0.5;
      const errorRate = historicalPerformance.error_rate || 0.5;
      const responseTime = historicalPerformance.average_response_time || 5000;
      
      // Score based on success rate and response time
      let score = successRate;
      
      // Penalize high error rates
      if (errorRate > 0.2) score *= 0.7;
      if (errorRate > 0.5) score *= 0.5;
      
      // Penalize slow response times
      if (responseTime > 10000) score *= 0.8;
      if (responseTime > 30000) score *= 0.6;
      
      return Math.min(score, 1.0);
    } catch (error) {
      return 0.3;
    }
  }

  private calculateUsageFrequencyScore(sourceId: string, workspaceId: string): number {
    try {
      // This would query your database for usage frequency
      // For now, return a mock score
      return 0.7;
    } catch (error) {
      return 0.3;
    }
  }

  private determineUpdateFrequency(sourceResult: any): 'high' | 'medium' | 'low' | 'unknown' {
    try {
      const lastUpdated = sourceResult.last_updated;
      if (!lastUpdated) return 'unknown';
      
      const updateDate = new Date(lastUpdated);
      const now = new Date();
      const daysSinceUpdate = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate <= 1) return 'high';
      if (daysSinceUpdate <= 7) return 'medium';
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  private generateSourceRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.credibilityScore < 0.5) {
      recommendations.push('⚠️ Low credibility score - consider additional verification');
    }
    
    if (metrics.dataFreshnessScore < 0.5) {
      recommendations.push('📅 Data appears stale - check for more recent updates');
    }
    
    if (metrics.completenessScore < 0.7) {
      recommendations.push('📊 Data completeness issues detected - review missing values');
    }
    
    if (metrics.reliabilityScore < 0.6) {
      recommendations.push('🔧 Reliability concerns - check historical performance');
    }
    
    if (metrics.dataQuality.has_missing_values) {
      recommendations.push('❓ Missing values detected - consider data cleaning');
    }
    
    if (metrics.dataQuality.has_duplicates) {
      recommendations.push('🔄 Duplicate records found - consider deduplication');
    }
    
    if (metrics.dataQuality.has_outliers) {
      recommendations.push('📈 Outliers detected - verify data accuracy');
    }
    
    if (!metrics.dataQuality.schema_consistency) {
      recommendations.push('🏗️ Schema inconsistency - review data structure');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Source appears reliable and well-maintained');
    }
    
    return recommendations;
  }

  private calculateOverallCredibility(sourceMetrics: SourceCredibilityMetrics[]): number {
    if (sourceMetrics.length === 0) return 0;
    
    const totalScore = sourceMetrics.reduce((sum, metric) => sum + metric.credibility_score, 0);
    return totalScore / sourceMetrics.length;
  }

  private categorizeSourcesByCredibility(sourceMetrics: SourceCredibilityMetrics[]): {
    high: string[];
    medium: string[];
    low: string[];
  } {
    const high: string[] = [];
    const medium: string[] = [];
    const low: string[] = [];
    
    sourceMetrics.forEach(metric => {
      if (metric.credibility_score >= 0.8) {
        high.push(metric.source_id);
      } else if (metric.credibility_score >= 0.5) {
        medium.push(metric.source_id);
      } else {
        low.push(metric.source_id);
      }
    });
    
    return { high, medium, low };
  }

  private generateCredibilityWarnings(sourceMetrics: SourceCredibilityMetrics[]): string[] {
    const warnings: string[] = [];
    
    const lowCredibilitySources = sourceMetrics.filter(m => m.credibility_score < 0.5);
    if (lowCredibilitySources.length > 0) {
      warnings.push(`⚠️ ${lowCredibilitySources.length} sources have low credibility scores`);
    }
    
    const staleSources = sourceMetrics.filter(m => m.data_freshness_score < 0.3);
    if (staleSources.length > 0) {
      warnings.push(`📅 ${staleSources.length} sources have stale data`);
    }
    
    const incompleteSources = sourceMetrics.filter(m => m.completeness_score < 0.5);
    if (incompleteSources.length > 0) {
      warnings.push(`📊 ${incompleteSources.length} sources have completeness issues`);
    }
    
    const unreliableSources = sourceMetrics.filter(m => m.reliability_score < 0.4);
    if (unreliableSources.length > 0) {
      warnings.push(`🔧 ${unreliableSources.length} sources have reliability concerns`);
    }
    
    return warnings;
  }

  private generateCredibilityRecommendations(sourceMetrics: SourceCredibilityMetrics[], warnings: string[]): string[] {
    const recommendations: string[] = [];
    
    if (warnings.length > 0) {
      recommendations.push('🔍 Review sources with credibility warnings before making decisions');
    }
    
    const highCredibilityCount = sourceMetrics.filter(m => m.credibility_score >= 0.8).length;
    if (highCredibilityCount > 0) {
      recommendations.push(`✅ ${highCredibilityCount} sources have high credibility - prioritize these for analysis`);
    }
    
    const mediumCredibilityCount = sourceMetrics.filter(m => m.credibility_score >= 0.5 && m.credibility_score < 0.8).length;
    if (mediumCredibilityCount > 0) {
      recommendations.push(`⚠️ ${mediumCredibilityCount} sources have medium credibility - use with caution`);
    }
    
    const lowCredibilityCount = sourceMetrics.filter(m => m.credibility_score < 0.5).length;
    if (lowCredibilityCount > 0) {
      recommendations.push(`❌ ${lowCredibilityCount} sources have low credibility - consider excluding from analysis`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ All sources appear to have acceptable credibility levels');
    }
    
    return recommendations;
  }

  private createDataQualitySummary(sourceMetrics: SourceCredibilityMetrics[]): {
    total_sources: number;
    high_quality_sources: number;
    medium_quality_sources: number;
    low_quality_sources: number;
    average_credibility: number;
  } {
    const total = sourceMetrics.length;
    const high = sourceMetrics.filter(m => m.credibility_score >= 0.8).length;
    const medium = sourceMetrics.filter(m => m.credibility_score >= 0.5 && m.credibility_score < 0.8).length;
    const low = sourceMetrics.filter(m => m.credibility_score < 0.5).length;
    const average = total > 0 ? sourceMetrics.reduce((sum, m) => sum + m.credibility_score, 0) / total : 0;
    
    return {
      total_sources: total,
      high_quality_sources: high,
      medium_quality_sources: medium,
      low_quality_sources: low,
      average_credibility: average
    };
  }
}
