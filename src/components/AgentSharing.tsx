import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { checkWorkspacePermission, WorkspaceRole } from "@/lib/permissions";

interface AgentAccess {
  id: string;
  access_level: string;
  granted_at: string;
  granted_by: string;
  users: {
    id: string;
    email: string;
    name: string;
  };
  granted_by_user: {
    id: string;
    email: string;
    name: string;
  };
}

interface AgentSharingProps {
  agentId: string;
  agentName: string;
  userRole: WorkspaceRole;
  onClose: () => void;
}

const AgentSharing: React.FC<AgentSharingProps> = ({
  agentId,
  agentName,
  userRole,
  onClose,
}) => {
  const authContext = useSupabaseAuth();
  const { user, session } = authContext || { user: null, session: null };
  const [accessList, setAccessList] = useState<AgentAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // Check if user can share agents
  const canShareAgent = checkWorkspacePermission(
    userRole,
    "VIEW_AGENT"
  ).hasPermission;
  const canRemoveAccess = checkWorkspacePermission(
    userRole,
    "UPDATE_AGENT"
  ).hasPermission;

  const loadAgentAccess = useCallback(async () => {
    if (!user || !session?.access_token) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`/api/agents/${agentId}/share`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load agent access list");
      }

      const data = await response.json();
      setAccessList(data || []);
    } catch (error) {
      console.error("Error loading agent access:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load agent access list"
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, session?.access_token, agentId]);

  const handleShareAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !session?.access_token || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      setError("");

      const response = await fetch(`/api/agents/${agentId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to share agent");
      }

      // Reload data to show the new access
      await loadAgentAccess();

      // Reset form
      setInviteEmail("");
      setShowInviteForm(false);
    } catch (error) {
      console.error("Error sharing agent:", error);
      setError(
        error instanceof Error ? error.message : "Failed to share agent"
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveAccess = async (userId: string) => {
    if (!user || !session?.access_token) return;

    try {
      const response = await fetch(`/api/agents/${agentId}/share`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove access");
      }

      // Reload data
      await loadAgentAccess();
    } catch (error) {
      console.error("Error removing access:", error);
      setError(
        error instanceof Error ? error.message : "Failed to remove access"
      );
    }
  };

  useEffect(() => {
    loadAgentAccess();
  }, [loadAgentAccess]);

  const getAccessLevelColor = (accessLevel: string) => {
    switch (accessLevel) {
      case "read":
        return "bg-blue-500/20 text-blue-400";
      case "chat":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const formatAccessLevel = (accessLevel: string) => {
    switch (accessLevel) {
      case "read":
        return "Viewer";
      case "chat":
        return "Chat Access";
      default:
        return accessLevel;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Share Agent</h2>
            <p className="text-gray-400">
              Manage access to{" "}
              <span className="text-blue-400 font-medium">{agentName}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Shared users can chat with this agent but cannot access the
              workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6"
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Share Agent */}
            {canShareAgent && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Share Agent
                  </h3>
                  {!showInviteForm && (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Share Agent
                    </button>
                  )}
                </div>

                {showInviteForm && (
                  <form onSubmit={handleShareAgent} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="user@example.com"
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        The user will receive viewer access to chat with this
                        agent
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        {isInviting ? "Sharing..." : "Share Agent"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteForm(false);
                          setInviteEmail("");
                        }}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Current Access List */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Current Access
              </h3>
              <div className="space-y-3">
                {accessList.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <p>No users have access to this agent yet</p>
                  </div>
                ) : (
                  accessList.map((access) => (
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {access.users.name?.charAt(0)?.toUpperCase() ||
                              access.users.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {access.users.name || "No name"}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {access.users.email}
                          </p>
                          <p className="text-gray-500 text-xs">
                            Shared by {access.granted_by_user.name} •{" "}
                            {new Date(access.granted_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(
                            access.access_level
                          )}`}
                        >
                          {formatAccessLevel(access.access_level)}
                        </span>
                        {canRemoveAccess && access.users.id !== user?.id && (
                          <button
                            onClick={() => handleRemoveAccess(access.users.id)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Remove access"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSharing;
