import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUserSession } from '@/lib/server-utils'
import { generateAgentApiToken } from '@/lib/jwt-utils'
import { getRandomAgentAvatar } from '@/lib/agent-avatars'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await request.json()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }


    // Check if workspace already has an agent
    const { data: existingAgent, error: agentError } = await supabaseServer
      .from('ai_agents')
      .select('id, status')
      .eq('workspace_id', workspaceId)
      .single()

    if (agentError && agentError.code !== 'PGRST116') {
      console.error('Error checking for existing agent:', agentError)
      return NextResponse.json({ error: 'Failed to check for existing agent' }, { status: 500 })
    }

    if (existingAgent) {
      // If agent is inactive, reactivate it
      if (existingAgent.status === 'inactive') {
        const { error: reactivateError } = await supabaseServer
          .from('ai_agents')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAgent.id)

        if (!reactivateError) {
          return NextResponse.json({ 
            message: 'Agent reactivated successfully',
            agentId: existingAgent.id,
            status: 'active'
          })
        } else {
          console.error('❌ Error reactivating agent:', reactivateError)
          return NextResponse.json({ error: 'Failed to reactivate agent' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ 
          message: 'Agent already exists and is active',
          agentId: existingAgent.id,
          status: existingAgent.status
        })
      }
    }

    // Check if there are data sources for this workspace
    const { data: dataSources, error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (dataSourceError) {
      console.error('Error checking data sources:', dataSourceError)
      return NextResponse.json({ error: 'Failed to check data sources' }, { status: 500 })
    }

    if (!dataSources || dataSources.length === 0) {
      return NextResponse.json({ error: 'No data sources found. Upload a file first.' }, { status: 400 })
    }

    // Generate API token for the agent
    const tempAgentId = crypto.randomUUID(); // Temporary ID for token generation
    const apiToken = generateAgentApiToken(tempAgentId, workspaceId, session.user.id);
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1); // 1 year from now

    // Get a random avatar for the new agent
    const randomAvatar = getRandomAgentAvatar()
    
    // Create new agent with API token
    const { data: newAgent, error: agentCreateError } = await supabaseServer
      .from('ai_agents')
      .insert([{
        id: tempAgentId,
        name: 'Data Analysis Agent',
        description: 'AI agent for analyzing workspace data and answering questions',
        workspace_id: workspaceId,
        agent_type: 'data_analyzer',
        status: 'active',
        config: {
          avatar: {
            image: randomAvatar.image,
            name: randomAvatar.name
          }
        },
        data_sources: [],
        created_by: session.userId,
        api_token: apiToken,
        api_token_expires_at: tokenExpiresAt.toISOString(),
        api_enabled: true,
        api_rate_limit: 100
      }])
      .select('id, api_token')
      .single()

    if (agentCreateError) {
      console.error('Error creating agent:', agentCreateError)
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
    }

    // Grant access to all workspace members
    // First get the workspace's organization
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (!workspaceError && workspace) {
      // Get all organization members
      const { data: members, error: membersError } = await supabaseServer
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', workspace.organization_id)

      if (!membersError && members && members.length > 0) {
        // Prepare access records
        const accessRecords = members.map(member => ({
          user_id: member.user_id,
          agent_id: newAgent.id,
          access_level: 'read',
          granted_by: session.userId,
          granted_at: new Date().toISOString(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        const { error: accessError } = await supabaseServer
          .from('agent_access')
          .insert(accessRecords)

        if (!accessError) {
          } else {
          console.error('❌ Error granting access:', accessError)
        }
      }
    }

    return NextResponse.json({ 
      message: 'Agent created successfully',
      agentId: newAgent.id,
      status: 'active',
      api_token: newAgent.api_token,
      api_endpoint: `/api/agents/${newAgent.id}/chat`
    })

  } catch (error) {
    console.error('Error in create-agent-for-workspace API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
