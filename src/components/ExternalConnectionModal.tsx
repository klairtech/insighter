"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AlertCircle, ExternalLink, CheckCircle } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface ExternalConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: () => void;
  workspaceId: string;
}

interface ExternalConnectionConfig {
  type: string;
  name: string;
  sheetId?: string;
  documentId?: string;
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
}

const EXTERNAL_DATA_SOURCES = [
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "google",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Google_Sheets_2020_Logo.svg",
    color: "bg-green-500",
    description: "Connect to Google Sheets for spreadsheet data",
    requiresOAuth: true,
    fields: [
      {
        key: "sheetId",
        label: "Sheet ID",
        type: "text",
        required: true,
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      },
      {
        key: "sheetName",
        label: "Sheet Name",
        type: "text",
        required: false,
        placeholder: "Sheet1",
      },
      {
        key: "range",
        label: "Range",
        type: "text",
        required: false,
        placeholder: "A:Z",
      },
      {
        key: "includeHeaders",
        label: "Include Headers",
        type: "checkbox",
        required: false,
      },
      {
        key: "maxRows",
        label: "Max Rows",
        type: "number",
        required: false,
        placeholder: "1000",
      },
    ],
  },
  {
    id: "google-docs",
    name: "Google Docs",
    category: "google",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg",
    color: "bg-blue-500",
    description: "Connect to Google Docs for document content",
    requiresOAuth: true,
    fields: [
      {
        key: "documentId",
        label: "Document ID",
        type: "text",
        required: true,
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      },
    ],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "google",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/51/Google_Cloud_logo.svg",
    color: "bg-orange-500",
    description: "Connect to Google Analytics for website data",
    requiresOAuth: true,
    fields: [
      {
        key: "propertyId",
        label: "Property ID",
        type: "text",
        required: true,
        placeholder: "123456789",
      },
      { key: "startDate", label: "Start Date", type: "date", required: false },
      { key: "endDate", label: "End Date", type: "date", required: false },
      {
        key: "includeRealtime",
        label: "Include Realtime Data",
        type: "checkbox",
        required: false,
      },
      {
        key: "maxResults",
        label: "Max Results",
        type: "number",
        required: false,
        placeholder: "1000",
      },
    ],
  },
  {
    id: "web-url",
    name: "Public Web URL",
    category: "web",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg",
    color: "bg-purple-500",
    description: "Scrape content from public websites",
    requiresOAuth: false,
    fields: [
      {
        key: "url",
        label: "URL",
        type: "url",
        required: true,
        placeholder: "https://example.com/blog",
      },
      {
        key: "selectors",
        label: "CSS Selectors",
        type: "object",
        required: false,
        placeholder: '{"title": "h1", "content": ".post-content"}',
      },
      {
        key: "maxContentLength",
        label: "Max Content Length",
        type: "number",
        required: false,
        placeholder: "50000",
      },
      {
        key: "includeLinks",
        label: "Include Links",
        type: "checkbox",
        required: false,
      },
      {
        key: "respectRobotsTxt",
        label: "Respect robots.txt",
        type: "checkbox",
        required: false,
      },
    ],
  },
];

export default function ExternalConnectionModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  workspaceId,
}: ExternalConnectionModalProps) {
  const authContext = useSupabaseAuth();
  const { session } = authContext || { session: null };
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [connectionConfig, setConnectionConfig] =
    useState<ExternalConnectionConfig>({
      type: "",
      name: "",
    });
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<
    "select" | "configure" | "oauth" | "sync" | "complete"
  >("select");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">(
    "info"
  );
  const [oauthUrl, setOauthUrl] = useState<string>("");

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setStatusMessage("");
      setStatusType("info");
      setSelectedSource("");
      setStep("select");
      setConnectionConfig({ type: "", name: "" });
      setOauthUrl("");
    }
  }, [isOpen]);

  const updateStatus = (
    message: string,
    type: "info" | "success" | "error"
  ) => {
    setStatusMessage(message);
    setStatusType(type);
  };

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    const source = EXTERNAL_DATA_SOURCES.find((s) => s.id === sourceId);
    if (source) {
      setConnectionConfig((prev) => ({
        ...prev,
        type: sourceId,
        name: source.name,
      }));
      setStep("configure");
    }
  };

  const handleConfigChange = (
    field: string,
    value: string | boolean | number
  ) => {
    setConnectionConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateConnection = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
    }

    // Validate required fields
    const source = EXTERNAL_DATA_SOURCES.find((s) => s.id === selectedSource);
    if (!source) return;

    const requiredFields = source.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((field) => {
      const value =
        connectionConfig[field.key as keyof ExternalConnectionConfig];
      return !value || value.toString().trim() === "";
    });

    if (missingFields.length > 0) {
      updateStatus(
        `Please fill in the following required fields: ${missingFields
          .map((f) => f.label)
          .join(", ")}`,
        "error"
      );
      return;
    }

    setIsConnecting(true);
    updateStatus("Creating connection...", "info");

    try {
      const response = await fetch("/api/external-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          connectionType: selectedSource,
          connectionConfig: {
            ...connectionConfig,
          },
          contentType:
            selectedSource === "google-sheets"
              ? "spreadsheet"
              : selectedSource === "google-docs"
              ? "document"
              : selectedSource === "google-analytics"
              ? "analytics"
              : "web-page",
          oauthProvider: source.requiresOAuth ? "google" : undefined,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        updateStatus("Connection created successfully!", "success");

        if (source.requiresOAuth) {
          setStep("oauth");
          await handleOAuthFlow(result.connectionId);
        } else {
          setStep("sync");
          await handleSync(result.connectionId);
        }
      } else {
        updateStatus(`Failed to create connection: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Connection creation error:", error);
      updateStatus("Failed to create connection. Please try again.", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOAuthFlow = async (connId: string) => {
    updateStatus("Redirecting to Google for authorization...", "info");

    try {
      const scopes =
        selectedSource === "google-sheets"
          ? "sheets"
          : selectedSource === "google-docs"
          ? "docs"
          : selectedSource === "google-analytics"
          ? "analytics"
          : "sheets";

      const response = await fetch(
        `/api/oauth/google?connectionId=${connId}&scopes=${scopes}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok && result.authUrl) {
        setOauthUrl(result.authUrl);
        // Open OAuth URL in new window
        const oauthWindow = window.open(
          result.authUrl,
          "oauth",
          "width=600,height=600"
        );

        // Listen for OAuth completion
        const checkOAuth = setInterval(async () => {
          if (oauthWindow?.closed) {
            clearInterval(checkOAuth);
            // Check if OAuth was successful by trying to sync
            setStep("sync");
            await handleSync(connId);
          }
        }, 1000);
      } else {
        updateStatus(`OAuth setup failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("OAuth flow error:", error);
      updateStatus("OAuth setup failed. Please try again.", "error");
    }
  };

  const handleSync = async (connId: string) => {
    updateStatus("Synchronizing data...", "info");

    try {
      const response = await fetch(`/api/external-connections/${connId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          syncType: "full",
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        updateStatus(
          `Successfully synchronized ${result.recordsProcessed || 0} records!`,
          "success"
        );
        setStep("complete");
        setTimeout(() => {
          onConnectionSuccess();
          onClose();
        }, 2000);
      } else {
        updateStatus(`Sync failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Sync error:", error);
      updateStatus("Sync failed. Please try again.", "error");
    }
  };

  const renderSourceSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Select Data Source
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXTERNAL_DATA_SOURCES.map((source) => (
          <div
            key={source.id}
            onClick={() => handleSourceSelect(source.id)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedSource === source.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-lg ${source.color} flex items-center justify-center`}
              >
                <Image
                  src={source.icon}
                  alt={source.name}
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{source.name}</h4>
                <p className="text-sm text-gray-500">{source.description}</p>
                {source.requiresOAuth && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    OAuth Required
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfiguration = () => {
    const source = EXTERNAL_DATA_SOURCES.find((s) => s.id === selectedSource);
    if (!source) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-8 h-8 rounded-lg ${source.color} flex items-center justify-center`}
          >
            <Image
              src={source.icon}
              alt={source.name}
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {source.name} Configuration
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Name
            </label>
            <input
              type="text"
              value={connectionConfig.name}
              onChange={(e) => handleConfigChange("name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Google Sheet"
            />
          </div>

          {source.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === "checkbox" ? (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      (connectionConfig[
                        field.key as keyof ExternalConnectionConfig
                      ] as boolean) || false
                    }
                    onChange={(e) =>
                      handleConfigChange(field.key, e.target.checked)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={
                    (connectionConfig[
                      field.key as keyof ExternalConnectionConfig
                    ] as string) || ""
                  }
                  onChange={(e) =>
                    handleConfigChange(field.key, e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOAuth = () => (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <ExternalLink className="w-8 h-8 text-green-600" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        Google Authorization Required
      </h3>
      <p className="text-gray-600">
        You need to authorize access to your Google account to connect this data
        source.
      </p>
      {oauthUrl && (
        <div className="space-y-3">
          <a
            href={oauthUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Authorize with Google
          </a>
          <p className="text-sm text-gray-500">
            A new window will open for Google authorization. After authorizing,
            return here to continue.
          </p>
        </div>
      )}
    </div>
  );

  const renderSync = () => (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        Synchronizing Data
      </h3>
      <p className="text-gray-600">
        Please wait while we fetch and process your data...
      </p>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        Connection Successful!
      </h3>
      <p className="text-gray-600">
        Your external data source has been connected and synchronized
        successfully.
      </p>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Connect External Data Source
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

          {statusMessage && (
            <div
              className={`mb-4 p-3 rounded-md flex items-center ${
                statusType === "error"
                  ? "bg-red-50 text-red-700"
                  : statusType === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              {statusMessage}
            </div>
          )}

          {step === "select" && renderSourceSelection()}
          {step === "configure" && renderConfiguration()}
          {step === "oauth" && renderOAuth()}
          {step === "sync" && renderSync()}
          {step === "complete" && renderComplete()}

          <div className="flex justify-end space-x-3 mt-6">
            {step === "select" && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}

            {step === "configure" && (
              <>
                <button
                  onClick={() => setStep("select")}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateConnection}
                  disabled={isConnecting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting ? "Creating..." : "Create Connection"}
                </button>
              </>
            )}

            {step === "oauth" && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
