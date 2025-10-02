import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/server-utils';
import { generateAgentApiToken } from '@/lib/jwt-utils';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // This is an admin endpoint - you might want to add additional security checks
    const { admin_key } = await request.json();
    
    // Simple admin key check (you should use a proper admin authentication system)
    if (admin_key !== process.env.ADMIN_MIGRATION_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all agents without API tokens
    const { data: agentsWithoutTokens, error: fetchError } = await supabaseServer
      .from('ai_agents')
      .select('id, name, workspace_id, status, created_by')
      .is('api_token', null);

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    if (!agentsWithoutTokens || agentsWithoutTokens.length === 0) {
      return NextResponse.json({ 
        message: 'No agents found without API tokens',
        migrated_count: 0
      });
    }

    const migratedAgents = [];
    const errors = [];

    // Generate API tokens for each agent
    for (const agent of agentsWithoutTokens) {
      try {
        const apiToken = generateAgentApiToken(agent.id, agent.workspace_id, agent.created_by);
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1); // 1 year from now

        const { error: updateError } = await supabaseServer
          .from('ai_agents')
          .update({
            api_token: apiToken,
            api_token_expires_at: tokenExpiresAt.toISOString(),
            api_enabled: agent.status === 'active', // Only enable for active agents
            api_rate_limit: 100,
            api_usage_count: 0
          })
          .eq('id', agent.id);

        if (updateError) {
          console.error(`Error updating agent ${agent.id}:`, updateError);
          errors.push({
            agent_id: agent.id,
            agent_name: agent.name,
            error: updateError.message
          });
        } else {
          migratedAgents.push({
            agent_id: agent.id,
            agent_name: agent.name,
            workspace_id: agent.workspace_id,
            api_token: apiToken,
            api_enabled: agent.status === 'active'
          });
        }
      } catch (error) {
        console.error(`Error processing agent ${agent.id}:`, error);
        errors.push({
          agent_id: agent.id,
          agent_name: agent.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Migration completed. ${migratedAgents.length} agents migrated successfully.`,
      migrated_count: migratedAgents.length,
      error_count: errors.length,
      migrated_agents: migratedAgents,
      errors: errors
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  // Get status of agents without API tokens
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data: agentsWithoutTokens, error } = await supabaseServer
      .from('ai_agents')
      .select('id, name, workspace_id, status, api_token, api_enabled')
      .is('api_token', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    const { data: allAgents, error: allError } = await supabaseServer
      .from('ai_agents')
      .select('id, name, workspace_id, status, api_token, api_enabled');

    if (allError) {
      return NextResponse.json({ error: 'Failed to fetch all agents' }, { status: 500 });
    }

    return NextResponse.json({
      total_agents: allAgents?.length || 0,
      agents_without_tokens: agentsWithoutTokens?.length || 0,
      agents_with_tokens: (allAgents?.length || 0) - (agentsWithoutTokens?.length || 0),
      agents_needing_migration: agentsWithoutTokens || []
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
