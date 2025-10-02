/**
 * Agents Index
 * 
 * Exports all independent agents for the multi-agent flow
 */

export { GuardrailsAgent } from './guardrails-agent';
export { PromptEngineeringAgent } from './prompt-engineering-agent';
export { DataSourceFilterAgent } from './data-source-filter-agent';
export { MultiSourceQAAgent } from './multi-source-qa-agent';
export { VisualAgent } from './visual-agent';
export { GreetingAgent } from './greeting-agent';
export { ValidationAgent } from './validation-agent';
export { DatabaseExecutionAgent } from './database-execution-agent';
export { ExternalSearchAgent } from './external-search-agent';
export { FileExecutionAgent } from './file-execution-agent';
export { ExternalExecutionAgent } from './external-execution-agent';
export { AIGenerationAgent } from './ai-generation-agent';
export * from './conversation-context-agent';
export { BaseAgentWithTokenTracking } from './base-agent';

export * from './types';

// Agent registry for easy access
export const AGENT_REGISTRY = {
  guardrails: 'GuardrailsAgent',
  promptEngineering: 'PromptEngineeringAgent',
  dataSourceFilter: 'DataSourceFilterAgent',
  multiSourceQA: 'MultiSourceQAAgent',
  visual: 'VisualAgent'
} as const;

export type AgentName = keyof typeof AGENT_REGISTRY;
