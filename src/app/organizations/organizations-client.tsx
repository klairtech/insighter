"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import OrganizationSharingWrapper from "@/components/OrganizationSharingWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAnalytics } from "@/hooks/useAnalytics";

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

interface OrganizationsClientProps {
  initialOrganizations: Organization[];
  user: {
    id: string;
    email: string;
  };
}

export default function OrganizationsClient({
  initialOrganizations,
}: OrganizationsClientProps) {
  const router = useRouter();
  const authContext = useSupabaseAuth();
  const { session, isLoading } = authContext || {
    session: null,
    isLoading: false,
  };
  const { trackFeatureUsage } = useAnalytics();
  const [organizations, setOrganizations] =
    useState<Organization[]>(initialOrganizations);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrganization, setNewOrganization] = useState({
    name: "",
    description: "",
    industry: "",
    size: "",
    website: "",
    location: "",
  });
  const [error, setError] = useState("");

  // Debug session loading
  useEffect(() => {

    // Clear any existing error when session loads successfully
    if (
      !isLoading &&
      session &&
      error === "Please wait while we load your session..."
    ) {
      setError("");
    }
  }, [session, isLoading, error]);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);

  const handleOrganizationClick = (organizationId: string) => {
    // Track organization view
    trackFeatureUsage("organization_viewed", {
      organization_id: organizationId,
    });
    router.push(`/organizations/${organizationId}`);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrganization.name.trim()) {
      setError("Organization name is required");
      return;
    }

    if (isLoading) {
      setError("Please wait while we load your session...");
      return;
    }

    // If we've been loading for too long, provide a retry option
    if (!session && !isLoading) {
      setError(
        "Session loading failed. Please refresh the page and try again."
      );
      return;
    }

    if (!session) {
      setError("You must be logged in to create an organization");
      return;
    }

    if (!session.access_token) {
      setError("Invalid session. Please log in again.");
      return;
    }


    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(newOrganization),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create organization";

        // Track organization creation error
        trackFeatureUsage("organization_creation_error", {
          error_message: errorMessage,
          organization_name: newOrganization.name,
        });

        try {
          const responseText = await response.text();

          if (responseText) {
            const errorData = JSON.parse(responseText);
            console.error("API Error creating organization:", errorData);
            if (errorData.error) {
              errorMessage = errorData.error;
              if (errorData.details) {
                errorMessage += `: ${errorData.details}`;
              }
            }
          } else {
            console.error("Empty response body");
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setError(errorMessage);
        return;
      }

      const createdOrg = await response.json();
      setOrganizations((prev) => [createdOrg, ...prev]);
      setShowCreateModal(false);

      // Track successful organization creation
      trackFeatureUsage("organization_created", {
        organization_id: createdOrg.id,
        organization_name: createdOrg.name,
        industry: createdOrg.industry,
        size: createdOrg.size,
      });

      setNewOrganization({
        name: "",
        description: "",
        industry: "",
        size: "",
        website: "",
        location: "",
      });
    } catch (error) {
      console.error("Error creating organization:", error);
      setError("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareOrganization = (organization: Organization) => {
    // Don't open modal if auth is still loading
    if (isLoading) {
      setError("Please wait while we load your session...");
      return;
    }

    setSelectedOrganization(organization);
    setShowSharingModal(true);
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Organizations
            </h1>
            <p className="text-gray-400">
              Manage your organizations and workspaces
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isLoading}
            className="mt-4 sm:mt-0 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            )}
            <span>{isLoading ? "Loading..." : "Create Organization"}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Organizations Grid */}
        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-700 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
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
            <h3 className="text-xl font-semibold text-white mb-2">
              No organizations yet
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first organization to get started with workspaces and
              AI agents.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : (
                "Create Organization"
              )}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((organization) => (
              <div
                key={organization.id}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all duration-200 cursor-pointer group"
                onClick={() => handleOrganizationClick(organization.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {organization.name}
                    </h3>
                    {organization.description && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                        {organization.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareOrganization(organization);
                    }}
                    disabled={isLoading}
                    className={`p-2 transition-colors ${
                      isLoading
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-gray-400 hover:text-blue-400"
                    }`}
                    title={isLoading ? "Loading..." : "Share organization"}
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
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Your Role</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                        organization.userRole
                      )}`}
                    >
                      {formatRole(organization.userRole)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Workspaces</span>
                    <span className="text-white font-medium">
                      {organization.workspaces?.length || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Created</span>
                    <span className="text-gray-300 text-sm">
                      {organization.created_at
                        ? formatDate(organization.created_at)
                        : "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center text-blue-400 text-sm group-hover:text-blue-300 transition-colors">
                    <span>View Details</span>
                    <svg
                      className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
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
              </div>
            ))}
          </div>
        )}

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Create Organization
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

              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={newOrganization.name}
                    onChange={(e) =>
                      setNewOrganization((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter organization name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newOrganization.description}
                    onChange={(e) =>
                      setNewOrganization((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter organization description"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={newOrganization.industry}
                      onChange={(e) =>
                        setNewOrganization((prev) => ({
                          ...prev,
                          industry: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Technology"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Size
                    </label>
                    <select
                      value={newOrganization.size}
                      onChange={(e) =>
                        setNewOrganization((prev) => ({
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
                </div>

                <div className="flex space-x-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={newOrganization.website}
                      onChange={(e) =>
                        setNewOrganization((prev) => ({
                          ...prev,
                          website: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newOrganization.location}
                      onChange={(e) =>
                        setNewOrganization((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City, Country"
                    />
                  </div>
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
                    disabled={
                      isCreating || isLoading || !newOrganization.name.trim()
                    }
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Loading Session...
                      </>
                    ) : isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Organization"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Organization Sharing Modal */}
        {showSharingModal && selectedOrganization && (
          <ErrorBoundary
            fallback={
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                  <div className="text-center">
                    <p className="text-red-600">
                      Error loading organization sharing
                    </p>
                    <button
                      onClick={() => {
                        setShowSharingModal(false);
                        setSelectedOrganization(null);
                      }}
                      className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            }
          >
            <OrganizationSharingWrapper
              organizationId={selectedOrganization.id}
              organizationName={selectedOrganization.name}
              userRole={
                selectedOrganization.userRole as "owner" | "member" | "viewer"
              }
              onClose={() => {
                setShowSharingModal(false);
                setSelectedOrganization(null);
              }}
            />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
