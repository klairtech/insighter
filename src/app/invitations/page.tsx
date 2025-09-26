"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useRouter } from "next/navigation";
import { formatRole, getRoleColor, OrganizationRole } from "@/lib/permissions";
import Link from "next/link";

interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  token: string;
  organizations: {
    id: string;
    name: string;
    description?: string;
  };
  users: {
    name: string;
    email: string;
  };
}

const InvitationsPage: React.FC = () => {
  const { user, session } = useSupabaseAuth();
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingInvitation, setProcessingInvitation] = useState<
    string | null
  >(null);

  const loadInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/user/invitations", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load invitations");
      }

      const data = await response.json();
      setInvitations(data);
    } catch (err) {
      console.error("Error loading invitations:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load invitations"
      );
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (user && session) {
      loadInvitations();
    } else if (!user) {
      router.push("/login");
    }
  }, [user, session, router, loadInvitations]);

  const handleAcceptInvitation = async (invitation: Invitation) => {
    try {
      setProcessingInvitation(invitation.id);
      setError("");

      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ token: invitation.token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invitation");
      }

      await response.json();

      // Remove the accepted invitation from the list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));

      // Redirect to organizations page
      router.push("/organizations");
    } catch (err) {
      console.error("Error accepting invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to accept invitation"
      );
    } finally {
      setProcessingInvitation(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      setProcessingInvitation(invitationId);
      setError("");

      // For now, we'll just remove it from the local state
      // In a full implementation, you'd want to update the invitation status in the database
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (err) {
      console.error("Error declining invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to decline invitation"
      );
    } finally {
      setProcessingInvitation(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry =
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24; // Expires within 24 hours
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Invitations</h1>
          <p className="mt-2 text-gray-600">
            Manage your pending organization invitations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-400 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading invitations...</span>
          </div>
        )}

        {/* No Invitations */}
        {!isLoading && invitations.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No pending invitations
            </h3>
            <p className="text-gray-600 mb-6">
              You don&apos;t have any pending organization invitations at the
              moment.
            </p>
            <Link
              href="/organizations"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Organizations
            </Link>
          </div>
        )}

        {/* Invitations List */}
        {!isLoading && invitations.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  Pending Invitations ({invitations.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-lg">
                              {invitation.organizations.name
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {invitation.organizations.name}
                            </h3>
                            {invitation.organizations.description && (
                              <p className="text-sm text-gray-600">
                                {invitation.organizations.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Invited by:</span>{" "}
                            {invitation.users.name || invitation.users.email}
                          </div>
                          <div>
                            <span className="font-medium">Role:</span>{" "}
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                                invitation.role as OrganizationRole
                              )}`}
                            >
                              {formatRole(invitation.role as OrganizationRole)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Invited on:</span>{" "}
                            {formatDate(invitation.created_at)}
                          </div>
                          <div>
                            <span className="font-medium">Expires:</span>{" "}
                            <span
                              className={
                                isExpiringSoon(invitation.expires_at)
                                  ? "text-red-600 font-medium"
                                  : ""
                              }
                            >
                              {formatDate(invitation.expires_at)}
                            </span>
                          </div>
                        </div>

                        {isExpiringSoon(invitation.expires_at) && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center">
                              <svg
                                className="w-5 h-5 text-yellow-400 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                              </svg>
                              <p className="text-yellow-800 text-sm">
                                This invitation expires soon!
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-2 ml-6">
                        <button
                          onClick={() => handleAcceptInvitation(invitation)}
                          disabled={processingInvitation === invitation.id}
                          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {processingInvitation === invitation.id ? (
                            <div className="flex items-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Accepting...
                            </div>
                          ) : (
                            "Accept"
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          disabled={processingInvitation === invitation.id}
                          className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationsPage;
