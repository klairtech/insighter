"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { formatRole, getRoleColor, OrganizationRole } from "@/lib/permissions";
import Link from "next/link";

interface InvitationDetails {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  organizations: {
    id: string;
    name: string;
    description?: string;
  };
}

const AcceptInvitationPageContent: React.FC = () => {
  const authContext = useSupabaseAuth();
  const { user, session } = authContext || { user: null, session: null };
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadInvitationDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`/api/invitations/accept?token=${token}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load invitation");
      }

      const data = await response.json();
      setInvitation(data.invitation);
    } catch (err) {
      console.error("Error loading invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load invitation"
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, session?.access_token]);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setIsLoading(false);
      return;
    }

    if (user && session) {
      loadInvitationDetails();
    } else {
      // Redirect to login with return URL
      router.push(
        `/login?redirect=${encodeURIComponent(window.location.href)}`
      );
    }
  }, [token, user, session, router, loadInvitationDetails]);

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    try {
      setIsProcessing(true);
      setError("");

      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invitation");
      }

      setSuccess(true);

      // Redirect to organizations page after 3 seconds
      setTimeout(() => {
        router.push("/organizations");
      }, 3000);
    } catch (err) {
      console.error("Error accepting invitation:", err);
      setError(
        err instanceof Error ? err.message : "Failed to accept invitation"
      );
    } finally {
      setIsProcessing(false);
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="h-6 w-6 text-blue-600"
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
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Organization Invitation
          </h2>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading invitation details...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
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
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/organizations"
                className="text-sm text-red-600 hover:text-red-500"
              >
                ← Back to Organizations
              </Link>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-400 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <p className="mt-1 text-sm text-green-700">
                  You&apos;ve successfully joined{" "}
                  {invitation?.organizations.name}. Redirecting to
                  organizations...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Invitation Details */}
        {invitation && !error && !success && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold text-xl">
                  {invitation.organizations.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                {invitation.organizations.name}
              </h3>
              {invitation.organizations.description && (
                <p className="text-gray-600 mt-2">
                  {invitation.organizations.description}
                </p>
              )}
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-500">Role</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(
                    invitation.role as OrganizationRole
                  )}`}
                >
                  {formatRole(invitation.role as OrganizationRole)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-500">
                  Invited
                </span>
                <span className="text-sm text-gray-900">
                  {formatDate(invitation.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-500">
                  Expires
                </span>
                <span className="text-sm text-gray-900">
                  {formatDate(invitation.expires_at)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAcceptInvitation}
                disabled={isProcessing}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Accepting...
                  </div>
                ) : (
                  "Accept Invitation"
                )}
              </button>

              <Link
                href="/organizations"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AcceptInvitationPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading invitation...</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationPageContent />
    </Suspense>
  );
};

export default AcceptInvitationPage;
