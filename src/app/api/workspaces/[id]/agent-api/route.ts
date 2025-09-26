import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    const { id: workspaceId } = await params;
    console.log(`[API] Starting agent-api request for workspace: ${workspaceId}`);
    
    const supabase = await createServerSupabaseClient();
    console.log(`[API] Supabase client created in ${Date.now() - startTime}ms`);
    
    // Verify user session
    const userStartTime = Date.now();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log(`[API] User verification completed in ${Date.now() - userStartTime}ms`);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[API] Current user: ${user.email} (ID: ${user.id})`);

    // Check if user has access to this workspace
    const workspaceStartTime = Date.now();
    
    // First, get the workspace to find its organization
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, organization_id')
      .eq('id', workspaceId)
      .eq('status', 'active')
      .single();
    console.log(`[API] Workspace query completed in ${Date.now() - workspaceStartTime}ms`);

    if (workspaceError || !workspace) {
      console.log(`[API] Workspace not found:`, workspaceError);
      return NextResponse.json({ 
        error: 'Workspace not found',
        details: workspaceError?.message || 'No workspace found',
        workspaceId,
        userId: user.id
      }, { status: 404 });
    }

    // Check if user is a member of the organization that owns this workspace
    const membershipStartTime = Date.now();
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single();
    console.log(`[API] Membership check completed in ${Date.now() - membershipStartTime}ms`);

    if (membershipError || !membership) {
      console.log(`[API] User ${user.id} not a member of organization ${workspace.organization_id}:`, membershipError);
      return NextResponse.json({ 
        error: 'Access denied',
        details: 'User not a member of the organization that owns this workspace',
        workspaceId,
        userId: user.id,
        organizationId: workspace.organization_id
      }, { status: 403 });
    }

    // Get agent details
    const agentStartTime = Date.now();
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select(`
        id,
        name,
        status,
        api_enabled,
        api_token,
        api_token_expires_at,
        api_rate_limit,
        api_usage_count,
        last_api_used_at,
        created_at
      `)
      .eq('workspace_id', workspaceId)
      .single();
    console.log(`[API] Agent query completed in ${Date.now() - agentStartTime}ms`);

    if (agentError || !agent) {
      console.log('Agent not found for workspace:', workspaceId, 'Error:', agentError);
      return NextResponse.json({ 
        agent: null,
        message: 'No agent found for this workspace',
        error: agentError?.message || 'Agent not found',
        workspaceId,
        userId: user.id
      }, { status: 200 }); // Return 200 with null agent instead of 404
    }

    // If agent doesn't have API fields, create them
    if (!agent.api_token) {
      const jwtStartTime = Date.now();
      const { generateAgentApiToken } = await import('@/lib/jwt-utils');
      const newApiToken = generateAgentApiToken(agent.id, workspaceId, user.id);
      console.log(`[API] JWT token generation completed in ${Date.now() - jwtStartTime}ms`);
      
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1); // 1 year from now

      const { error: updateError } = await supabaseServer
        .from('ai_agents')
        .update({
          api_token: newApiToken,
          api_token_expires_at: tokenExpiresAt.toISOString(),
          api_enabled: true,
          api_rate_limit: 100,
          api_usage_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agent.id);

      if (updateError) {
        console.error('Error updating agent with API fields:', updateError);
        return NextResponse.json({ error: 'Failed to initialize API for agent' }, { status: 500 });
      }

      // Update the agent object with the new fields
      agent.api_token = newApiToken;
      agent.api_token_expires_at = tokenExpiresAt.toISOString();
      agent.api_enabled = true;
      agent.api_rate_limit = 100;
      agent.api_usage_count = 0;
    }

    // Get recent API usage stats
    const usageStartTime = Date.now();
    const { data: recentUsage } = await supabase
      .from('api_usage_logs')
      .select('status, created_at, tokens_used')
      .eq('agent_id', agent.id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(100);
    console.log(`[API] Usage stats query completed in ${Date.now() - usageStartTime}ms`);

    // Calculate usage statistics
    const totalRequests = recentUsage?.length || 0;
    const successfulRequests = recentUsage?.filter(log => log.status === 'success').length || 0;
    const totalTokens = recentUsage?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0;

    const response = {
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        api_enabled: agent.api_enabled,
        api_endpoint: `/api/agents/${agent.id}/chat`,
        api_token: agent.api_token, // Return full token for owners/admins
        api_token_expires_at: agent.api_token_expires_at,
        api_rate_limit: agent.api_rate_limit,
        api_usage_count: agent.api_usage_count,
        last_api_used_at: agent.last_api_used_at,
        created_at: agent.created_at
      },
      usage_stats: {
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        success_rate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(1) : 0,
        total_tokens_used: totalTokens,
        recent_requests: recentUsage?.slice(0, 10) || []
      }
    };

    console.log(`[API] Total request completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(response);

  } catch (error) {
    console.error(`[API] Error after ${Date.now() - startTime}ms:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createServerSupabaseClient();
    
    // Verify user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, get the workspace to find its organization (same logic as GET method)
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, organization_id')
      .eq('id', workspaceId)
      .eq('status', 'active')
      .single();

    console.log('Workspace lookup:', { workspace, workspaceError, workspaceId });

    if (workspaceError || !workspace) {
      console.log('Workspace not found:', workspaceError);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user is a member of the organization that owns this workspace (same logic as GET method)
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single();

    console.log('User membership check:', { membership, membershipError, userId: user.id, organizationId: workspace.organization_id });

    if (membershipError || !membership) {
      console.log('User is not a member of this workspace organization');
      return NextResponse.json({ error: 'Access denied - not a member of this workspace' }, { status: 403 });
    }

    const userRole = membership.role;
    console.log('User role:', userRole);

    if (!['owner', 'admin'].includes(userRole)) {
      console.log('User role not sufficient for token regeneration:', userRole);
      return NextResponse.json({ error: 'Owner or admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'regenerate_token') {
      console.log('Regenerating token for workspace:', workspaceId);
      
      // Regenerate API token
      const { generateAgentApiToken } = await import('@/lib/jwt-utils');
      
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('workspace_id', workspaceId)
        .single();

      console.log('Agent lookup result:', { agent, agentError });

      if (agentError || !agent) {
        console.error('Agent not found:', agentError);
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      // Get current token for audit trail
      const { data: currentAgent } = await supabase
        .from('ai_agents')
        .select('api_token')
        .eq('id', agent.id)
        .single();

      const newApiToken = generateAgentApiToken(agent.id, workspaceId, user.id);
      console.log('Generated new API token:', newApiToken ? 'Yes' : 'No');
      
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1);

      const { error: updateError } = await supabaseServer
        .from('ai_agents')
        .update({
          api_token: newApiToken,
          api_token_expires_at: tokenExpiresAt.toISOString(),
        })
        .eq('id', agent.id);

      console.log('Token update result:', { updateError });

      // Log token regeneration for audit trail (if table exists)
      if (!updateError && currentAgent?.api_token) {
        try {
          await supabaseServer
            .from('api_token_audit')
            .insert({
              agent_id: agent.id,
              old_token: currentAgent.api_token,
              new_token: newApiToken,
              action: 'regenerated',
              user_id: user.id,
              ip_address: request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         'unknown',
              user_agent: request.headers.get('user-agent') || 'unknown'
            });
        } catch (auditError) {
          // If audit table doesn't exist, just log the error and continue
          console.warn('Could not log token regeneration to audit table:', auditError);
        }
      }

      if (updateError) {
        return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'API token regenerated successfully',
        api_token: newApiToken
      });
    }

    // API disable feature removed - users can regenerate token instead

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in agent API management:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
