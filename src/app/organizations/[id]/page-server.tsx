import { supabaseServer } from "@/lib/server-utils";
import { redirect, notFound } from "next/navigation";
import OrganizationDetailClient from "./organization-detail-client";

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
  userRole: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

async function getOrganizationData(
  organizationId: string,
  userId: string
): Promise<{
  organization: Organization | null;
  workspaces: Workspace[];
}> {
  try {
    // First, check if user is a member of this organization
    const { data: membership, error: membershipError } = await supabaseServer
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .single();

    if (membershipError || !membership) {
      console.error("User not a member of organization:", membershipError);
      return { organization: null, workspaces: [] };
    }

    // Get the organization details
    const { data: organization, error: orgError } = await supabaseServer
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .eq("status", "active")
      .single();

    if (orgError || !organization) {
      console.error("Error fetching organization:", orgError);
      return { organization: null, workspaces: [] };
    }

    // Get workspaces for this organization
    const { data: workspaces, error: workspacesError } = await supabaseServer
      .from("workspaces")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (workspacesError) {
      console.error("Error fetching workspaces:", workspacesError);
      return { organization: null, workspaces: [] };
    }

    return {
      organization: {
        ...organization,
        userRole: membership.role,
      },
      workspaces: workspaces || [],
    };
  } catch (error) {
    console.error("Error in getOrganizationData:", error);
    return { organization: null, workspaces: [] };
  }
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = await params;

  // Get user session on server side
  const {
    data: { session },
    error,
  } = await supabaseServer.auth.getSession();

  if (error || !session?.user) {
    redirect("/login");
  }

  // Fetch organization data on server side
  const { organization, workspaces } = await getOrganizationData(
    organizationId,
    session.user.id
  );

  if (!organization) {
    notFound();
  }

  return (
    <OrganizationDetailClient
      initialOrganization={organization}
      initialWorkspaces={workspaces}
      user={{ id: session.user.id, email: session.user.email || "" }}
    />
  );
}
