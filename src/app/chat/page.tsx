import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import ChatClient from "./chat-client";
import { SupabaseClient } from "@supabase/supabase-js";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  agent_type: string;
  status: string;
  config: Record<string, unknown>;
  data_sources: Record<string, unknown>[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  agent: Agent;
  messages: Array<{
    id: string;
    content: string;
    role: "user" | "assistant";
    created_at: string;
  }>;
}

interface AgentAccess {
  agent_id: string;
  access_level: string;
  ai_agents: Agent[];
}

interface ConversationData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  agent_id: string;
  ai_agents: Agent[];
}

async function getChatData(
  userId: string,
  supabase: SupabaseClient
): Promise<{
  agents: Agent[];
  conversations: Conversation[];
}> {
  try {
    // Get user's accessible agents through agent_access
    const { data: agentAccess, error: agentAccessError } = await supabase
      .from("agent_access")
      .select(
        `
        agent_id,
        access_level,
        ai_agents(
          id,
          name,
          description,
          workspace_id,
          agent_type,
          status,
          config,
          data_sources,
          created_by,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", userId);

    if (agentAccessError) {
      console.error("Error fetching agent access:", agentAccessError);
    }

    // Also get agents from workspaces the user has access to
    // First get user's organizations
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active");

    let workspaceAgents: Agent[] = [];
    if (!userOrgsError && userOrgs && userOrgs.length > 0) {
      // Get workspaces for these organizations
      const orgIds = userOrgs.map((org) => org.organization_id);
      const { data: workspaces, error: workspacesError } = await supabase
        .from("workspaces")
        .select("id")
        .in("organization_id", orgIds)
        .eq("status", "active");

      if (!workspacesError && workspaces && workspaces.length > 0) {
        // Get agents for these workspaces
        const workspaceIds = workspaces.map((ws) => ws.id);
        const { data: agents } = await supabase
          .from("ai_agents")
          .select(
            `
            id,
            name,
            description,
            workspace_id,
            agent_type,
            status,
            config,
            data_sources,
            created_by,
            created_at,
            updated_at
          `
          )
          .in("workspace_id", workspaceIds)
          .eq("status", "active");

        workspaceAgents = agents || [];
      }
    }

    // Get conversations for the user
    console.log("🔍 Querying conversations for user:", userId);

    // Debug: Check if the agent exists
    const { data: agentCheck, error: agentError } = await supabase
      .from("ai_agents")
      .select("id, name, status")
      .eq("id", "60acb191-c2b5-4abc-8732-e74f3469a985");
    console.log("🔍 Agent check:", { agentCheck, agentError });
    // Try a different approach - get conversations first, then get agents separately
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select(
        `
        id,
        title,
        created_at,
        updated_at,
        last_message_at,
        agent_id,
        user_id
      `
      )
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(20);

    // Get agents for these conversations
    let conversationsWithAgents: unknown[] = [];
    if (conversations && conversations.length > 0) {
      const agentIds = conversations.map((c) => c.agent_id);
      const { data: agents, error: agentsError } = await supabase
        .from("ai_agents")
        .select("*")
        .in("id", agentIds);

      console.log("🔍 Agents for conversations:", { agents, agentsError });

      // Manually join conversations with agents
      conversationsWithAgents = conversations.map((conv) => ({
        ...conv,
        ai_agents: agents?.filter((agent) => agent.id === conv.agent_id) || [],
      }));
    }

    // Note: conversationsError might be an empty object {} when no conversations exist
    // This is normal behavior, not an actual error
    console.log("🔍 Conversations query result:", {
      conversationsCount: conversations?.length || 0,
      conversationsError: conversationsError,
      userId,
      conversationsWithAgents: conversationsWithAgents.length,
    });

    // Transform agents data from both sources
    const accessAgents = (agentAccess || [])
      .flatMap((access: AgentAccess) => access.ai_agents || [])
      .filter((agent: Agent) => agent && agent.status === "active")
      .map((agent: Agent) => ({
        ...agent,
        access_level:
          (agentAccess || []).find(
            (access: AgentAccess) => access.agent_id === agent.id
          )?.access_level || "read",
      }));

    const workspaceAgentsList = (workspaceAgents || [])
      .filter((agent: Agent) => agent && agent.status === "active")
      .map((agent: Agent) => ({
        ...agent,
        access_level: "chat", // Default access level for workspace agents
      }));

    // Combine and deduplicate agents
    const allAgents = [...accessAgents, ...workspaceAgentsList];
    const uniqueAgents = allAgents.filter(
      (agent, index, self) => index === self.findIndex((a) => a.id === agent.id)
    );

    // Transform conversations data and filter out conversations with null agents
    const transformedConversations = (conversationsWithAgents || [])
      .map((conv: unknown) => {
        const conversation = conv as ConversationData;
        return {
          id: conversation.id,
          title: conversation.title,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_at,
          agent: conversation.ai_agents?.[0] || null,
          messages: [], // Messages will be loaded on demand
        };
      })
      .filter((conv) => conv.agent !== null); // Filter out conversations with null agents

    return {
      agents: uniqueAgents,
      conversations: transformedConversations,
    };
  } catch (error) {
    console.error("Error in getChatData:", error);
    return { agents: [], conversations: [] };
  }
}

export default async function ChatPage() {
  // Create server-side Supabase client that can read session cookies
  const supabase = await createServerSupabaseClient();

  // Get user session on server side using secure method
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch chat data on server side
  const { agents, conversations } = await getChatData(user.id, supabase);

  return (
    <ChatClient
      initialAgents={agents}
      initialConversations={conversations}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
