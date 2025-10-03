"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
// import { useLoading } from "@/contexts/LoadingContext"; // Removed for performance optimization
import WorkspaceSharing from "@/components/WorkspaceSharing";
import AgentSharing from "@/components/AgentSharing";
import DatabaseConnectionSuccessModal from "@/components/DatabaseConnectionSuccessModal";
import UnifiedConnectionModal from "@/components/UnifiedConnectionModal";
import NotificationModal from "@/components/NotificationModal";
import { useNotification } from "@/hooks/useNotification";
import { WorkspaceRole } from "@/lib/permissions";
import { useDataSourceConfig } from "@/hooks/useDataSourceConfig";
import { useAnalytics } from "@/hooks/useAnalytics";
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

  // Add safety check for SupabaseAuth context
  let user, session;
  try {
    const auth = useSupabaseAuth();
    user = auth?.user;
    session = auth?.session;
  } catch {
    user = null;
    session = null;
  }

  const { notification, showSuccess, showError, hideNotification } =
    useNotification();
  // Loading states removed for performance optimization
  const { dataSources } = useDataSourceConfig();
  const { trackStartChat, trackConnectDataSource, trackUploadFile } =
    useAnalytics();
  const [workspace] = useState<Workspace>(initialWorkspace);
  const [agent] = useState<Agent | null>(initialAgent);
  const [files, setFiles] = useState<File[]>(
    Array.isArray(initialFiles) ? initialFiles : []
  );

  // Files state initialized

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWorkspaceSharing, setShowWorkspaceSharing] = useState(false);
  const [showAgentSharing, setShowAgentSharing] = useState(false);
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);
  const [activeApiTab, setActiveApiTab] = useState("Overview");
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

  // Unified connection modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
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
        return;
      }

      setIsLoadingDatabases(true);
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
          // Could trigger a re-authentication flow here if needed
        }
        return;
      }

      const connections = await response.json();

      if (Array.isArray(connections)) {
        setDatabaseConnections(connections);
      }
    } catch {
    } finally {
      setIsLoadingDatabases(false);
    }
  }, [workspace.id, session?.access_token]);

  // Function to fetch files
  const fetchFiles = async () => {
    try {
      if (!session?.access_token) return;

      // Fetching files for workspace
      const response = await fetch(`/api/workspaces/${workspace.id}/files`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const filesData = await response.json();
        // Files fetched successfully
        const safeFiles = Array.isArray(filesData) ? filesData : [];
        // Setting files state
        setFiles(safeFiles);
      } else {
        console.error(
          "❌ Failed to fetch files:",
          response.status,
          response.statusText
        );
        setFiles([]); // Ensure files is always an array
      }
    } catch (error) {
      console.error("❌ Error fetching files:", error);
      setFiles([]); // Ensure files is always an array even on error
    }
  };

  // Handle unified connection success
  const handleConnectionSuccess = (data: {
    connectionName: string;
    connectionType: string;
    tablesProcessed?: number;
  }) => {
    // Connection established successfully

    // Track data source connection
    trackConnectDataSource(data.connectionType);

    // Handle different connection types
    if (
      ["postgresql", "mysql", "redshift", "sqlite"].includes(
        data.connectionType
      )
    ) {
      // Database connection
      const fetchWithRetry = async (retries = 5, delay = 500) => {
        try {
          if (!session?.access_token) {
            setIsRefreshingDatabases(false);
            return;
          }

          setIsRefreshingDatabases(true);

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
              setIsRefreshingDatabases(false);
              return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const connections = await response.json();

          if (connections && connections.length > 0) {
            setDatabaseConnections(connections);
            setIsRefreshingDatabases(false);

            // Show success modal for database connections
            setSuccessModalData({
              connectionName: data.connectionName,
              tablesProcessed: data.tablesProcessed || 0,
            });
            setShowSuccessModal(true);
            setShowConnectionModal(false);
            return;
          } else if (retries > 0) {
            setTimeout(() => fetchWithRetry(retries - 1, delay * 1.5), delay);
          } else {
            setIsRefreshingDatabases(false);
          }
        } catch {
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
    } else if (
      ["google-sheets", "google-docs", "google-analytics", "web-url"].includes(
        data.connectionType
      )
    ) {
      // External connection
      fetchExternalConnections();
      showSuccess(
        "External data source connected successfully!",
        "External data source connected successfully!"
      );
      setShowConnectionModal(false);
    } else {
      // Check if this is a file connection by looking up the data source category
      // This is more scalable than hardcoding file types
      const dataSource = dataSources.find(
        (ds) => ds.id === data.connectionType
      );

      if (dataSource && dataSource.category === "file") {
        // File connection - refresh files and trigger page refresh
        // File connection success, refreshing files
        fetchFiles();
        // Don't show additional success notification - modal already shows success message
        setShowConnectionModal(false);
        // Trigger page refresh to ensure all data is up to date
        window.location.reload();
      } else {
        // Non-file connection or unknown connection type - just close modal
        // Non-file connection, closing modal
        setShowConnectionModal(false);
      }
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
    } catch {
      updateStatus("Failed to update workspace. Please try again.", "error");
    }
  };

  // Fetch external connections
  const fetchExternalConnections = useCallback(async () => {
    try {
      if (!session?.access_token) {
        return;
      }

      // setIsLoadingExternal(true);
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
        return;
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.connections)) {
        setExternalConnections(result.connections);
      }
    } catch {
    } finally {
      // setIsLoadingExternal(false);
    }
  }, [workspace.id, session?.access_token]);

  // Handle external connection success

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
    } catch {
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

      // Track file upload
      trackUploadFile(file.type, file.size);

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
    } catch {
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
    } catch {
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

  // Add null check for workspace after all hooks
  if (!initialWorkspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Workspace Not Found
          </h1>
          <p className="text-gray-400">
            The workspace you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  const handleRegenerateToken = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspace.id}/agent-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "regenerate_token",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.message) {
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
    } catch {
      showError("Token Regeneration Failed", "Failed to regenerate API token");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
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
          {/* Row 2: Enhanced Agent and API Section - Only show if there are data sources */}
          {(files.length > 0 ||
            databaseConnections.length > 0 ||
            externalConnections.length > 0) && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Enhanced AI Agent Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
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
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          AI Agent
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Intelligent workspace assistant
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-medium ${
                        agent?.status === "active"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                      }`}
                    >
                      {agent?.status || "inactive"}
                    </span>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 relative">
                    {/* Action buttons in top right */}
                    {(workspace.userRole === "owner" ||
                      workspace.userRole === "admin") &&
                      agent && (
                        <div className="absolute top-3 right-3 flex space-x-1">
                          <button
                            onClick={() => setShowAgentSharing(true)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                            title="Share Agent"
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
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Implement agent editing
                              updateStatus(
                                "Agent editing coming soon!",
                                "info"
                              );
                            }}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                            title="Edit Agent"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        </div>
                      )}

                    {/* Agent content */}
                    <div className="pr-16">
                      <h4 className="text-white font-medium mb-2 text-lg">
                        {agent?.name || "No Agent Configured"}
                      </h4>
                      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        {agent?.description ||
                          "Configure an AI agent to analyze your workspace data and answer questions."}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        trackStartChat(workspace.id);
                        router.push(`/chat?agentId=${agent?.id}`);
                      }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                    >
                      <div className="flex items-center justify-center space-x-2">
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
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        <span>Chat with Agent</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Enhanced API Integration Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
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
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          API Integration
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Programmatic access to your data
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs rounded-full font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-5 border border-gray-700/50 relative">
                    {/* Rate limit info in top right */}
                    <div className="absolute top-3 right-3 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">Rate Limit</span>
                      <span className="text-sm text-white font-medium">
                        {apiInfo?.api_rate_limit || "100"}/hour
                      </span>
                    </div>

                    <div className="mb-6 pr-24">
                      <h4 className="text-white font-medium mb-2 text-lg">
                        REST API
                      </h4>
                      <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                        {files.length > 0 || databaseConnections.length > 0
                          ? "Ready for integration"
                          : "Connect data sources to activate"}
                      </p>
                    </div>

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
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                    >
                      <div className="flex items-center justify-center space-x-2">
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
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <span>View API Details</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Unified Data Sources Section (Full Width) */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
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
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Data Sources (
                    {files.length +
                      databaseConnections.length +
                      externalConnections.length}
                    )
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Connect files, databases and external sources
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Opening connection modal
                  setShowConnectionModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center space-x-2"
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
                <span>Connect Source</span>
              </button>
            </div>

            {files.length === 0 &&
            databaseConnections.length === 0 &&
            externalConnections.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-600">
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
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-white font-medium mb-2">
                  No data sources connected
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Connect files, databases, or external sources to start
                  analyzing your data
                </p>
                <button
                  onClick={() => {
                    // Opening connection modal
                    setShowConnectionModal(true);
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                >
                  Connect Your First Source
                </button>
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

                {/* Files */}
                {Array.isArray(files) &&
                  files.length > 0 &&
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 cursor-pointer hover:bg-gray-800/50 hover:border-gray-600/50 transition-all duration-200 group"
                      onClick={() => {
                        router.push(
                          `/workspaces/${workspace.id}/files/${file.id}`
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                            <svg
                              className="w-4 h-4 text-white"
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
                            <p className="text-white text-sm font-medium truncate">
                              {file.filename}
                            </p>
                            <p className="text-gray-400 text-xs">
                              File • {(file.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full border ${
                              file.processing_status === "completed"
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : file.processing_status === "processing"
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                : file.processing_status === "failed"
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            }`}
                          >
                            {file.processing_status}
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors"
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
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Database Connections */}
                {databaseConnections.map((connection) => {
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
                      className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 cursor-pointer hover:bg-gray-800/50 hover:border-gray-600/50 transition-all duration-200 group"
                      onClick={() => {
                        router.push(
                          `/workspaces/${workspace.id}/databases/${connection.id}`
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div
                            className={`w-8 h-8 ${dbColor} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
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
                            <p className="text-white text-sm font-medium truncate">
                              {connection.name}
                            </p>
                            <p className="text-gray-400 text-xs capitalize">
                              {connection.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                            Connected
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors"
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
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* External Connections */}
                {externalConnections.map((connection) => {
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
              </div>
            )}
          </div>
        </div>

        {/* API Details Modal */}
        {showApiDetails && apiInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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

              {/* Tab Navigation */}
              <div className="bg-gray-900 border-b border-gray-700">
                <nav className="flex space-x-8 px-6">
                  {[
                    "Overview",
                    "Authentication",
                    "Instructions",
                    "Examples",
                    "Reference",
                  ].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveApiTab(tab)}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeApiTab === tab
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
                {/* Overview Tab */}
                {activeApiTab === "Overview" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        API Overview
                      </h3>
                      <div className="bg-gray-900 rounded-lg p-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
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
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-white font-medium text-lg">
                              AI Agent API
                            </h4>
                            <p className="text-gray-400 text-sm">
                              Intelligent conversation endpoint
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="bg-gray-800 rounded-lg p-4">
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

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">
                                Rate Limit
                              </span>
                              <span className="text-white font-medium">
                                {apiInfo.api_rate_limit}/hour
                              </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">
                                Usage
                              </span>
                              <span className="text-white font-medium">
                                {apiInfo.api_usage_count} requests
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-400">
                                Expires
                              </span>
                              <span className="text-white font-medium text-xs">
                                {new Date(
                                  apiInfo.api_token_expires_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <svg
                              className="w-5 h-5 text-blue-400 mt-0.5"
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
                            <div>
                              <h5 className="text-blue-400 font-medium mb-1">
                                Quick Start
                              </h5>
                              <p className="text-gray-300 text-sm">
                                Use your API token to authenticate requests. The
                                agent can analyze your uploaded files, database
                                connections, and external data sources to
                                provide intelligent responses.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Authentication Tab */}
                {activeApiTab === "Authentication" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Authentication
                      </h3>
                      <div className="bg-gray-900 rounded-lg p-6">
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-300 mb-3">
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
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    apiInfo.api_token
                                  );
                                  showSuccess(
                                    "Copied!",
                                    "API token copied to clipboard"
                                  );
                                } catch {
                                  showError(
                                    "Copy Failed",
                                    "Failed to copy API token to clipboard"
                                  );
                                }
                              }}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
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
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Copy</span>
                            </button>
                            <button
                              onClick={() => setShowFullToken(!showFullToken)}
                              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
                            >
                              {showFullToken ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                          <h4 className="text-white font-medium mb-3">
                            How to Use
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-400 mb-2">
                                Include the token in the Authorization header:
                              </p>
                              <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-300 block">
                                Authorization: Bearer{" "}
                                {apiInfo.api_token?.substring(0, 20)}...
                              </code>
                            </div>
                            <div>
                              <p className="text-sm text-gray-400 mb-2">
                                Required headers:
                              </p>
                              <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-300 block">
                                Content-Type: application/json
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions Tab */}
                {activeApiTab === "Instructions" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        API Usage Instructions
                      </h3>

                      {/* Request Fields */}
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <h4 className="text-white font-medium mb-4">
                          Request Fields
                        </h4>
                        <div className="space-y-4">
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  1
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  conversation_id
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> String (required)
                                </p>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Description:</strong> A unique
                                  identifier for your conversation session. This
                                  helps maintain context across multiple
                                  messages in the same conversation.
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Example:</strong>{" "}
                                  <code className="bg-gray-700 px-1 rounded">
                                    &quot;my_conversation_123&quot;
                                  </code>
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  2
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  message
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> String (required)
                                </p>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Description:</strong> Your question or
                                  message to the AI agent. The agent will
                                  analyze this message along with your workspace
                                  data to provide intelligent responses.
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Example:</strong>{" "}
                                  <code className="bg-gray-700 px-1 rounded">
                                    &quot;What insights can you provide from my
                                    uploaded documents?&quot;
                                  </code>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Response Fields */}
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <h4 className="text-white font-medium mb-4">
                          Response Fields
                        </h4>
                        <div className="space-y-4">
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  1
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  response_text
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> String
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> The AI
                                  agent&apos;s response text. This is the main
                                  content you&apos;ll want to display to your
                                  users.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  2
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  response_image_url
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> String (optional)
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> URL to generated
                                  images, charts, or visualizations when
                                  applicable.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  3
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  conversation_id
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> String
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Echoes back the
                                  conversation ID you provided in the request.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  4
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  credits_used
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Number
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Number of
                                  credits consumed for this API call.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  5
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  credits_remaining
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Number (optional)
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Your remaining
                                  credit balance after this API call.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  6
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  processing_time_ms
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Number
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Time taken to
                                  process your request in milliseconds.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  7
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  xai_metrics
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Object (optional)
                                </p>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Description:</strong> eXplainable AI
                                  metrics including:
                                </p>
                                <ul className="text-gray-300 text-sm ml-4 space-y-1">
                                  <li>
                                    • <strong>confidence_score:</strong>{" "}
                                    AI&apos;s confidence (0.0-1.0)
                                  </li>
                                  <li>
                                    • <strong>data_quality_score:</strong>{" "}
                                    Quality of input data (0.0-1.0)
                                  </li>
                                  <li>
                                    •{" "}
                                    <strong>
                                      response_completeness_score:
                                    </strong>{" "}
                                    How complete the response is (0.0-1.0)
                                  </li>
                                  <li>
                                    •{" "}
                                    <strong>
                                      user_satisfaction_prediction:
                                    </strong>{" "}
                                    Predicted user satisfaction (0.0-1.0)
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  8
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  agent_thinking_notes
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Array of Strings
                                  (optional)
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Internal
                                  reasoning steps and decision-making process of
                                  the AI agent.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  9
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  sql_queries
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Array of Strings
                                  (optional)
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> SQL queries
                                  executed to retrieve data from connected
                                  databases.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  10
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  graph_data
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Object (optional)
                                </p>
                                <p className="text-gray-300 text-sm">
                                  <strong>Description:</strong> Structured data
                                  for generating charts, graphs, and
                                  visualizations.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  11
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  token_tracking
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Object (optional)
                                </p>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Description:</strong> Detailed token
                                  usage breakdown including:
                                </p>
                                <ul className="text-gray-300 text-sm ml-4 space-y-1">
                                  <li>
                                    • <strong>userInputTokens:</strong> Tokens
                                    from your message
                                  </li>
                                  <li>
                                    • <strong>systemPromptTokens:</strong>{" "}
                                    System prompt tokens
                                  </li>
                                  <li>
                                    • <strong>contextTokens:</strong> Context
                                    data tokens
                                  </li>
                                  <li>
                                    • <strong>totalTokensUsed:</strong> Total
                                    tokens consumed
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">
                                  12
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-medium mb-2">
                                  rag_context
                                </h5>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Type:</strong> Object (optional)
                                </p>
                                <p className="text-gray-300 text-sm mb-2">
                                  <strong>Description:</strong>{" "}
                                  Retrieval-Augmented Generation context
                                  including:
                                </p>
                                <ul className="text-gray-300 text-sm ml-4 space-y-1">
                                  <li>
                                    • <strong>retrieved_chunks:</strong> Number
                                    of data chunks retrieved
                                  </li>
                                  <li>
                                    • <strong>similarity_scores:</strong>{" "}
                                    Relevance scores for retrieved data
                                  </li>
                                  <li>
                                    • <strong>source_documents:</strong> Names
                                    of source documents used
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Best Practices */}
                      <div className="bg-gray-900 rounded-lg p-6">
                        <h4 className="text-white font-medium mb-4">
                          Best Practices
                        </h4>
                        <div className="space-y-4">
                          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <svg
                                className="w-5 h-5 text-blue-400 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                              </svg>
                              <div>
                                <h5 className="text-blue-400 font-medium mb-1">
                                  Conversation Management
                                </h5>
                                <p className="text-gray-300 text-sm">
                                  Use consistent conversation IDs to maintain
                                  context. Start new conversations with a new ID
                                  when the topic changes significantly.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <svg
                                className="w-5 h-5 text-green-400 mt-0.5"
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
                              <div>
                                <h5 className="text-green-400 font-medium mb-1">
                                  Message Quality
                                </h5>
                                <p className="text-gray-300 text-sm">
                                  Be specific in your questions. The more
                                  context you provide, the better the AI can
                                  analyze your data and provide relevant
                                  insights.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <svg
                                className="w-5 h-5 text-yellow-400 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <div>
                                <h5 className="text-yellow-400 font-medium mb-1">
                                  Rate Limiting
                                </h5>
                                <p className="text-gray-300 text-sm">
                                  Respect the rate limits. Implement exponential
                                  backoff if you hit rate limits, and consider
                                  caching responses when appropriate.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Examples Tab */}
                {activeApiTab === "Examples" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Code Examples
                      </h3>

                      {/* cURL Example */}
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                              <span className="text-white font-mono text-sm">
                                $
                              </span>
                            </div>
                            <h4 className="text-white font-medium">cURL</h4>
                          </div>
                          <button
                            onClick={async () => {
                              const curlCommand = `curl -X POST "${
                                apiInfo.api_endpoint ||
                                `/api/agents/${agent?.id}/chat`
                              }" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiInfo.api_token}" \\
  -d '{
    "conversation_id": "my_conversation_123",
    "message": "What insights can you provide from my uploaded documents?"
  }'`;
                              try {
                                await navigator.clipboard.writeText(
                                  curlCommand
                                );
                                showSuccess(
                                  "Copied!",
                                  "cURL command copied to clipboard"
                                );
                              } catch {
                                showError(
                                  "Copy Failed",
                                  "Failed to copy cURL command"
                                );
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="bg-gray-800 rounded p-4 text-sm text-gray-300 overflow-x-auto">
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

                      {/* JavaScript Example */}
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-yellow-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                JS
                              </span>
                            </div>
                            <h4 className="text-white font-medium">
                              JavaScript
                            </h4>
                          </div>
                          <button
                            onClick={async () => {
                              const jsCode = `const response = await fetch('${
                                apiInfo.api_endpoint ||
                                `/api/agents/${agent?.id}/chat`
                              }', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiInfo.api_token}'
  },
  body: JSON.stringify({
    conversation_id: 'my_conversation_123',
    message: 'What insights can you provide from my uploaded documents?'
  })
});

const data = await response.json();
`;
                              try {
                                await navigator.clipboard.writeText(jsCode);
                                showSuccess(
                                  "Copied!",
                                  "JavaScript code copied to clipboard"
                                );
                              } catch {
                                showError(
                                  "Copy Failed",
                                  "Failed to copy JavaScript code"
                                );
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="bg-gray-800 rounded p-4 text-sm text-gray-300 overflow-x-auto">
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
`}
                        </pre>
                      </div>

                      {/* Python Example */}
                      <div className="bg-gray-900 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                PY
                              </span>
                            </div>
                            <h4 className="text-white font-medium">Python</h4>
                          </div>
                          <button
                            onClick={async () => {
                              const pythonCode = `import requests

url = '${apiInfo.api_endpoint || `/api/agents/${agent?.id}/chat`}'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiInfo.api_token}'
}
data = {
    'conversation_id': 'my_conversation_123',
    'message': 'What insights can you provide from my uploaded documents?'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result['response_text'])`;
                              try {
                                await navigator.clipboard.writeText(pythonCode);
                                showSuccess(
                                  "Copied!",
                                  "Python code copied to clipboard"
                                );
                              } catch {
                                showError(
                                  "Copy Failed",
                                  "Failed to copy Python code"
                                );
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="bg-gray-800 rounded p-4 text-sm text-gray-300 overflow-x-auto">
                          {`import requests

url = '${apiInfo.api_endpoint || `/api/agents/${agent?.id}/chat`}'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiInfo.api_token?.substring(0, 20)}...'
}
data = {
    'conversation_id': 'my_conversation_123',
    'message': 'What insights can you provide from my uploaded documents?'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result['content'])`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reference Tab */}
                {activeApiTab === "Reference" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        API Reference
                      </h3>

                      {/* Request Format */}
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <h4 className="text-white font-medium mb-4">
                          Request Format
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">
                              Headers
                            </h5>
                            <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                              {`Content-Type: application/json
Authorization: Bearer ${apiInfo.api_token?.substring(0, 20)}...`}
                            </pre>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">
                              Request Body
                            </h5>
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
                      <div className="bg-gray-900 rounded-lg p-6 mb-6">
                        <h4 className="text-white font-medium mb-4">
                          Response Format
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">
                              Success Response (200)
                            </h5>
                            <pre className="bg-gray-800 rounded p-3 text-sm text-gray-300 overflow-x-auto">
                              {`{
  "response_text": "AI agent response text",
  "response_image_url": "https://example.com/chart.png",
  "conversation_id": "my_conversation_123",
  "credits_used": 5,
  "credits_remaining": 95,
  "processing_time_ms": 1250,
  "xai_metrics": {
    "confidence_score": 0.95,
    "data_quality_score": 0.88,
    "response_completeness_score": 0.92,
    "user_satisfaction_prediction": 0.89
  },
  "agent_thinking_notes": [
    "Analyzing user query for data requirements",
    "Retrieving relevant data from connected sources",
    "Generating comprehensive response"
  ],
  "sql_queries": [
    "SELECT * FROM users WHERE created_at > '2024-01-01'"
  ],
  "graph_data": {
    "chart_type": "bar",
    "data": [{"label": "Q1", "value": 100}]
  },
  "token_tracking": {
    "userInputTokens": 25,
    "systemPromptTokens": 150,
    "contextTokens": 200,
    "totalTokensUsed": 375
  },
  "rag_context": {
    "retrieved_chunks": 3,
    "similarity_scores": [0.95, 0.87, 0.82],
    "source_documents": ["database_connection_1", "file_upload_2"]
  }
}`}
                            </pre>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">
                              Error Response (4xx/5xx)
                            </h5>
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

                      {/* Rate Limits */}
                      <div className="bg-gray-900 rounded-lg p-6">
                        <h4 className="text-white font-medium mb-4">
                          Rate Limits & Usage
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-gray-400">
                                Rate Limit
                              </span>
                            </div>
                            <p className="text-white font-medium">
                              {apiInfo.api_rate_limit} requests/hour
                            </p>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm text-gray-400">
                                Usage Count
                              </span>
                            </div>
                            <p className="text-white font-medium">
                              {apiInfo.api_usage_count}
                            </p>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm text-gray-400">
                                Token Expires
                              </span>
                            </div>
                            <p className="text-white font-medium text-xs">
                              {new Date(
                                apiInfo.api_token_expires_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 p-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowApiDetails(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                {activeApiTab === "Authentication" && (
                  <button
                    onClick={handleRegenerateToken}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Regenerate Token
                  </button>
                )}
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

        {/* Unified Connection Modal */}
        {workspace?.id && (
          <UnifiedConnectionModal
            isOpen={showConnectionModal}
            onClose={() => setShowConnectionModal(false)}
            onConnectionSuccess={handleConnectionSuccess}
            workspaceId={workspace.id}
          />
        )}

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
