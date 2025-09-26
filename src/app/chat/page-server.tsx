import { supabaseServer, createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import ChatClient from "./chat-client";

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

async function getChatData(userId: string): Promise<{
  agents: Agent[];
  conversations: Conversation[];
}> {
  try {
    // Get user's accessible agents
    const { data: agentAccess, error: agentAccessError } = await supabaseServer
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

    console.log("Agent access data:", agentAccess);

    // Get conversations for the user
    const { data: conversations, error: conversationsError } =
      await supabaseServer
        .from("conversations")
        .select(
          `
        id,
        title,
        created_at,
        updated_at,
        last_message_at,
        agent_id,
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
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .limit(20);

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
    }

    // Transform agents data
    const agents = (agentAccess || [])
      .flatMap((access) => access.ai_agents || [])
      .filter((agent) => agent && agent.status === "active")
      .map((agent) => ({
        ...agent,
        access_level:
          (agentAccess || []).find((access) => access.agent_id === agent.id)
            ?.access_level || "read",
      }));

    // If no agents found, check if user has access through organization/workspace membership
    if (agents.length === 0) {
      console.log(
        "No agents found, checking user's organization and workspace access..."
      );
      try {
        // Get user's organization memberships (all roles)
        const { data: orgMemberships, error: orgError } = await supabaseServer
          .from("organization_members")
          .select(
            `
            organization_id,
            role,
            organizations!inner(
              id,
              workspaces!inner(
                id,
                ai_agents!inner(
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
              )
            )
          `
          )
          .eq("user_id", userId)
          .eq("status", "active");

        // Get user's workspace memberships
        const { data: workspaceMemberships, error: workspaceError } =
          await supabaseServer
            .from("workspace_members")
            .select(
              `
            workspace_id,
            role,
            workspaces!inner(
              id,
              ai_agents!inner(
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
            )
          `
            )
            .eq("user_id", userId)
            .eq("status", "active");

        const allAgents: Agent[] = [];
        let accessLevel = "read"; // Default access level

        // Process organization memberships
        if (!orgError && orgMemberships && orgMemberships.length > 0) {
          console.log(
            `User is member of ${orgMemberships.length} organizations`
          );

          orgMemberships.forEach((membership) => {
            const orgWorkspaces = (
              membership.organizations as unknown as Record<string, unknown>
            ).workspaces as Array<Record<string, unknown>>;
            const orgAgents = orgWorkspaces
              .flatMap(
                (workspace: Record<string, unknown>) =>
                  workspace.ai_agents as Agent[]
              )
              .filter((agent: Agent) => agent && agent.status === "active");

            allAgents.push(...orgAgents);

            // Set access level based on role
            if (membership.role === "owner" || membership.role === "admin") {
              accessLevel = "chat";
            }
          });
        }

        // Process workspace memberships
        if (
          !workspaceError &&
          workspaceMemberships &&
          workspaceMemberships.length > 0
        ) {
          console.log(
            `User is member of ${workspaceMemberships.length} workspaces`
          );

          workspaceMemberships.forEach((membership) => {
            const workspaceAgents = (
              membership.workspaces as unknown as Record<string, unknown>
            ).ai_agents as Agent[];
            const filteredAgents = workspaceAgents.filter(
              (agent) => agent && agent.status === "active"
            );

            allAgents.push(...filteredAgents);

            // Set access level based on role (workspace owners get chat access)
            if (membership.role === "owner" || membership.role === "admin") {
              accessLevel = "chat";
            }
          });
        }

        // Remove duplicates based on agent ID
        const uniqueAgents = allAgents.filter(
          (agent, index, self) =>
            index === self.findIndex((a) => a.id === agent.id)
        );

        // Grant access to all unique agents
        if (uniqueAgents.length > 0) {
          const accessRecords = uniqueAgents.map((agent) => ({
            user_id: userId,
            agent_id: agent.id,
            access_level: accessLevel,
            granted_by: userId,
            granted_at: new Date().toISOString(),
          }));

          const { error: accessError } = await supabaseServer
            .from("agent_access")
            .upsert(accessRecords, {
              onConflict: "user_id,agent_id",
              ignoreDuplicates: true,
            });

          if (!accessError) {
            console.log(
              `Granted ${accessLevel} access to ${uniqueAgents.length} agents for user`
            );
            // Update agents list
            agents.push(
              ...uniqueAgents.map((agent) => ({
                ...agent,
                access_level: accessLevel,
              }))
            );
          } else {
            console.error("Error granting access to agents:", accessError);
          }
        }
      } catch (error) {
        console.error("Error checking user access:", error);
      }
    }

    // Load messages for each conversation
    const transformedConversations = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get messages for this conversation
        const { data: messages, error: messagesError } = await supabaseServer
          .from("messages")
          .select(
            `
            id,
            content_encrypted,
            content_hash,
            sender_type,
            message_type,
            metadata_encrypted,
            tokens_used,
            processing_time_ms,
            encryption_version,
            created_at
          `
          )
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(50); // Limit to last 50 messages

        if (messagesError) {
          console.error(
            `Error loading messages for conversation ${conv.id}:`,
            messagesError
          );
        }

        // Import decryption functions
        const { decryptText } = await import("@/lib/encryption");

        // Decrypt and transform messages
        const decryptedMessages = (messages || []).map((msg) => {
          try {
            const decryptedContent = decryptText(msg.content_encrypted);
            // const decryptedMetadata = msg.metadata_encrypted
            //   ? decryptObject(msg.metadata_encrypted)
            //   : {};

            return {
              id: msg.id,
              content: decryptedContent,
              role:
                msg.sender_type === "user"
                  ? ("user" as const)
                  : ("assistant" as const),
              created_at: msg.created_at,
            };
          } catch (decryptError) {
            console.error("Error decrypting message:", decryptError);
            return {
              id: msg.id,
              content: "[Message could not be decrypted]",
              role:
                msg.sender_type === "user"
                  ? ("user" as const)
                  : ("assistant" as const),
              created_at: msg.created_at,
            };
          }
        });

        return {
          id: conv.id,
          title: conv.title,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at,
          agent: conv.ai_agents?.[0] || null,
          messages: decryptedMessages,
        };
      })
    );

    return {
      agents,
      conversations: transformedConversations,
    };
  } catch (error) {
    console.error("Error in getChatData:", error);
    return { agents: [], conversations: [] };
  }
}

export default async function ChatPage() {
  // Get user session on server side using cookie-based client
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    console.log("❌ Chat Page: No valid session, redirecting to login");
    redirect("/login");
  }

  console.log("✅ Chat Page: User authenticated:", session.user.email);

  // Fetch chat data on server side
  const { agents, conversations } = await getChatData(session.user.id);

  return (
    <ChatClient
      initialAgents={agents}
      initialConversations={conversations}
      user={{ id: session.user.id, email: session.user.email || "" }}
    />
  );
}
