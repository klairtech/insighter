import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  checkWorkspacePermission,
  WorkspaceRole,
  formatRole,
  getRoleColor,
  getInvitableWorkspaceRoles,
} from "@/lib/permissions";

interface WorkspaceMember {
  id: string;
  role: string;
  created_at: string;
  users: {
    id: string;
    name: string;
    email: string;
    created_at: string;
  };
}

interface WorkspaceInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by: {
    name: string;
    email: string;
  };
}

interface WorkspaceSharingProps {
  workspaceId: string;
  workspaceName: string;
  userRole: WorkspaceRole;
  onClose: () => void;
}

const WorkspaceSharing: React.FC<WorkspaceSharingProps> = ({
  workspaceId,
  workspaceName,
  userRole,
  onClose,
}) => {
  const { user, session } = useSupabaseAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [isInviting, setIsInviting] = useState(false);

  // Check if user can invite members
  const canInviteMembers = checkWorkspacePermission(
    userRole,
    "INVITE_WORKSPACE_MEMBERS"
  ).hasPermission;
  const canInviteOwners = checkWorkspacePermission(
    userRole,
    "INVITE_WORKSPACE_OWNERS"
  ).hasPermission;

  const loadWorkspaceData = useCallback(async () => {
    if (!user || !session?.access_token) return;

    try {
      setIsLoading(true);
      setError("");

      // Load workspace members
      const membersResponse = await fetch(
        `/api/workspaces/${workspaceId}/members`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!membersResponse.ok) {
        const errorData = await membersResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to load workspace members (${membersResponse.status})`;
        throw new Error(errorMessage);
      }

      const membersData = await membersResponse.json();
      setMembers(membersData || []);

      // Load workspace invitations
      const invitationsResponse = await fetch(
        `/api/workspaces/${workspaceId}/invite`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!invitationsResponse.ok) {
        const errorData = await invitationsResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to load workspace invitations (${invitationsResponse.status})`;
        throw new Error(errorMessage);
      }

      const invitationsData = await invitationsResponse.json();
      setInvitations(invitationsData || []);
    } catch (error) {
      console.error("Error loading workspace data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load workspace data"
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, session?.access_token, workspaceId]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !session?.access_token || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      setError("");

      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }

      // Reload data to show the new invitation
      await loadWorkspaceData();

      // Reset form
      setInviteEmail("");
      setInviteRole("member");
      setShowInviteForm(false);
    } catch (error) {
      console.error("Error inviting user:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          invitationId: invitationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel invitation");
      }

      // Reload data to update the invitations list
      await loadWorkspaceData();
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to cancel invitation"
      );
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user || !session?.access_token) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memberId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }

      // Reload data
      await loadWorkspaceData();
    } catch (error) {
      console.error("Error removing member:", error);
      setError(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  };

  const handleUpdateMemberRole = async (
    memberId: string,
    newRole: WorkspaceRole
  ) => {
    if (!user || !session?.access_token) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update member role");
      }

      // Reload data
      await loadWorkspaceData();
    } catch (error) {
      console.error("Error updating member role:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update member role"
      );
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const getInvitableRoles = () => {
    if (canInviteOwners) {
      return getInvitableWorkspaceRoles(userRole);
    }
    // If can't invite owners, only allow member and viewer roles
    return ["member", "viewer"] as WorkspaceRole[];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Share Workspace
            </h2>
            <p className="text-gray-400">
              Manage access to{" "}
              <span className="text-blue-400 font-medium">{workspaceName}</span>
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
            {/* Invite New Member */}
            {canInviteMembers && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Invite New Member
                  </h3>
                  {!showInviteForm && (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Invite Member
                    </button>
                  )}
                </div>

                {showInviteForm && (
                  <form onSubmit={handleInviteUser} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) =>
                            setInviteRole(e.target.value as WorkspaceRole)
                          }
                          className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {getInvitableRoles().map((role) => (
                            <option key={role} value={role}>
                              {formatRole(role)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        {isInviting ? "Sending..." : "Send Invitation"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteForm(false);
                          setInviteEmail("");
                          setInviteRole("member");
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

            {/* Current Members */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Current Members
              </h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {member.users.name?.charAt(0)?.toUpperCase() ||
                            member.users.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {member.users.name || "No name"}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {member.users.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(
                          member.role as "owner" | "admin" | "member" | "viewer"
                        )}`}
                      >
                        {formatRole(
                          member.role as "owner" | "admin" | "member" | "viewer"
                        )}
                      </span>
                      {member.users.id !== user?.id && (
                        <div className="flex items-center space-x-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleUpdateMemberRole(
                                member.id,
                                e.target.value as WorkspaceRole
                              )
                            }
                            className="px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            {userRole === "owner" && (
                              <option value="owner">Owner</option>
                            )}
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Remove member"
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
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Pending Invitations
                </h3>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {invitation.email}
                          </p>
                          <p className="text-gray-400 text-sm">
                            Invited by {invitation.invited_by.name} •{" "}
                            {new Date(
                              invitation.created_at
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(
                            invitation.role as
                              | "owner"
                              | "admin"
                              | "member"
                              | "viewer"
                          )}`}
                        >
                          {formatRole(
                            invitation.role as
                              | "owner"
                              | "admin"
                              | "member"
                              | "viewer"
                          )}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          {invitation.status}
                        </span>
                        {canInviteMembers && (
                          <button
                            onClick={() =>
                              handleCancelInvitation(invitation.id)
                            }
                            className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Cancel invitation"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSharing;
