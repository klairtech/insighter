import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { decryptObject } from "@/lib/encryption";
import DatabaseDetailClient from "./database-detail-client";
import ResourceNotFound from "@/components/ResourceNotFound";

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  schema_name: string;
  created_at: string;
  updated_at: string;
  last_schema_sync: string | null;
  schema_version: number;
  workspace_id: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

async function getDatabaseData(
  workspaceId: string,
  databaseId: string,
  userId: string
): Promise<{
  workspace: Workspace | null;
  database: DatabaseConnection | null;
}> {
  try {
    const supabaseServer = (await import("@/lib/server-utils")).supabaseServer;

    // First, get the workspace to find its organization
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from("workspaces")
      .select("*, organization_id")
      .eq("id", workspaceId)
      .eq("status", "active")
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { workspace: null, database: null };
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
      return { workspace: null, database: null };
    }

    // Get the database connection
    const { data: database, error: databaseError } = await supabaseServer
      .from("database_connections")
      .select("*")
      .eq("id", databaseId)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (databaseError || !database) {
      console.error("Database connection not found:", databaseError);
      return { workspace: null, database: null };
    }

    // Decrypt database connection details
    const decryptedDatabase = {
      ...database,
      host: database.host_encrypted
        ? decryptObject(database.host_encrypted)
        : database.host,
      port: parseInt(
        database.port_encrypted
          ? decryptObject(database.port_encrypted)
          : database.port
      ),
      database: database.database_encrypted
        ? decryptObject(database.database_encrypted)
        : database.database,
      username: database.username_encrypted
        ? decryptObject(database.username_encrypted)
        : database.username,
      schema_name: database.schema_name_encrypted
        ? decryptObject(database.schema_name_encrypted)
        : database.schema_name,
      schema_version: parseInt(database.schema_version || "1"),
    };

    return {
      workspace: {
        ...workspace,
        userRole: membership.role,
      },
      database: decryptedDatabase,
    };
  } catch (error) {
    console.error("Error in getDatabaseData:", error);
    return { workspace: null, database: null };
  }
}

export default async function DatabaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; databaseId: string }>;
}) {
  const { id: workspaceId, databaseId } = await params;

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

  // Fetch database data on server side
  const { workspace, database } = await getDatabaseData(
    workspaceId,
    databaseId,
    user.id
  );

  if (!workspace) {
    notFound();
  }

  if (!database) {
    // Database was deleted or doesn't exist, show error page
    return (
      <ResourceNotFound
        title="Database Not Found"
        message="The database you're looking for doesn't exist or has been deleted."
        backUrl={`/workspaces/${workspaceId}`}
        backText="Back to Workspace"
        secondaryUrl="/organizations"
        secondaryText="Go to Dashboard"
      />
    );
  }

  return (
    <DatabaseDetailClient
      database={database}
      initialWorkspace={workspace}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
