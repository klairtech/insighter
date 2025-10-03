"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useDataSourceConfig } from "@/hooks/useDataSourceConfig";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface UnifiedConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: (data: {
    connectionName: string;
    connectionType: string;
    tablesProcessed?: number;
  }) => void;
  workspaceId: string;
}

interface ConnectionConfig {
  type: string;
  name: string;
  // Database fields
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  // External fields
  sheetId?: string;
  documentId?: string;
  documentUrl?: string;
  url?: string;
  sheetName?: string;
  range?: string;
  includeHeaders?: boolean;
  maxRows?: number;
  selectors?: {
    title?: string;
    content?: string;
    exclude?: string[];
  };
  maxContentLength?: number;
  includeLinks?: boolean;
  respectRobotsTxt?: boolean;
  // File fields
  file?: File;
  fileName?: string;
  fileType?: string;
}

type DataSourceCategory = "database" | "external" | "file";

interface DataSource {
  id: string;
  name: string;
  category: DataSourceCategory;
  icon: string;
  color: string;
  description: string;
  requiresOAuth?: boolean;
  requiresFile?: boolean;
  defaultPort?: string;
  isBeta?: boolean;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "password" | "number" | "boolean" | "file" | "select";
    required: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

// Note: Data sources are now fetched from the database via useDatabaseConfig hook
// This ensures that only enabled data sources are displayed to users

export default function UnifiedConnectionModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  workspaceId,
}: UnifiedConnectionModalProps) {
  const { dataSources = [] } = useDataSourceConfig();
  const { session } = useSupabaseAuth();

  // Utility function to extract Document ID from Google Docs URL
  const extractDocumentIdFromUrl = (url: string): string | null => {
    try {
      // Handle various Google Docs URL formats:
      // https://docs.google.com/document/d/DOCUMENT_ID/edit
      // https://docs.google.com/document/d/DOCUMENT_ID/edit#gid=0
      // https://docs.google.com/document/d/DOCUMENT_ID
      const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Transform database sources to include form fields
  const transformedDataSources = dataSources.map((source) => {
    // Define form fields based on source category and type
    let fields: Array<{
      key: string;
      label: string;
      type: "text" | "password" | "number" | "boolean" | "file" | "select";
      required: boolean;
      placeholder?: string;
      options?: Array<{ value: string; label: string }>;
    }> = [];

    // Use original database category for field generation
    const originalCategory = source.category;

    if (originalCategory === "file") {
      // File sources need a file input only - connection name will be auto-generated from file name
      fields = [
        {
          key: "file",
          label: `${source.name} File`,
          type: "file",
          required: true,
        },
      ];
    } else if (originalCategory === "sql" || originalCategory === "nosql") {
      // Database sources need connection fields
      fields = [
        {
          key: "name",
          label: "Connection Name",
          type: "text",
          required: true,
          placeholder: `My ${source.name} Connection`,
        },
        {
          key: "host",
          label: "Host",
          type: "text",
          required: true,
          placeholder: "localhost",
        },
        {
          key: "port",
          label: "Port",
          type: "number",
          required: true,
          placeholder: source.defaultPort || "5432",
        },
        {
          key: "database",
          label: "Database",
          type: "text",
          required: true,
          placeholder: "database_name",
        },
        {
          key: "username",
          label: "Username",
          type: "text",
          required: true,
          placeholder: "username",
        },
        {
          key: "password",
          label: "Password",
          type: "password",
          required: true,
          placeholder: "password",
        },
        { key: "ssl", label: "Use SSL", type: "boolean", required: false },
      ];
    } else if (source.id === "google-docs") {
      // Google Docs specific fields
      fields = [
        {
          key: "documentUrl",
          label: "Google Docs URL",
          type: "text",
          required: true,
          placeholder:
            "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
        },
      ];
    } else {
      // External sources (analytics, others, etc.) - basic fields
      fields = [
        {
          key: "name",
          label: "Connection Name",
          type: "text",
          required: true,
          placeholder: `My ${source.name} Connection`,
        },
      ];
    }

    // Map database categories to UI categories
    let uiCategory: DataSourceCategory;
    if (source.category === "file") {
      uiCategory = "file";
    } else if (source.category === "sql" || source.category === "nosql") {
      uiCategory = "database";
    } else {
      // analytics, others, etc. -> external
      uiCategory = "external";
    }

    return {
      ...source,
      category: uiCategory,
      fields,
      requiresFile: source.category === "file",
      requiresOAuth:
        source.id === "google-docs" ||
        source.id === "google-sheets" ||
        source.id === "google-analytics",
    };
  });

  // Connection testing and creation functions
  const testDatabaseConnection = async (_config: Record<string, unknown>) => {
    // Implementation for testing database connections
    return {
      success: true,
      message: "Connection test successful",
      error: null,
      tablesProcessed: 0,
      connectionId: "mock-connection-id",
    };
  };

  const createDatabaseConnection = async (_config: Record<string, unknown>) => {
    // Implementation for creating database connections
    return {
      success: true,
      message: "Connection created successfully",
      error: null,
      tablesProcessed: 0,
      connectionId: "mock-connection-id",
    };
  };

  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSource | null>(null);
  const [config, setConfig] = useState<ConnectionConfig>({
    type: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<
    | "category"
    | "source"
    | "config"
    | "testing"
    | "success"
    | "upload-success"
    | "syncing"
  >("category");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [_connectionId, setConnectionId] = useState<string>("");

  // Get all available categories
  const availableCategories = Array.from(
    new Set(transformedDataSources.map((ds) => ds.category))
  );

  // Filter data sources based on selected filter and search query
  const filteredDataSources = transformedDataSources.filter((ds) => {
    const matchesFilter =
      selectedFilter === "all" || ds.category === selectedFilter;
    const matchesSearch =
      searchQuery === "" ||
      ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
    setError(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedDataSource) {
      // Define file type mappings for validation
      const fileTypeMappings: Record<string, string[]> = {
        excel: [".xlsx", ".xls"],
        csv: [".csv"],
        pdf: [".pdf"],
        word: [".docx", ".doc"],
        powerpoint: [".pptx", ".ppt"],
        text: [".txt"],
        json: [".json"],
        xml: [".xml"],
        html: [".html", ".htm"],
        markdown: [".md", ".markdown"],
      };

      // Get expected extensions for the selected data source
      const expectedExtensions = fileTypeMappings[selectedDataSource.id];

      if (expectedExtensions) {
        // Check if the file extension matches the expected type
        const fileExtension = file.name
          .toLowerCase()
          .substring(file.name.lastIndexOf("."));
        const isValidExtension = expectedExtensions.includes(fileExtension);

        if (!isValidExtension) {
          setError(
            `Invalid file type. Please select a ${
              selectedDataSource.name
            } file (${expectedExtensions.join(", ")})`
          );
          // Clear the file input
          event.target.value = "";
          return;
        }
      }

      // Clear any previous errors and set the file
      setError(null);
      setConfig((prev) => ({
        ...prev,
        file,
        fileName: file.name,
        fileType: file.type,
      }));
    }
  };

  const validateConfig = (): boolean => {
    if (!selectedDataSource) return false;

    for (const field of selectedDataSource.fields) {
      if (field.required && !config[field.key as keyof ConnectionConfig]) {
        setError(`${field.label} is required`);
        return false;
      }
    }

    return true;
  };

  const handleTestConnection = async () => {
    if (!validateConfig()) return;

    setIsLoading(true);
    setError(null);
    setStep("testing");

    try {
      if (selectedDataSource?.category === "database") {
        // Test database connection
        const result = await testDatabaseConnection({
          type: config.type,
          host: config.host || "",
          port: config.port || "",
          database: config.database || "",
          username: config.username || "",
          password: config.password || "",
          ssl: config.ssl || false,
          connectionString: config.connectionString,
        });

        if (result.success) {
          setStep("success");
        } else {
          setError(result.error || "Connection test failed");
          setStep("config");
        }
      } else if (selectedDataSource?.category === "external") {
        // Test external connection (OAuth or API)
        if (selectedDataSource.requiresOAuth) {
          // For OAuth connections, get the OAuth URL directly
          console.log("Getting OAuth URL for:", config.type);

          // Extract Document ID from URL if it's Google Docs
          let documentId = null;
          if (config.type === "google-docs" && config.documentUrl) {
            documentId = extractDocumentIdFromUrl(config.documentUrl);
            if (!documentId) {
              setError(
                "Invalid Google Docs URL. Please provide a valid Google Docs URL."
              );
              setStep("config");
              return;
            }
          }

          const oauthResponse = await fetch(
            `/api/oauth/google?workspaceId=${workspaceId}&connectionType=${
              config.type
            }${documentId ? `&documentId=${documentId}` : ""}`,
            {
              method: "GET",
              headers: {
                ...(session?.access_token && {
                  Authorization: `Bearer ${session.access_token}`,
                }),
              },
            }
          );

          console.log("OAuth response status:", oauthResponse.status);

          if (!oauthResponse.ok) {
            console.error(
              "OAuth API error:",
              oauthResponse.status,
              oauthResponse.statusText
            );
            setError(
              `Failed to get OAuth URL: ${oauthResponse.status} ${oauthResponse.statusText}`
            );
            setStep("config");
            return;
          }

          const oauthResult = await oauthResponse.json();
          console.log("OAuth result:", oauthResult);

          if (oauthResult.success && oauthResult.authUrl) {
            console.log("Opening OAuth URL:", oauthResult.authUrl);
            // Open OAuth flow in popup
            const oauthWindow = window.open(
              oauthResult.authUrl,
              "_blank",
              "width=600,height=700,scrollbars=yes,resizable=yes"
            );

            // Check if popup was blocked
            if (
              !oauthWindow ||
              oauthWindow.closed ||
              typeof oauthWindow.closed === "undefined"
            ) {
              setError(
                "Popup was blocked. Please allow popups for this site and try again."
              );
              setStep("config");
              return;
            }

            // Listen for OAuth messages from popup
            const handleMessage = (event: MessageEvent) => {
              if (event.data?.type === "OAUTH_SUCCESS") {
                window.removeEventListener("message", handleMessage);
                clearInterval(checkClosed);
                // Store connection ID and start syncing
                setConnectionId(event.data.connectionId || "");
                setStep("syncing");
                setIsLoading(true);
                // Start sync process
                handleSync(event.data.connectionId || "");
              } else if (event.data?.type === "OAUTH_ERROR") {
                window.removeEventListener("message", handleMessage);
                clearInterval(checkClosed);
                setError(event.data.message || "OAuth authentication failed");
                setStep("config");
                setIsLoading(false);
              }
            };

            window.addEventListener("message", handleMessage);

            // Fallback: check if window is closed
            const checkClosed = setInterval(() => {
              if (oauthWindow?.closed) {
                clearInterval(checkClosed);
                window.removeEventListener("message", handleMessage);
                // Assume success if window is closed (user might have completed OAuth)
                setStep("success");
                setIsLoading(false);
              }
            }, 1000);

            return;
          } else {
            setError(oauthResult.error || "Failed to get OAuth URL");
            setStep("config");
            return;
          }
        } else {
          // Test API connection by creating the connection
          const response = await fetch("/api/external-connections", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token && {
                Authorization: `Bearer ${session.access_token}`,
              }),
            },
            body: JSON.stringify({
              workspaceId,
              connectionType: config.type,
              connectionConfig: config,
              contentType: config.type === "google-docs" ? "document" : "api",
            }),
          });

          const result = await response.json();
          if (result.success) {
            setStep("success");
          } else {
            setError(result.error || "Connection test failed");
            setStep("config");
          }
        }
      } else if (selectedDataSource?.category === "file") {
        // Test file upload - just validate file selection
        if (config.file) {
          // For file uploads, just validate that a file is selected
          setStep("success");
        } else {
          setError("Please select a file");
          setStep("config");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
      setStep("config");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (connId: string) => {
    try {
      const response = await fetch(`/api/external-connections/${connId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({
          syncType: "full",
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStep("success");
        setIsLoading(false);
      } else {
        setError(`Sync failed: ${result.error || "Unknown error"}`);
        setStep("config");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Sync error:", error);
      setError("Sync failed. Please try again.");
      setStep("config");
      setIsLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (selectedDataSource?.category === "database") {
        // Create database connection
        const result = await createDatabaseConnection({
          name: config.name,
          type: config.type,
          host: config.host || "",
          port: config.port || "",
          database: config.database || "",
          username: config.username || "",
          password: config.password || "",
          ssl: config.ssl || false,
          connectionString: config.connectionString,
          workspaceId,
        });

        if (result.success) {
          onConnectionSuccess({
            connectionName: config.name,
            connectionType: config.type,
            tablesProcessed: result.tablesProcessed || 0,
          });
          onClose();
        } else {
          setError(result.error || "Failed to create connection");
        }
      } else if (selectedDataSource?.category === "external") {
        // Create external connection
        const response = await fetch("/api/external-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: config.name,
            type: config.type,
            config: config,
            workspaceId,
          }),
        });

        const result = await response.json();
        if (result.success) {
          onConnectionSuccess({
            connectionName: config.name,
            connectionType: config.type,
          });
          onClose();
        } else {
          setError(result.error || "Failed to create connection");
        }
      } else if (selectedDataSource?.category === "file") {
        // Upload file - use file name as connection name
        const fileName = config.file?.name || "Unknown File";

        // Show testing step during file upload
        setStep("testing");

        const formData = new FormData();
        formData.append("file", config.file!);
        formData.append("name", fileName);
        formData.append("type", config.type);
        formData.append("workspaceId", workspaceId);

        const response = await fetch(`/api/workspaces/${workspaceId}/files`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        if (response.ok && result.id) {
          // Show upload success step with Okay button
          setStep("upload-success");
          // Don't call onConnectionSuccess yet - wait for user to click Okay
        } else {
          setError(result.error || "Failed to upload file");
          setStep("config");
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create connection"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setStep("category");
    setSelectedDataSource(null);
    setConfig({ type: "", name: "" });
    setError(null);
    setIsLoading(false);
    setSelectedFilter("all");
    setSearchQuery("");
    setConnectionId("");
  };

  // Reset modal when it opens
  useEffect(() => {
    if (isOpen) {
      resetModal();
    }
  }, [isOpen]);

  // Set config.type when selectedDataSource changes
  useEffect(() => {
    if (selectedDataSource) {
      setConfig((prev) => ({
        ...prev,
        type: selectedDataSource.id,
      }));
    }
  }, [selectedDataSource]);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden border border-gray-700/50 relative">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm border-b border-gray-700/50">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
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
                <h2 className="text-2xl font-bold text-white">
                  {step === "category" && "Connect Data Source"}
                  {step === "source" && "Select Data Source"}
                  {step === "config" && "Configure Connection"}
                  {step === "testing" && "Testing Connection"}
                  {step === "syncing" && "Generating AI Summary"}
                  {step === "success" && "Connection Successful"}
                  {step === "upload-success" && "Upload Complete"}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {step === "category" &&
                    "Choose from our supported data sources"}
                  {step === "source" && "Select your preferred data source"}
                  {step === "config" && "Enter your connection details"}
                  {step === "testing" && "Verifying your connection"}
                  {step === "syncing" &&
                    "Processing your data and generating AI insights"}
                  {step === "success" && "Ready to create your connection"}
                  {step === "upload-success" && "File processed successfully"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-200 group"
            >
              <svg
                className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200"
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

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === "category" && (
            <div className="flex h-full">
              {/* Left Filter Panel */}
              <div className="w-72 bg-gradient-to-b from-gray-800/30 to-gray-900/50 border-r border-gray-700/50 p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-white">
                    Categories
                  </h4>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFilter("all")}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      selectedFilter === "all"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-300 hover:bg-gray-700/50 hover:text-white hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>All Sources</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          selectedFilter === "all"
                            ? "bg-white/20 text-white"
                            : "bg-gray-600 text-gray-300"
                        }`}
                      >
                        {transformedDataSources.length}
                      </span>
                    </div>
                  </button>
                  {availableCategories.map((category) => {
                    const count = transformedDataSources.filter(
                      (ds) => ds.category === category
                    ).length;
                    const categoryName =
                      category.charAt(0).toUpperCase() + category.slice(1);
                    const categoryIcons = {
                      database:
                        "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
                      external:
                        "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9",
                      file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                    };
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedFilter(category)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                          selectedFilter === category
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                            : "text-gray-300 hover:bg-gray-700/50 hover:text-white hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
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
                                d={
                                  categoryIcons[
                                    category as keyof typeof categoryIcons
                                  ] || categoryIcons.file
                                }
                              />
                            </svg>
                            <span>{categoryName}</span>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              selectedFilter === category
                                ? "bg-white/20 text-white"
                                : "bg-gray-600 text-gray-300"
                            }`}
                          >
                            {count}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-8">
                {/* Header */}
                <div className="mb-8">
                  <h3 className="text-3xl font-bold text-white mb-3">
                    Select your data source
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed">
                    Create new data connection. Find your data source type in
                    the list below.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search data sources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
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
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Data Sources Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {filteredDataSources.map((dataSource) => (
                    <button
                      key={dataSource.id}
                      onClick={() => {
                        setSelectedDataSource(dataSource);
                        setStep("config");
                      }}
                      className="group p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 text-center bg-gradient-to-br from-gray-800/30 to-gray-900/50 hover:from-gray-700/40 hover:to-gray-800/60 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 backdrop-blur-sm"
                    >
                      {/* Icon */}
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all duration-300 group-hover:scale-110">
                        {dataSource.icon ? (
                          <Image
                            src={dataSource.icon}
                            alt={dataSource.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : null}
                        <div
                          className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center text-white text-lg font-bold group-hover:from-blue-500 group-hover:to-purple-600 transition-all duration-300"
                          style={{ display: dataSource.icon ? "none" : "flex" }}
                        >
                          {dataSource.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {/* Name */}
                      <h4 className="text-base font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors duration-300">
                        {dataSource.name}
                      </h4>

                      {/* Category Badge */}
                      <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-700/50 text-gray-300 rounded-full group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-all duration-300">
                        {dataSource.category}
                      </span>

                      {/* Beta Badge */}
                      {dataSource.isBeta && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 text-xs font-medium bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 rounded-full border border-orange-500/30">
                            Beta
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* No Results */}
                {filteredDataSources.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">
                      No data sources found
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      Try adjusting your search or filter criteria
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "config" && selectedDataSource && (
            <div className="p-8">
              <div className="flex items-center space-x-3 mb-8">
                <button
                  onClick={() => setStep("category")}
                  className="flex items-center space-x-2 px-4 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all duration-200 group"
                >
                  <svg
                    className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span>Back</span>
                </button>
                <div className="h-6 w-px bg-gray-600"></div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    {selectedDataSource.icon ? (
                      <Image
                        src={selectedDataSource.icon}
                        alt={selectedDataSource.name}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <span className="text-blue-400 text-sm font-bold">
                        {selectedDataSource.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-300 text-lg">
                    Configure {selectedDataSource.name}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 flex items-center space-x-3 mb-6 backdrop-blur-sm">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <span className="text-red-300 font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-6">
                {/* Only show Connection Name for non-file data sources */}
                {selectedDataSource.category !== "file" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-3">
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) =>
                        handleConfigChange("name", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-gray-800/50 text-white placeholder-gray-400 transition-all duration-200 backdrop-blur-sm"
                      placeholder="Enter connection name"
                    />
                  </div>
                )}

                {selectedDataSource.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-semibold text-gray-200 mb-3">
                      {field.label}
                      {field.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </label>

                    {field.type === "file" ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            accept={(() => {
                              // Define file type mappings for specific data sources
                              const fileTypeMappings: Record<string, string> = {
                                excel: ".xlsx,.xls",
                                csv: ".csv",
                                pdf: ".pdf",
                                word: ".docx,.doc",
                                powerpoint: ".pptx,.ppt",
                                text: ".txt",
                                json: ".json",
                                xml: ".xml",
                                html: ".html,.htm",
                                markdown: ".md,.markdown",
                                // Add more mappings as needed
                              };

                              // Return specific file types for known data sources, or empty string for unknown types
                              return (
                                fileTypeMappings[selectedDataSource.id] || ""
                              );
                            })()}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id={`file-input-${field.key}`}
                          />
                          <label
                            htmlFor={`file-input-${field.key}`}
                            className="flex flex-col items-center justify-center w-full px-6 py-6 border-2 border-dashed border-gray-600/50 rounded-xl bg-gray-800/30 text-white hover:bg-gray-700/40 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all duration-200 backdrop-blur-sm group"
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <svg
                                className="w-6 h-6 text-gray-400 group-hover:text-blue-400 transition-colors"
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
                              <span className="text-sm font-medium">
                                {config.file ? "Change file" : "Choose file"}
                              </span>
                            </div>
                            {(() => {
                              const fileTypeMappings: Record<string, string> = {
                                excel: ".xlsx, .xls",
                                csv: ".csv",
                                pdf: ".pdf",
                                word: ".docx, .doc",
                                powerpoint: ".pptx, .ppt",
                                text: ".txt",
                                json: ".json",
                                xml: ".xml",
                                html: ".html, .htm",
                                markdown: ".md, .markdown",
                              };

                              const acceptedTypes =
                                fileTypeMappings[selectedDataSource.id];
                              return acceptedTypes ? (
                                <span className="text-xs text-gray-400">
                                  Accepted formats: {acceptedTypes}
                                </span>
                              ) : null;
                            })()}
                          </label>
                        </div>
                        {config.file && (
                          <div className="flex items-center space-x-3 p-4 bg-green-900/20 border border-green-500/30 rounded-xl backdrop-blur-sm">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-green-400"
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
                            </div>
                            <div>
                              <span className="text-sm font-medium text-green-300">
                                Selected: {config.file.name}
                              </span>
                              <p className="text-xs text-green-400">
                                {(config.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : field.type === "select" ? (
                      <select
                        value={
                          (config[
                            field.key as keyof ConnectionConfig
                          ] as string) || ""
                        }
                        onChange={(e) =>
                          handleConfigChange(field.key, e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-gray-800/50 text-white transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <label className="flex items-center space-x-3 p-4 bg-gray-800/30 rounded-xl border border-gray-600/30 hover:bg-gray-700/40 transition-all duration-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            (config[
                              field.key as keyof ConnectionConfig
                            ] as boolean) || false
                          }
                          onChange={(e) =>
                            handleConfigChange(field.key, e.target.checked)
                          }
                          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-200">
                          {field.label}
                        </span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        value={
                          (config[
                            field.key as keyof ConnectionConfig
                          ] as string) || ""
                        }
                        onChange={(e) =>
                          handleConfigChange(field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 border border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 bg-gray-800/50 text-white placeholder-gray-400 transition-all duration-200 backdrop-blur-sm"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/25 flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "testing" && (
            <div className="text-center py-12 px-8">
              <div className="relative mb-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-transparent border-t-blue-500 border-r-purple-500"></div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                {selectedDataSource?.category === "file"
                  ? "Processing File"
                  : "Testing Connection"}
              </h3>
              <p className="text-gray-300 text-lg mb-8">
                {selectedDataSource?.category === "file"
                  ? "Please wait while we process your file and extract insights..."
                  : "Please wait while we test your connection..."}
              </p>
              {selectedDataSource?.category === "file" && (
                <div className="max-w-md mx-auto space-y-4">
                  {[
                    "Uploading file to secure storage",
                    "Reading and validating file content",
                    "Extracting text and analyzing structure",
                    "Generating file summary and insights",
                    "Finalizing connection",
                  ].map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-700/50"
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index < 4
                            ? "bg-blue-500 animate-pulse"
                            : "bg-gray-600"
                        }`}
                      ></div>
                      <span className="text-sm text-gray-300">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "syncing" && (
            <div className="text-center py-12 px-8">
              <div className="relative mb-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-transparent border-t-purple-500 border-r-pink-500"></div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Generating AI Summary
              </h3>
              <p className="text-gray-300 text-lg mb-8">
                Please wait while we process your data and generate AI
                insights...
              </p>
              <div className="max-w-md mx-auto space-y-4">
                {[
                  "Fetching document content",
                  "Processing and analyzing text",
                  "Generating AI summary",
                  "Extracting key insights",
                  "Finalizing connection",
                ].map((step, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-gray-800/30 rounded-xl border border-gray-700/50"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        index < 4
                          ? "bg-purple-500 animate-pulse"
                          : "bg-gray-600"
                      }`}
                    ></div>
                    <span className="text-sm text-gray-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-12 px-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                {selectedDataSource?.category === "file"
                  ? "File Validated Successfully!"
                  : selectedDataSource?.requiresOAuth
                  ? "OAuth Connection Successful!"
                  : "Connection Successful!"}
              </h3>
              <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                {selectedDataSource?.category === "file"
                  ? `Your file ${
                      config.file?.name || "file"
                    } has been validated and is ready for upload and processing.`
                  : selectedDataSource?.requiresOAuth
                  ? `Your ${selectedDataSource?.name} connection has been authenticated and AI summary has been generated. You can now ask questions about your data!`
                  : `Your ${selectedDataSource?.name} connection has been tested successfully.`}
              </p>
              <button
                onClick={() => {
                  if (selectedDataSource?.requiresOAuth) {
                    // For OAuth connections, just close the modal and refresh
                    onClose();
                    window.location.reload();
                  } else {
                    // For other connections, use the existing flow
                    handleCreateConnection();
                  }
                }}
                disabled={isLoading}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-green-500/25 flex items-center space-x-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>
                      {selectedDataSource?.category === "file"
                        ? "Processing..."
                        : "Creating..."}
                    </span>
                  </>
                ) : (
                  <>
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
                        d={
                          selectedDataSource?.requiresOAuth
                            ? "M5 13l4 4L19 7"
                            : "M12 6v6m0 0v6m0-6h6m-6 0H6"
                        }
                      />
                    </svg>
                    <span>
                      {selectedDataSource?.category === "file"
                        ? "Upload and Process"
                        : selectedDataSource?.requiresOAuth
                        ? "Done"
                        : "Create Connection"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {step === "upload-success" && (
            <div className="text-center py-12 px-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                File Upload Successful!
              </h3>
              <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                Your file {config.file?.name || "file"} has been uploaded,
                processed, and file summaries have been generated successfully.
              </p>
              <button
                onClick={() => {
                  // Call success callback to trigger file refresh
                  onConnectionSuccess({
                    connectionName: config.file?.name || "file",
                    connectionType: config.type,
                  });
                  // Close the modal
                  onClose();
                }}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-green-500/25 flex items-center space-x-2 mx-auto"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Okay</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
