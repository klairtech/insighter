import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import OrganizationsClient from "./organizations-client";
import { SupabaseClient } from "@supabase/supabase-js";

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
  workspaces: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

interface OrganizationMember {
  organization_id: string;
  role: string;
  created_at: string;
}

interface OrganizationData {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  workspaces: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    status: string;
  }>;
}

async function getOrganizations(
  userId: string,
  supabase: SupabaseClient
): Promise<Organization[]> {
  try {
    // First, get organization memberships
    const { data: memberData, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role, created_at")
      .eq("user_id", userId)
      .eq("status", "active");

    if (memberError) {
      console.error("Error fetching organization memberships:", memberError);
      return [];
    }

    if (!memberData || memberData.length === 0) {
      return [];
    }

    const orgIds = memberData.map(
      (member: OrganizationMember) => member.organization_id
    );

    // Fetch organizations with workspaces
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select(
        `
        *,
        workspaces(
          id,
          name,
          description,
          created_at,
          updated_at,
          status
        )
      `
      )
      .in("id", orgIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (orgError) {
      console.error("Error fetching organizations:", orgError);
      return [];
    }

    const roleMap = new Map(
      memberData.map((member: OrganizationMember) => [
        member.organization_id,
        member.role,
      ])
    );

    // Transform the data to include user role and filter workspaces
    const organizationsWithRoles = (organizations || []).map(
      (org: OrganizationData) => ({
        ...org,
        userRole: roleMap.get(org.id) || "member",
        workspaces: (org.workspaces || []).filter(
          (workspace: { status: string }) => workspace.status === "active"
        ),
      })
    );

    return organizationsWithRoles;
  } catch (error) {
    console.error("Error in getOrganizations:", error);
    return [];
  }
}

export default async function OrganizationsPage() {
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

  // Fetch organizations data on server side
  const organizations = await getOrganizations(user.id, supabase);

  return (
    <OrganizationsClient
      initialOrganizations={organizations}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
