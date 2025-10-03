import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  checkOrganizationPermission,
  OrganizationRole,
  formatRole,
  getRoleColor,
  getInvitableOrganizationRoles,
} from "@/lib/permissions";
import ConfirmationModal from "./ConfirmationModal";

interface OrganizationMember {
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

interface OrganizationInvitation {
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

interface OrganizationSharingProps {
  organizationId: string;
  organizationName: string;
  userRole: OrganizationRole;
  onClose: () => void;
}

function OrganizationSharing({
  organizationId,
  organizationName,
  userRole,
  onClose,
}: OrganizationSharingProps) {
  // Call the hook at the top level - React hooks must be called unconditionally
  const { user, session, isLoading: authIsLoading } = useSupabaseAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string>("");
  const [isRemoving, setIsRemoving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      if (!session?.access_token) {
        console.error("❌ OrganizationSharing: No session token available");
        throw new Error("No session token available");
      }

      // Load members and invitations in parallel
      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/members`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        fetch(`/api/organizations/${organizationId}/invite`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
      ]);

      if (!membersResponse.ok) {
        const errorText = await membersResponse.text();
        console.error("❌ OrganizationSharing: Failed to load members:", {
          status: membersResponse.status,
          statusText: membersResponse.statusText,
          error: errorText,
        });
        throw new Error(
          `Failed to load members: ${membersResponse.status} ${membersResponse.statusText}`
        );
      }

      if (!invitationsResponse.ok) {
        const errorText = await invitationsResponse.text();
        console.error("❌ OrganizationSharing: Failed to load invitations:", {
          status: invitationsResponse.status,
          statusText: invitationsResponse.statusText,
          error: errorText,
        });
        throw new Error(
          `Failed to load invitations: ${invitationsResponse.status} ${invitationsResponse.statusText}`
        );
      }

      const [membersData, invitationsData] = await Promise.all([
        membersResponse.json(),
        invitationsResponse.json(),
      ]);

      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      console.error("Error loading organization data:", err);
      setError("Failed to load organization data");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, session]);

  useEffect(() => {
    if (session?.access_token) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [organizationId, session, loadData]);

  // Check permissions with defensive programming
  const canInvite = userRole
    ? checkOrganizationPermission(userRole, "INVITE_MEMBERS").hasPermission
    : false;
  const canManageMembers = userRole
    ? checkOrganizationPermission(userRole, "UPDATE_MEMBER_ROLES").hasPermission
    : false;

  // Get available roles that the current user can invite
  const invitableRoles = userRole
    ? getInvitableOrganizationRoles(userRole)
    : [];

  // Early return if auth is still loading or functions are not available
  if (
    authIsLoading ||
    !checkOrganizationPermission ||
    !getInvitableOrganizationRoles ||
    !formatRole ||
    !getRoleColor
  ) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span className="ml-3 text-white">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInvite) return;

    try {
      setIsInviting(true);
      setError("");

      const response = await fetch(
        `/api/organizations/${organizationId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }

      await response.json();

      // Reset form and reload data
      setInviteEmail("");
      setInviteRole("member");
      setShowInviteForm(false);
      await loadData();
    } catch (err) {
      console.error("Error sending invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send invitation"
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invite`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invitationId: invitationId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel invitation");
      }

      // Reload data to update the invitations list
      await loadData();
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to cancel invitation"
      );
    }
  };

  const handleUpdateMemberRole = async (
    memberId: string,
    newRole: OrganizationRole
  ) => {
    if (!canManageMembers) return;

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({
            memberId,
            role: newRole,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update member role");
      }

      await loadData();
    } catch (err) {
      console.error("Error updating member role:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update member role"
      );
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!canManageMembers) return;
    setMemberToRemove(memberId);
    setShowRemoveConfirm(true);
  };

  const confirmRemoveMember = async () => {
    setIsRemoving(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members?memberId=${memberToRemove}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }

      await loadData();
    } catch (err) {
      console.error("Error removing member:", err);
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setIsRemoving(false);
    }
  };

  // Early return if auth context is still loading
  if (authIsLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading authentication...</span>
          </div>
        </div>
      </div>
    );
  }

  // Early return if userRole is not provided
  if (!userRole) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="text-center">
            <p className="text-red-600">Error: User role not found</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Share {organizationName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Invite User Section */}
        {canInvite && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Invite Members
              </h3>
              {!showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Invite User
                </button>
              )}
            </div>

            {showInviteForm && (
              <form
                onSubmit={handleInviteUser}
                className="bg-gray-50 p-4 rounded-lg"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as OrganizationRole)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    >
                      {invitableRoles.map((role) => (
                        <option key={role} value={role}>
                          {formatRole(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isInviting ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Members ({members.length})
          </h3>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {member.users.name?.charAt(0) ||
                        member.users.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.users.name || "No name"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {member.users.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                      member.role as OrganizationRole
                    )}`}
                  >
                    {formatRole(member.role as OrganizationRole)}
                  </span>
                  {canManageMembers && member.users.id !== user?.id && (
                    <div className="flex items-center space-x-2">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateMemberRole(
                            member.id,
                            e.target.value as OrganizationRole
                          )
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1 text-black"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        {userRole === "owner" && (
                          <option value="owner">Owner</option>
                        )}
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Pending Invitations ({invitations.length})
            </h3>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 font-semibold">
                        {invitation.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {invitation.email}
                      </p>
                      <p className="text-sm text-gray-500">
                        Invited by {invitation.invited_by.name} •{" "}
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                        invitation.role as OrganizationRole
                      )}`}
                    >
                      {formatRole(invitation.role as OrganizationRole)}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                    {canInvite && (
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={confirmRemoveMember}
        title="Remove Member"
        message="Are you sure you want to remove this member from the organization?"
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
        isLoading={isRemoving}
      />
    </div>
  );
}

export default OrganizationSharing;
