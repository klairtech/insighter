/**
 * Visual Agent
 * 
 * Determines if and how to visualize data based on query and results
 */

import { BaseAgent, AgentContext, AgentResponse, VisualAgentResponse, DatabaseExecutionResult } from './types';
import { callAIWithClaudePrimary } from '../ai-utils';

export class VisualAgent implements BaseAgent {
  name = 'Visual Agent';
  description = 'Determines if and how to visualize data based on query and results';

  async execute(context: AgentContext & { sourceResults: DatabaseExecutionResult[]; qaResponse: { answer: string } }): Promise<AgentResponse<VisualAgentResponse>> {
    const startTime = Date.now();
    
    try {
      console.log('🎨 Visual Agent: Analyzing visualization needs...');
      
      const { userQuery, sourceResults, qaResponse } = context;
      
      // Check if we have data to visualize
      const hasData = sourceResults.some(result => result.success && result.data && result.data.length > 0);
      
      if (!hasData) {
        return {
          success: true,
          data: {
            should_visualize: false,
            reasoning: 'No data available for visualization',
            confidence: 1.0
          },
          metadata: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: 0,
            confidence_score: 1.0
          }
        };
      }
      
      // Analyze the query for visualization intent
      const visualizationIntent = this.analyzeVisualizationIntent(userQuery);
      
      // Analyze the data structure for visualization suitability
      const dataAnalysis = this.analyzeDataForVisualization(sourceResults);
      
      // Use AI to determine the best visualization approach
      const aiAnalysis = await this.performAIVisualizationAnalysis(userQuery, sourceResults, qaResponse);
      
      // Combine all analyses
      const shouldVisualize = visualizationIntent.shouldVisualize && 
                             dataAnalysis.suitableForVisualization && 
                             aiAnalysis.should_visualize;
      
      let visualizationConfig = null;
      if (shouldVisualize) {
        visualizationConfig = this.buildVisualizationConfig(
          aiAnalysis.visualization_type || 'chart',
          sourceResults,
          userQuery
        );
      }
      
      const result: VisualAgentResponse = {
        should_visualize: shouldVisualize,
        visualization_type: aiAnalysis.visualization_type as 'chart' | 'table' | 'graph' | 'map' | 'dashboard',
        visualization_config: visualizationConfig as { chart_type: string; data_mapping: Record<string, any>; styling: Record<string, any>; interactivity: Record<string, any>; } | undefined,
        reasoning: this.buildReasoning(visualizationIntent, dataAnalysis, aiAnalysis),
        confidence: Math.min(visualizationIntent.confidence, dataAnalysis.confidence, aiAnalysis.confidence),
        alternative_visualizations: aiAnalysis.alternative_visualizations || []
      };
      
      const processingTime = Date.now() - startTime;
      
      console.log('🎨 Visual Agent Result:', {
        should_visualize: result.should_visualize,
        visualization_type: result.visualization_type,
        confidence: result.confidence
      });
      
      return {
        success: true,
        data: result,
        metadata: {
          processing_time_ms: processingTime,
          tokens_used: aiAnalysis.tokensUsed,
          confidence_score: result.confidence
        }
      };
      
    } catch (error) {
      console.error('Visual Agent error:', error);
      
      return {
        success: true,
        data: {
          should_visualize: false,
          reasoning: 'Error occurred during visualization analysis',
          confidence: 0.3
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

  private analyzeVisualizationIntent(userQuery: string): { shouldVisualize: boolean; confidence: number } {
    const query = userQuery.toLowerCase();
    
    // Strong visualization indicators
    const strongIndicators = [
      'show', 'display', 'visualize', 'chart', 'graph', 'plot',
      'trend', 'trends', 'over time', 'comparison', 'compare',
      'distribution', 'histogram', 'bar chart', 'line chart',
      'pie chart', 'scatter plot', 'dashboard'
    ];
    
    // Moderate visualization indicators
    const moderateIndicators = [
      'how many', 'count', 'total', 'sum', 'average', 'mean',
      'top', 'bottom', 'highest', 'lowest', 'most', 'least',
      'breakdown', 'by category', 'by type', 'group by'
    ];
    
    // Check for strong indicators
    const hasStrongIndicators = strongIndicators.some(indicator => query.includes(indicator));
    if (hasStrongIndicators) {
      return { shouldVisualize: true, confidence: 0.9 };
    }
    
    // Check for moderate indicators
    const hasModerateIndicators = moderateIndicators.some(indicator => query.includes(indicator));
    if (hasModerateIndicators) {
      return { shouldVisualize: true, confidence: 0.7 };
    }
    
    // Check for numerical data patterns
    const hasNumericalPatterns = /\d+|\b(count|total|sum|average|percentage|rate|ratio)\b/.test(query);
    if (hasNumericalPatterns) {
      return { shouldVisualize: true, confidence: 0.6 };
    }
    
    return { shouldVisualize: false, confidence: 0.8 };
  }

  private analyzeDataForVisualization(sourceResults: DatabaseExecutionResult[]): { suitableForVisualization: boolean; confidence: number } {
    const successfulResults = sourceResults.filter(r => r.success && r.data && r.data.length > 0);
    
    if (successfulResults.length === 0) {
      return { suitableForVisualization: false, confidence: 1.0 };
    }
    
    // Analyze data structure
    let hasNumericalData = false;
    let hasCategoricalData = false;
    let _hasTimeData = false;
    let totalRows = 0;
    
    for (const result of successfulResults) {
      totalRows += result.data?.length || 0;
      
      if (result.data && result.data.length > 0) {
        const sample = result.data[0];
        const columns = Object.keys(sample);
        
        for (const column of columns) {
          const value = sample[column];
          
          // Check for numerical data
          if (typeof value === 'number' || !isNaN(Number(value))) {
            hasNumericalData = true;
          }
          
          // Check for categorical data
          if (typeof value === 'string' && value.length < 50) {
            hasCategoricalData = true;
          }
          
          // Check for time data
          if (column.toLowerCase().includes('date') || 
              column.toLowerCase().includes('time') ||
              column.toLowerCase().includes('created') ||
              column.toLowerCase().includes('updated')) {
            _hasTimeData = true;
          }
        }
      }
    }
    
    // Determine suitability
    const hasGoodDataSize = totalRows >= 2 && totalRows <= 10000;
    const hasVisualizableData = hasNumericalData || hasCategoricalData;
    
    if (hasGoodDataSize && hasVisualizableData) {
      return { suitableForVisualization: true, confidence: 0.9 };
    } else if (hasVisualizableData) {
      return { suitableForVisualization: true, confidence: 0.6 };
    } else {
      return { suitableForVisualization: false, confidence: 0.8 };
    }
  }

  private async performAIVisualizationAnalysis(userQuery: string, sourceResults: DatabaseExecutionResult[], qaResponse: { answer: string }): Promise<{
    should_visualize: boolean;
    visualization_type: string;
    confidence: number;
    reasoning: string;
    alternative_visualizations: Array<{ type: string; description: string; confidence: number }>;
    tokensUsed: number;
  }> {
    const dataSummary = sourceResults
      .filter(r => r.success && r.data)
      .map(r => ({
        source: r.source_name,
        rows: r.data?.length || 0,
        columns: Object.keys(r.data?.[0] || {}),
        sample_data: r.data?.slice(0, 2)
      }));
    
    const analysisPrompt = `Analyze if this query and data should be visualized and determine the best visualization approach.

USER QUERY: "${userQuery}"

QA RESPONSE: "${qaResponse.answer}"

DATA SUMMARY:
${dataSummary.map(d => `
Source: ${d.source}
Rows: ${d.rows}
Columns: ${d.columns.join(', ')}
Sample: ${JSON.stringify(d.sample_data, null, 2)}
`).join('\n')}

Determine:
1. Should this data be visualized?
2. What type of visualization would be most effective?
3. What are alternative visualization options?

Visualization Types:
- chart: General chart (bar, line, pie, etc.)
- table: Data table
- graph: Network/graph visualization
- map: Geographic visualization
- dashboard: Multiple visualizations

Respond with JSON:
{
  "should_visualize": true/false,
  "visualization_type": "chart/table/graph/map/dashboard",
  "confidence": 0.0-1.0,
  "reasoning": "Why this visualization approach",
  "alternative_visualizations": [
    {
      "type": "chart",
      "description": "Alternative approach",
      "confidence": 0.0-1.0
    }
  ]
}`;

    try {
      const response = await callAIWithClaudePrimary([
        {
          role: 'system',
          content: 'You are a data visualization expert. Analyze queries and data to determine the best visualization approach. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ], {
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.content);
      return {
        ...result,
        tokensUsed: response.tokens_used
      };
    } catch (error) {
      console.warn('AI visualization analysis failed, using fallback:', error);
      return {
        should_visualize: true,
        visualization_type: 'chart',
        confidence: 0.5,
        reasoning: 'Fallback analysis',
        alternative_visualizations: [],
        tokensUsed: 0
      };
    }
  }

  private buildVisualizationConfig(type: string, sourceResults: DatabaseExecutionResult[], userQuery: string): Record<string, unknown> {
    const successfulResults = sourceResults.filter(r => r.success && r.data && r.data.length > 0);
    
    if (successfulResults.length === 0) {
      return {} as Record<string, unknown>;
    }
    
    // Get the first successful result for configuration
    const primaryResult = successfulResults[0];
    const data = primaryResult.data || [];
    const columns = Object.keys(data[0] || {});
    
    // Basic configuration based on visualization type
    const baseConfig = {
      chart_type: this.determineChartType(type, columns, userQuery),
      data_mapping: this.buildDataMapping(columns, data),
      styling: {
        title: this.generateChartTitle(userQuery),
        colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'],
        responsive: true
      },
      interactivity: {
        tooltips: true,
        zoom: type === 'chart',
        filter: true
      }
    };
    
    return baseConfig;
  }

  private determineChartType(visualizationType: string, columns: string[], userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (visualizationType === 'table') return 'table';
    if (visualizationType === 'map') return 'map';
    
    // Determine chart type based on query and data
    if (query.includes('trend') || query.includes('over time')) {
      return 'line';
    } else if (query.includes('compare') || query.includes('vs')) {
      return 'bar';
    } else if (query.includes('distribution') || query.includes('breakdown')) {
      return 'pie';
    } else if (query.includes('correlation') || query.includes('relationship')) {
      return 'scatter';
    } else if (columns.some(col => col.toLowerCase().includes('date'))) {
      return 'line';
    } else if (columns.length <= 2) {
      return 'bar';
    } else {
      return 'bar'; // Default
    }
  }

  private buildDataMapping(columns: string[], data: Record<string, unknown>[]): Record<string, unknown> {
    const mapping: Record<string, unknown> = {};
    
    // Map columns to appropriate chart dimensions
    columns.forEach((column, _index) => {
      if (column.toLowerCase().includes('date') || column.toLowerCase().includes('time')) {
        mapping.x = column;
      } else if (typeof data[0]?.[column] === 'number') {
        if (!mapping.y) {
          mapping.y = column;
        } else if (!mapping.y2) {
          mapping.y2 = column;
        }
      } else {
        if (!mapping.category) {
          mapping.category = column;
        }
      }
    });
    
    return mapping;
  }

  private generateChartTitle(userQuery: string): string {
    // Extract key terms from the query for the title
    const words = userQuery.split(' ').filter(word => 
      word.length > 3 && 
      !['how', 'many', 'what', 'show', 'me', 'the', 'and', 'for', 'in', 'on', 'at'].includes(word.toLowerCase())
    );
    
    return words.slice(0, 4).join(' ').replace(/[?.,!]/g, '') || 'Data Visualization';
  }

  private buildReasoning(visualizationIntent: { shouldVisualize: boolean; confidence: number }, dataAnalysis: { suitableForVisualization: boolean; confidence: number }, aiAnalysis: { should_visualize: boolean; confidence: number }): string {
    const reasons = [];
    
    if (visualizationIntent.shouldVisualize) {
      reasons.push('Query indicates visualization intent');
    }
    
    if (dataAnalysis.suitableForVisualization) {
      reasons.push('Data is suitable for visualization');
    }
    
    if (aiAnalysis.should_visualize) {
      reasons.push('AI analysis recommends visualization');
    }
    
    return reasons.join('; ') || 'No clear visualization need identified';
  }
}
