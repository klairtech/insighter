"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import WorkspaceSharing from "@/components/WorkspaceSharing";
import AgentSharing from "@/components/AgentSharing";
import DatabaseConnectionModal from "@/components/DatabaseConnectionModal";
import DatabaseConnectionSuccessModal from "@/components/DatabaseConnectionSuccessModal";
import ExternalConnectionModal from "@/components/ExternalConnectionModal";
import NotificationModal from "@/components/NotificationModal";
import { useNotification } from "@/hooks/useNotification";
import { WorkspaceRole } from "@/lib/permissions";
import { useDataSourceConfig } from "@/hooks/useDataSourceConfig";
import Image from "next/image";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  userRole: WorkspaceRole;
}

interface Agent {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  agent_type: string;
  status: string;
  config: Record<string, unknown>;
  data_sources: Record<string, unknown>[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface File {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceDetailClientProps {
  initialWorkspace: Workspace;
  initialAgent: Agent | null;
  initialFiles: File[];
}

export default function WorkspaceDetailClient({
  initialWorkspace,
  initialAgent,
  initialFiles,
}: WorkspaceDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useSupabaseAuth();
  const { notification, showSuccess, showError, hideNotification } =
    useNotification();
  const { dataSources } = useDataSourceConfig();
  const [workspace] = useState<Workspace>(initialWorkspace);
  const [agent] = useState<Agent | null>(initialAgent);
  const [files] = useState<File[]>(initialFiles);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWorkspaceSharing, setShowWorkspaceSharing] = useState(false);
  const [showAgentSharing, setShowAgentSharing] = useState(false);
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);
  const [apiInfo, setApiInfo] = useState<{
    api_token: string;
    api_enabled: boolean;
    api_rate_limit: number;
    api_usage_count: number;
    last_api_used_at: string | null;
    api_token_expires_at: string;
    api_endpoint?: string;
  } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: workspace.name,
    description: workspace.description || "",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");

  /**
   * Helper function to update status messages
   */
  const updateStatus = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) => {
    setStatusMessage(message);
    setStatusType(type);
  };

  // Database connection modal state
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isRefreshingDatabases, setIsRefreshingDatabases] = useState(false);
  const [databaseConnections, setDatabaseConnections] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      host: string;
      port: string;
      database: string;
      username: string;
      schema_name: string;
      created_at: string;
      updated_at: string;
      last_schema_sync: string | null;
      schema_version: string;
    }>
  >([]);

  // External connection modal state
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalConnections, setExternalConnections] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      content_type: string;
      url: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      last_sync: string | null;
      connection_status: string;
      content_summary: string | null;
      row_count: number;
      column_count: number;
    }>
  >([]);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    connectionName: string;
    tablesProcessed: number;
  } | null>(null);

  // Fetch database connections
  const fetchDatabaseConnections = useCallback(async () => {
    try {
      if (!session?.access_token) {
        console.log(
          "🔐 Session not available yet, skipping database connections fetch"
        );
        return;
      }

      setIsLoadingDatabases(true);
      console.log(
        `🔍 Fetching database connections for workspace: ${workspace.id}`
      );
      const response = await fetch(
        `/api/workspaces/${workspace.id}/database-connections`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          console.error("❌ Authentication failed - session may have expired");
          // Could trigger a re-authentication flow here if needed
        } else {
          console.error(
            "❌ Failed to fetch database connections:",
            response.status,
            response.statusText
          );
        }
        return;
      }

      const connections = await response.json();

      if (Array.isArray(connections)) {
        setDatabaseConnections(connections);
      } else {
        console.error(
          "❌ Database connections fetch failed:",
          connections.error || "Invalid response format"
        );
      }
    } catch (error) {
      console.error("Error fetching database connections:", error);
    } finally {
      setIsLoadingDatabases(false);
    }
  }, [workspace.id, session?.access_token]);

  // Handle database connection success
  const handleDatabaseConnectionSuccess = (data: {
    connectionName: string;
    tablesProcessed: number;
  }) => {
    // Enhanced retry mechanism with exponential backoff
    const fetchWithRetry = async (retries = 5, delay = 500) => {
      try {
        // Check if we have a valid session and access token
        if (!session?.access_token) {
          console.error("❌ No valid session or access token available");
          setIsRefreshingDatabases(false);
          return;
        }

        setIsRefreshingDatabases(true);

        // Fetch connections directly to check the response
        const response = await fetch(
          `/api/workspaces/${workspace.id}/database-connections`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.error(
              "❌ Authentication failed - session may have expired"
            );
            // Don't retry on 401 errors as they won't succeed
            setIsRefreshingDatabases(false);
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const connections = await response.json();

        // Check if we actually got connections
        if (connections && connections.length > 0) {
          setDatabaseConnections(connections);
          setIsRefreshingDatabases(false);

          // Show success modal instead of toast
          setSuccessModalData(data);
          setShowSuccessModal(true);
          return;
        } else if (retries > 0) {
          setTimeout(() => fetchWithRetry(retries - 1, delay * 1.5), delay);
        } else {
          setIsRefreshingDatabases(false);
        }
      } catch (error) {
        console.error("❌ Failed to fetch database connections:", error);
        if (retries > 0) {
          setTimeout(() => fetchWithRetry(retries - 1, delay * 1.5), delay);
        } else {
          setIsRefreshingDatabases(false);
        }
      }
    };

    // Start with a small delay to allow database transaction to commit
    setTimeout(() => {
      fetchWithRetry();
    }, 200);

    // Refresh API info since data sources changed
    if (agent && agent.status === "active") {
      fetchApiInfo();
    }
  };

  // Handle workspace update
  const handleWorkspaceUpdate = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        const updatedWorkspace = await response.json();
        // Update the workspace state
        Object.assign(workspace, updatedWorkspace);
        setShowEditModal(false);
        // Show success message
        updateStatus("Workspace updated successfully!", "success");
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const error = await response.json();
        updateStatus(`Failed to update workspace: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Error updating workspace:", error);
      updateStatus("Failed to update workspace. Please try again.", "error");
    }
  };

  // Fetch external connections
  const fetchExternalConnections = useCallback(async () => {
    try {
      if (!session?.access_token) {
        console.log(
          "🔐 Session not available yet, skipping external connections fetch"
        );
        return;
      }

      // setIsLoadingExternal(true);
      console.log(
        `🔍 Fetching external connections for workspace: ${workspace.id}`
      );
      const response = await fetch(
        `/api/external-connections?workspaceId=${workspace.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(
          "❌ Failed to fetch external connections:",
          response.status,
          response.statusText
        );
        return;
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.connections)) {
        setExternalConnections(result.connections);
      } else {
        console.error(
          "❌ External connections fetch failed:",
          result.error || "Invalid response format"
        );
      }
    } catch (error) {
      console.error("Error fetching external connections:", error);
    } finally {
      // setIsLoadingExternal(false);
    }
  }, [workspace.id, session?.access_token]);

  // Handle external connection success
  const handleExternalConnectionSuccess = () => {
    fetchExternalConnections();
    showSuccess(
      "External data source connected successfully!",
      "External data source connected successfully!"
    );
  };

  // Handle workspace deletion
  const handleWorkspaceDeletion = async () => {
    if (deleteConfirmation !== workspace.name) {
      updateStatus(
        "Please type the exact workspace name to confirm deletion.",
        "error"
      );
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.ok) {
        updateStatus("Workspace deleted successfully!", "success");
        // Redirect to organizations page
        setTimeout(() => router.push("/organizations"), 1000);
      } else {
        const error = await response.json();
        updateStatus(`Failed to delete workspace: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      updateStatus("Failed to delete workspace. Please try again.", "error");
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      updateStatus("Please select files to upload.", "error");
      return;
    }

    setIsUploading(true);
    const uploadPromises = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append("file", file);

      uploadPromises.push(
        fetch(`/api/workspaces/${workspace.id}/files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        })
      );
    }

    try {
      const responses = await Promise.all(uploadPromises);
      const results = await Promise.all(responses.map((r) => r.json()));

      const successful = results.filter((r) => r.id);
      const failed = results.filter((r) => r.error);

      if (successful.length > 0) {
        updateStatus(
          `Successfully uploaded ${successful.length} file(s)!`,
          "success"
        );
        setShowUploadModal(false);
        setSelectedFiles(null);
        // Refresh the page to show new files and update API info
        setTimeout(() => window.location.reload(), 1000);
      }

      if (failed.length > 0) {
        updateStatus(
          `Failed to upload ${failed.length} file(s): ${failed
            .map((f) => f.error)
            .join(", ")}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      updateStatus("Failed to upload files. Please try again.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchApiInfo = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/agent-api`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.agent && result.agent.api_enabled) {
        setApiInfo(result.agent);
        return result.agent; // Return the API info
      } else {
        setApiInfo(null);
        return null;
      }
    } catch (error) {
      console.error("Error fetching API info:", error);
      setApiInfo(null);
      return null;
    }
  }, [workspace.id]);

  // Fetch API info when component loads and agent is available
  useEffect(() => {
    if (agent && agent.status === "active") {
      // Check if there are data sources (files or database connections)
      const hasDataSources = files.length > 0 || databaseConnections.length > 0;

      if (hasDataSources) {
        fetchApiInfo();
      } else {
        setApiInfo(null);
      }
    } else {
      setApiInfo(null);
    }
  }, [agent, fetchApiInfo, files.length, databaseConnections.length]);

  useEffect(() => {
    if (workspace.id && session?.access_token) {
      fetchDatabaseConnections();
      fetchExternalConnections();
    }
  }, [
    workspace.id,
    session?.access_token,
    fetchDatabaseConnections,
    fetchExternalConnections,
  ]);

  // Handle refresh parameter from database deletion
  useEffect(() => {
    if (searchParams.get("refresh") === "true" && session?.access_token) {
      // Force refresh database connections
      fetchDatabaseConnections();
      // Remove the refresh parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("refresh");
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [searchParams, session?.access_token, fetchDatabaseConnections, router]);

  const handleRegenerateToken = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/agent-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        showSuccess(
          "API Token Regenerated",
          "Your API token has been successfully regenerated!"
        );
        await fetchApiInfo(); // Refresh the API info
      } else {
        showError(
          "Token Regeneration Failed",
          result.error || "Failed to regenerate token"
        );
      }
    } catch (error) {
      console.error("Error regenerating token:", error);
      showError("Token Regeneration Failed", "Failed to regenerate API token");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-400">
            Please log in to access this workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={() =>
                  router.push(`/organizations/${workspace.organization_id}`)
                }
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Go to Organization"
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
                  {workspace.name}
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                    Workspace
                  </span>
                  <span className="text-gray-400 text-sm">
                    Created{" "}
                    {new Date(workspace.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            {workspace.description && (
              <p className="text-gray-300 text-lg max-w-3xl">
                {workspace.description}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <button
              onClick={() => setShowWorkspaceSharing(true)}
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

            {/* Only show edit button if user has owner permissions */}
            {workspace.userRole === "owner" && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
            {/* Only show delete button if user has owner/admin permissions */}
            {(workspace.userRole === "owner" ||
              workspace.userRole === "admin") && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-4 px-4 py-3 border rounded-lg ${
              statusType === "success"
                ? "bg-green-900/20 border-green-700"
                : statusType === "error"
                ? "bg-red-900/20 border-red-700"
                : statusType === "warning"
                ? "bg-yellow-900/20 border-yellow-700"
                : "bg-blue-900/20 border-blue-700"
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusType === "success" && (
                <svg
                  className="w-5 h-5 text-green-400"
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
              )}
              {statusType === "error" && (
                <svg
                  className="w-5 h-5 text-red-400"
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
              )}
              {statusType === "warning" && (
                <svg
                  className="w-5 h-5 text-yellow-400"
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
              )}
              {statusType === "info" && (
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <span
                className={`text-sm font-medium ${
                  statusType === "success"
                    ? "text-green-400"
                    : statusType === "error"
                    ? "text-red-400"
                    : statusType === "warning"
                    ? "text-yellow-400"
                    : "text-blue-400"
                }`}
              >
                {statusMessage}
              </span>
            </div>
          </div>
        )}

        {/* Main Content - Compact 3-Row Layout */}
        <div className="space-y-4">
          {/* Row 2: Agent Info and API Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent Info */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>AI Agent</span>
                </h2>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    agent?.status === "active"
                      ? "bg-green-600 text-white"
                      : "bg-gray-600 text-white"
                  }`}
                >
                  {agent?.status || "inactive"}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-white font-medium">
                  {agent?.name || "No Agent"}
                </p>
                <p className="text-gray-400 text-sm">
                  {agent?.description || "No description"}
                </p>
                <button
                  onClick={() => router.push(`/chat?agentId=${agent?.id}`)}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Chat with Agent
                </button>
              </div>
            </div>

            {/* API Info */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>API Integration</span>
                </h2>
                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                  Active
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-gray-300 text-sm">
                  {files.length > 0 || databaseConnections.length > 0
                    ? "Agent is ready for API access"
                    : "Upload files or connect database to activate API"}
                </p>
                <button
                  onClick={async () => {
                    if (apiInfo) {
                      setShowApiDetails(!showApiDetails);
                    } else {
                      const hasDataSources =
                        files.length > 0 || databaseConnections.length > 0;
                      if (!hasDataSources) {
                        updateStatus(
                          "API is not available yet. Please upload files or connect a database first to activate the API.",
                          "warning"
                        );
                      } else {
                        // Fetch API info when button is clicked
                        const fetchedApiInfo = await fetchApiInfo();
                        if (fetchedApiInfo) {
                          setShowApiDetails(true);
                        } else {
                          updateStatus(
                            "API information is not available. Please try again later.",
                            "error"
                          );
                        }
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  View API Details
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Files and Database */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Files Section */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Files ({files.length})</span>
                </h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
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
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Upload</span>
                </button>
              </div>

              {files.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    No files uploaded
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Upload Files
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {files.slice(0, 5).map((file) => (
                    <div
                      key={file.id}
                      className="bg-gray-700/30 rounded-lg p-3 border border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm truncate">
                              {file.filename}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {file.file_size} bytes
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              file.processing_status === "completed"
                                ? "bg-green-600 text-white"
                                : file.processing_status === "processing"
                                ? "bg-yellow-600 text-white"
                                : file.processing_status === "failed"
                                ? "bg-red-600 text-white"
                                : "bg-gray-600 text-white"
                            }`}
                          >
                            {file.processing_status}
                          </span>
                          <button
                            onClick={() => {
                              // Navigate to file detail page
                              router.push(
                                `/workspaces/${workspace.id}/files/${file.id}`
                              );
                            }}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                          >
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {files.length > 5 && (
                    <p className="text-gray-400 text-xs text-center py-2">
                      +{files.length - 5} more files
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Database Connections Section */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                  <span>
                    Data Sources (
                    {databaseConnections.length + externalConnections.length})
                  </span>
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowDatabaseModal(true)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
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
                        strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                    <span>Database</span>
                  </button>
                  <button
                    onClick={() => setShowExternalModal(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
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
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span>External</span>
                  </button>
                </div>
              </div>

              {databaseConnections.length === 0 &&
              externalConnections.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    No data sources connected
                  </p>
                  <div className="flex space-x-2 justify-center">
                    <button
                      onClick={() => setShowDatabaseModal(true)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Connect Database
                    </button>
                    <button
                      onClick={() => setShowExternalModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Connect External
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(isLoadingDatabases || isRefreshingDatabases) && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-400">
                        {isRefreshingDatabases
                          ? "Refreshing data sources..."
                          : "Loading data sources..."}
                      </span>
                    </div>
                  )}
                  {databaseConnections.slice(0, 5).map((connection) => {
                    const dbType = connection.type.toLowerCase();

                    // Find the data source configuration for this database type
                    const dataSource = dataSources?.find(
                      (source) => source.id === dbType
                    );

                    // Fallback colors and icons if data source config is not available
                    const fallbackColors: Record<string, string> = {
                      postgresql: "bg-blue-500",
                      mysql: "bg-orange-500",
                      mongodb: "bg-green-500",
                      redis: "bg-red-500",
                      sqlite: "bg-purple-500",
                      bigquery: "bg-yellow-500",
                      redshift: "bg-orange-600",
                    };
                    const fallbackIcons: Record<string, string> = {
                      postgresql: "P",
                      mysql: "M",
                      mongodb: "M",
                      redis: "R",
                      sqlite: "S",
                      bigquery: "B",
                      redshift: "R",
                    };

                    const dbColor =
                      dataSource?.color ||
                      fallbackColors[dbType] ||
                      "bg-gray-500";
                    const dbIcon =
                      dataSource?.icon || fallbackIcons[dbType] || "?";

                    return (
                      <div
                        key={connection.id}
                        className="bg-gray-700/30 rounded-lg p-3 border border-gray-600 cursor-pointer hover:bg-gray-600/30 transition-colors"
                        onClick={() => {
                          router.push(
                            `/workspaces/${workspace.id}/databases/${connection.id}`
                          );
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div
                              className={`w-6 h-6 ${dbColor} rounded flex items-center justify-center flex-shrink-0`}
                            >
                              {dbIcon.startsWith("http") ? (
                                <Image
                                  src={dbIcon}
                                  alt={connection.type}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 object-contain filter brightness-0 invert"
                                  onError={(e) => {
                                    // Fallback to text icon if image fails to load
                                    e.currentTarget.style.display = "none";
                                    const nextElement = e.currentTarget
                                      .nextElementSibling as HTMLElement;
                                    if (nextElement) {
                                      nextElement.style.display = "block";
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {dbIcon}
                                </span>
                              )}
                              {/* Fallback icon for failed image loads */}
                              <span
                                className="text-white text-xs font-bold hidden"
                                style={{ display: "none" }}
                              >
                                {fallbackIcons[dbType] || "?"}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm truncate">
                                {connection.name}
                              </p>
                              <p className="text-gray-400 text-xs capitalize">
                                {connection.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-green-400 text-xs">
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {databaseConnections.length > 5 && (
                    <p className="text-gray-400 text-xs text-center py-2">
                      +{databaseConnections.length - 5} more database
                      connections
                    </p>
                  )}

                  {/* External Connections */}
                  {externalConnections.slice(0, 5).map((connection) => {
                    const connectionType = connection.type.toLowerCase();

                    // Get the appropriate icon and color for external connections
                    const getExternalConnectionInfo = (type: string) => {
                      switch (type) {
                        case "google-sheets":
                          return {
                            color: "bg-green-500",
                            icon: "📊",
                            name: "Google Sheets",
                          };
                        case "google-docs":
                          return {
                            color: "bg-blue-500",
                            icon: "📄",
                            name: "Google Docs",
                          };
                        case "google-analytics":
                          return {
                            color: "bg-orange-500",
                            icon: "📈",
                            name: "Google Analytics",
                          };
                        case "web-url":
                          return {
                            color: "bg-purple-500",
                            icon: "🌐",
                            name: "Web URL",
                          };
                        default:
                          return {
                            color: "bg-gray-500",
                            icon: "🔗",
                            name: "External",
                          };
                      }
                    };

                    const connectionInfo =
                      getExternalConnectionInfo(connectionType);

                    return (
                      <div
                        key={connection.id}
                        className="bg-gray-700/50 rounded-lg p-3 border border-gray-600"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-lg ${connectionInfo.color} flex items-center justify-center`}
                            >
                              <span className="text-white text-sm">
                                {connectionInfo.icon}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm truncate">
                                {connection.name}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {connectionInfo.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                connection.connection_status === "active"
                                  ? "bg-green-500"
                                  : connection.connection_status === "error"
                                  ? "bg-red-500"
                                  : connection.connection_status === "syncing"
                                  ? "bg-yellow-500"
                                  : "bg-gray-500"
                              }`}
                            ></div>
                            <span
                              className={`text-xs ${
                                connection.connection_status === "active"
                                  ? "text-green-400"
                                  : connection.connection_status === "error"
                                  ? "text-red-400"
                                  : connection.connection_status === "syncing"
                                  ? "text-yellow-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {connection.connection_status === "active"
                                ? "Connected"
                                : connection.connection_status === "error"
                                ? "Error"
                                : connection.connection_status === "syncing"
                                ? "Syncing"
                                : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {externalConnections.length > 5 && (
                    <p className="text-gray-400 text-xs text-center py-2">
                      +{externalConnections.length - 5} more external
                      connections
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API Details Modal */}
        {showApiDetails && apiInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    API Documentation
                  </h2>
                  <button
                    onClick={() => setShowApiDetails(false)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-400"
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
              </div>
              <div className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
                {/* API Endpoint */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    API Endpoint
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="px-2 py-1 bg-green-600 text-white text-xs font-mono rounded">
                        POST
                      </span>
                      <code className="text-blue-400 font-mono text-sm">
                        {apiInfo.api_endpoint ||
                          `/api/agents/${agent?.id}/chat`}
                      </code>
                    </div>
                    <p className="text-gray-300 text-sm">
                      Send messages to your AI agent and get intelligent
                      responses based on your workspace data.
                    </p>
                  </div>
                </div>

                {/* Authentication */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Authentication
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        API Token
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type={showFullToken ? "text" : "password"}
                          value={apiInfo.api_token}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono"
                        />
                        <button
                          onClick={() => setShowFullToken(!showFullToken)}
                          className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
                        >
                          {showFullToken ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Include this token in the Authorization header:{" "}
                      <code className="bg-gray-700 px-1 rounded">
                        Authorization: Bearer YOUR_TOKEN
                      </code>
                    </div>
                  </div>
                </div>

                {/* Request Format */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Request Format
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Headers
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`Content-Type: application/json
Authorization: Bearer ${apiInfo.api_token?.substring(0, 20)}...`}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Request Body
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`{
  "conversation_id": "unique_conversation_id",
  "message": "Your question or message to the AI agent"
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Response Format */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Response Format
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Success Response (200)
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`{
  "id": "message_id",
  "conversation_id": "conversation_id",
  "content": "AI agent response text",
  "message_type": "agent_response",
  "metadata": {
    "files_referenced": ["file1.pdf", "file2.docx"],
    "confidence_score": 0.95,
    "processing_time_ms": 1250,
    "tokens_used": 150
  },
  "created_at": "2024-01-15T10:30:00Z"
}`}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        Error Response (4xx/5xx)
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Example Usage */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Example Usage
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        cURL
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`curl -X POST "${
                          apiInfo.api_endpoint ||
                          `/api/agents/${agent?.id}/chat`
                        }" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiInfo.api_token?.substring(0, 20)}..." \\
  -d '{
    "conversation_id": "my_conversation_123",
    "message": "What insights can you provide from my uploaded documents?"
  }'`}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">
                        JavaScript
                      </h4>
                      <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                        {`const response = await fetch('${
                          apiInfo.api_endpoint ||
                          `/api/agents/${agent?.id}/chat`
                        }', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiInfo.api_token?.substring(0, 20)}...'
  },
  body: JSON.stringify({
    conversation_id: 'my_conversation_123',
    message: 'What insights can you provide from my uploaded documents?'
  })
});

const data = await response.json();
console.log(data.content);`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Rate Limits & Usage */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Rate Limits & Usage
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Rate Limit
                        </label>
                        <p className="text-white">
                          {apiInfo.api_rate_limit} requests/hour
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Usage Count
                        </label>
                        <p className="text-white">{apiInfo.api_usage_count}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Token Expires
                      </label>
                      <p className="text-white">
                        {new Date(
                          apiInfo.api_token_expires_at
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowApiDetails(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRegenerateToken}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Regenerate Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Upload Files
                  </h2>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-400"
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
              </div>
              <div className="p-6">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <svg
                    className="w-12 h-12 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-300 mb-4">
                    Drag and drop files here, or click to select files
                  </p>
                  <p className="text-gray-400 text-sm">
                    Supported formats: PDF, DOCX, TXT, CSV, JSON, RTF
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.csv,.json,.rtf"
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => {
                      setSelectedFiles(e.target.files);
                    }}
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    Select Files
                  </label>
                </div>

                {/* Selected Files List */}
                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                    <h4 className="text-white text-sm font-medium mb-2">
                      Selected Files ({selectedFiles.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {Array.from(selectedFiles).map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-600/30 rounded p-2"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                              <svg
                                className="w-2 h-2 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <span className="text-white text-sm truncate">
                              {file.name}
                            </span>
                          </div>
                          <span className="text-gray-400 text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Footer with Cancel and Submit buttons */}
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={
                      !selectedFiles ||
                      selectedFiles.length === 0 ||
                      isUploading
                    }
                    className={`px-4 py-2 text-white text-sm rounded-lg transition-colors ${
                      selectedFiles && selectedFiles.length > 0 && !isUploading
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-600 cursor-not-allowed"
                    }`}
                  >
                    {isUploading ? "Uploading..." : "Upload Files"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWorkspaceSharing && (
          <WorkspaceSharing
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            userRole={workspace.userRole}
            onClose={() => setShowWorkspaceSharing(false)}
          />
        )}

        {showAgentSharing && agent && (
          <AgentSharing
            agentId={agent.id}
            agentName={agent.name}
            userRole={workspace.userRole}
            onClose={() => setShowAgentSharing(false)}
          />
        )}

        {/* Database Connection Modal */}
        <DatabaseConnectionModal
          isOpen={showDatabaseModal}
          onClose={() => setShowDatabaseModal(false)}
          onConnectionSuccess={handleDatabaseConnectionSuccess}
          workspaceId={workspace.id}
        />

        {/* Database Connection Success Modal */}
        {successModalData && (
          <DatabaseConnectionSuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false);
              setSuccessModalData(null);
            }}
            connectionName={successModalData.connectionName}
            tablesProcessed={successModalData.tablesProcessed}
            onViewDatabase={() => {
              setShowSuccessModal(false);
              setSuccessModalData(null);
              // Navigate to the first database connection
              if (databaseConnections.length > 0) {
                router.push(
                  `/workspaces/${workspace.id}/databases/${databaseConnections[0].id}`
                );
              }
            }}
          />
        )}

        {/* Edit Workspace Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Edit Workspace
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-400"
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
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWorkspaceUpdate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Workspace Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-red-800 to-red-900 px-6 py-4 border-b border-red-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Delete Workspace
                  </h2>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="p-2 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-400"
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
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
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
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        Are you sure?
                      </h3>
                      <p className="text-gray-400 text-sm">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                    <p className="text-red-300 text-sm">
                      <strong>Warning:</strong> Deleting this workspace will
                      permanently remove:
                    </p>
                    <ul className="text-red-300 text-sm mt-2 ml-4 list-disc">
                      <li>All files and data</li>
                      <li>AI agent configurations</li>
                      <li>Database connections</li>
                      <li>All associated conversations</li>
                    </ul>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Type the workspace name to confirm deletion:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder={workspace.name}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWorkspaceDeletion}
                    disabled={deleteConfirmation !== workspace.name}
                    className={`px-4 py-2 text-white text-sm rounded-lg transition-colors ${
                      deleteConfirmation === workspace.name
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gray-600 cursor-not-allowed"
                    }`}
                  >
                    Delete Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Details Modal - REMOVED - Now using dedicated page */}

        {/* Database Connection Modal */}
        <DatabaseConnectionModal
          isOpen={showDatabaseModal}
          onClose={() => setShowDatabaseModal(false)}
          onConnectionSuccess={handleDatabaseConnectionSuccess}
          workspaceId={workspace.id}
        />

        {/* External Connection Modal */}
        <ExternalConnectionModal
          isOpen={showExternalModal}
          onClose={() => setShowExternalModal(false)}
          onConnectionSuccess={handleExternalConnectionSuccess}
          workspaceId={workspace.id}
        />

        {/* Notification Modal */}
        <NotificationModal
          isOpen={notification.isOpen}
          onClose={hideNotification}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          details={notification.details}
          onConfirm={notification.onConfirm}
          confirmText={notification.confirmText}
          showCancel={notification.showCancel}
          cancelText={notification.cancelText}
          autoClose={notification.autoClose}
          autoCloseDelay={notification.autoCloseDelay}
        />
      </div>
    </div>
  );
}
