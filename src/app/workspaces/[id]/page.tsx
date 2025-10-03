import { createServerSupabaseClient, supabaseServer } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import WorkspaceDetailClient from "./workspace-detail-client";
import ResourceNotFound from "@/components/ResourceNotFound";
import { getEffectiveWorkspaceRole, WorkspaceRole } from "@/lib/permissions";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  userRole: WorkspaceRole;
}

interface Organization {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

interface AIAgent {
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

interface UploadedFile {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_status: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
  file_summaries: Array<{
    id: string;
    summary: string;
    key_points: string[];
    tags: string[];
    llm_model: string;
    created_at: string;
  }>;
}

async function getWorkspaceData(
  workspaceId: string,
  userId: string
): Promise<{
  workspace: Workspace | null;
  organization: Organization | null;
  agent: AIAgent | null;
  files: UploadedFile[];
}> {
  try {
    // First, get the workspace to find its organization
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from("workspaces")
      .select("*, organization_id")
      .eq("id", workspaceId)
      .eq("status", "active")
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { workspace: null, organization: null, agent: null, files: [] };
    }

    // Check if user is a member of the organization that owns this workspace
    const { data: membership, error: membershipError } = await supabaseServer
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", workspace.organization_id)
      .eq("status", "active")
      .single();

    if (membershipError || !membership) {
      console.error("User not a member of organization:", membershipError);
      return { workspace: null, organization: null, agent: null, files: [] };
    }

    // Workspace already fetched above, no need to fetch again

    // Get organization details
    const { data: organization, error: orgError } = await supabaseServer
      .from("organizations")
      .select("*")
      .eq("id", workspace.organization_id)
      .eq("status", "active")
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
    }

    // Get workspace agent
    const { data: agent, error: agentError } = await supabaseServer
      .from("ai_agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (agentError && agentError.code !== "PGRST116") {
      console.error("Error fetching agent:", agentError);
    }

    // Get workspace files
    const { data: files, error: filesError } = await supabaseServer
      .from("file_uploads")
      .select(
        `
        *,
        file_summaries(
          id,
          summary,
          key_points,
          tags,
          llm_model,
          created_at
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (filesError) {
      console.error("Error fetching files:", filesError);
    }

    return {
      workspace: {
        ...workspace,
        userRole: getEffectiveWorkspaceRole(
          membership.role as "owner" | "member" | "viewer"
        ),
      },
      organization: organization || null,
      agent: agent || null,
      files: Array.isArray(files) ? files : [],
    };
  } catch (error) {
    console.error("Error in getWorkspaceData:", error);
    return { workspace: null, organization: null, agent: null, files: [] };
  }
}

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workspaceId } = await params;

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

  // Fetch workspace data on server side
  const { workspace, agent, files } = await getWorkspaceData(
    workspaceId,
    user.id
  );

  if (!workspace) {
    // Show a more user-friendly error page for deleted workspaces
    return (
      <ResourceNotFound
        title="Workspace Not Found"
        message="The workspace you're looking for doesn't exist or you don't have access to it."
        backUrl="/organizations"
        backText="Go to Dashboard"
      />
    );
  }

  return (
    <WorkspaceDetailClient
      initialWorkspace={workspace}
      initialAgent={agent}
      initialFiles={files}
    />
  );
}
