"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import OrganizationSharing from "@/components/OrganizationSharing";

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

interface OrganizationDetailClientProps {
  initialOrganization: Organization;
  initialWorkspaces: Workspace[];
  user: {
    id: string;
    email: string;
  };
}

export default function OrganizationDetailClient({
  initialOrganization,
  initialWorkspaces,
}: OrganizationDetailClientProps) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useSupabaseAuth();

  // All hooks must be called before any conditional returns
  const [organization, setOrganization] =
    useState<Organization>(initialOrganization);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
  });
  const [editOrg, setEditOrg] = useState({
    name: organization.name,
    description: organization.description || "",
    industry: organization.industry || "",
    size: organization.size || "",
    website: organization.website || "",
    location: organization.location || "",
  });

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspace.name.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name: newWorkspace.name,
          description: newWorkspace.description,
          organization_id: organization.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create workspace");
      }

      const createdWorkspace = await response.json();
      setWorkspaces((prev) => [createdWorkspace, ...prev]);
      setShowCreateModal(false);
      setNewWorkspace({ name: "", description: "" });
    } catch (error) {
      console.error("Error creating workspace:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create workspace"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(editOrg),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update organization");
      }

      const updatedOrg = await response.json();
      setOrganization(updatedOrg);
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating organization:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization || !session) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete organization");
      }

      router.push("/organizations");
    } catch (error) {
      console.error("Error deleting organization:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete organization"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    router.push(`/workspaces/${workspaceId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-500/20 text-purple-400";
      case "admin":
        return "bg-blue-500/20 text-blue-400";
      case "member":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const formatRole = (role: string | undefined) => {
    if (!role) return "Member";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={() => router.push("/organizations")}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Go to Organizations"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {organization.name}
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(
                      organization.userRole
                    )}`}
                  >
                    {formatRole(organization.userRole)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    Created {formatDate(organization.created_at)}
                  </span>
                </div>
              </div>
            </div>
            {organization.description && (
              <p className="text-gray-300 text-lg max-w-3xl">
                {organization.description}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <button
              onClick={() => setShowSharingModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              <span>Share</span>
            </button>

            {(organization.userRole === "owner" ||
              organization.userRole === "admin") && (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Edit
                </button>
                {organization.userRole === "owner" && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Organization Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Organization Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organization.industry && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Industry
                    </label>
                    <p className="text-white">{organization.industry}</p>
                  </div>
                )}
                {organization.size && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Size
                    </label>
                    <p className="text-white">{organization.size}</p>
                  </div>
                )}
                {organization.website && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Website
                    </label>
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {organization.website}
                    </a>
                  </div>
                )}
                {organization.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Location
                    </label>
                    <p className="text-white">{organization.location}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Workspaces</span>
                  <span className="text-white font-medium">
                    {workspaces.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Created</span>
                  <span className="text-white font-medium">
                    {formatDate(organization.created_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Last Updated</span>
                  <span className="text-white font-medium">
                    {formatDate(organization.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Workspaces</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>Create Workspace</span>
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No workspaces yet
              </h3>
              <p className="text-gray-400 mb-4">
                Create your first workspace to start organizing your projects
                and data.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer group"
                  onClick={() => handleWorkspaceClick(workspace.id)}
                >
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors mb-2">
                    {workspace.name}
                  </h3>
                  {workspace.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {workspace.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Created {formatDate(workspace.created_at)}
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Create Workspace Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Create Workspace
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    value={newWorkspace.name}
                    onChange={(e) =>
                      setNewWorkspace((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter workspace name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newWorkspace.description}
                    onChange={(e) =>
                      setNewWorkspace((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter workspace description"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !newWorkspace.name.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {isLoading ? "Creating..." : "Create Workspace"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Organization Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Edit Organization
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditOrganization} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={editOrg.name}
                      onChange={(e) =>
                        setEditOrg((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={editOrg.industry}
                      onChange={(e) =>
                        setEditOrg((prev) => ({
                          ...prev,
                          industry: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editOrg.description}
                    onChange={(e) =>
                      setEditOrg((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Size
                    </label>
                    <select
                      value={editOrg.size}
                      onChange={(e) =>
                        setEditOrg((prev) => ({
                          ...prev,
                          size: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-1000">201-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={editOrg.website}
                      onChange={(e) =>
                        setEditOrg((prev) => ({
                          ...prev,
                          website: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editOrg.location}
                      onChange={(e) =>
                        setEditOrg((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {isLoading ? "Updating..." : "Update Organization"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Organization Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Delete Organization
                </h2>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-300 mb-4">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-white">
                    {organization.name}
                  </span>
                  ?
                </p>
                <p className="text-red-400 text-sm">
                  This action cannot be undone. All workspaces, files, and data
                  associated with this organization will be permanently deleted.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteOrganization}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isLoading ? "Deleting..." : "Delete Organization"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Organization Sharing Modal */}
        {showSharingModal && (
          <OrganizationSharing
            organizationId={organization.id}
            organizationName={organization.name}
            userRole={organization.userRole as "owner" | "member" | "viewer"}
            onClose={() => setShowSharingModal(false)}
          />
        )}
      </div>
    </div>
  );
}
