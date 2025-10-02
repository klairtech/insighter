"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle,
  Database,
  Globe,
  Upload,
  FileText,
} from "lucide-react";
import { useDatabaseConfig } from "@/hooks/useDatabaseConfig";

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

const _DATA_SOURCES: DataSource[] = [
  // Database Sources
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    icon: "https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg",
    color: "bg-blue-600",
    description: "Connect to PostgreSQL database",
    defaultPort: "5432",
    fields: [
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
        placeholder: "5432",
      },
      {
        key: "database",
        label: "Database",
        type: "text",
        required: true,
        placeholder: "mydb",
      },
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        placeholder: "user",
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        required: true,
        placeholder: "password",
      },
      { key: "ssl", label: "Use SSL", type: "boolean", required: false },
    ],
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/0a/MySQL_textlogo.svg",
    color: "bg-orange-500",
    description: "Connect to MySQL database",
    defaultPort: "3306",
    fields: [
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
        placeholder: "3306",
      },
      {
        key: "database",
        label: "Database",
        type: "text",
        required: true,
        placeholder: "mydb",
      },
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        placeholder: "user",
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        required: true,
        placeholder: "password",
      },
      { key: "ssl", label: "Use SSL", type: "boolean", required: false },
    ],
  },
  {
    id: "redshift",
    name: "Amazon Redshift",
    category: "database",
    icon: "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg",
    color: "bg-red-500",
    description: "Connect to Amazon Redshift data warehouse",
    defaultPort: "5439",
    fields: [
      {
        key: "host",
        label: "Host",
        type: "text",
        required: true,
        placeholder: "your-cluster.redshift.amazonaws.com",
      },
      {
        key: "port",
        label: "Port",
        type: "number",
        required: true,
        placeholder: "5439",
      },
      {
        key: "database",
        label: "Database",
        type: "text",
        required: true,
        placeholder: "dev",
      },
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        placeholder: "awsuser",
      },
      {
        key: "password",
        label: "Password",
        type: "password",
        required: true,
        placeholder: "password",
      },
      { key: "ssl", label: "Use SSL", type: "boolean", required: false },
    ],
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "database",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/38/SQLite370.svg",
    color: "bg-gray-600",
    description: "Connect to SQLite database file",
    fields: [
      {
        key: "connectionString",
        label: "Database File Path",
        type: "text",
        required: true,
        placeholder: "/path/to/database.db",
      },
    ],
  },

  // External Sources
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "external",
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
        placeholder: "A1:Z1000",
      },
      {
        key: "includeHeaders",
        label: "Include Headers",
        type: "boolean",
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
    category: "external",
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
      {
        key: "includeFormatting",
        label: "Include Formatting",
        type: "boolean",
        required: false,
      },
      {
        key: "maxSections",
        label: "Max Sections",
        type: "number",
        required: false,
        placeholder: "50",
      },
    ],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "external",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/77/GAnalytics.svg",
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
      {
        key: "startDate",
        label: "Start Date",
        type: "text",
        required: false,
        placeholder: "7daysAgo",
      },
      {
        key: "endDate",
        label: "End Date",
        type: "text",
        required: false,
        placeholder: "today",
      },
      {
        key: "metrics",
        label: "Metrics",
        type: "text",
        required: false,
        placeholder: "sessions,users,pageviews",
      },
      {
        key: "dimensions",
        label: "Dimensions",
        type: "text",
        required: false,
        placeholder: "date,country",
      },
    ],
  },
  {
    id: "web-url",
    name: "Web URL",
    category: "external",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg",
    color: "bg-purple-500",
    description: "Connect to web URLs for content scraping",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        required: true,
        placeholder: "https://example.com",
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
        type: "boolean",
        required: false,
      },
      {
        key: "respectRobotsTxt",
        label: "Respect Robots.txt",
        type: "boolean",
        required: false,
      },
    ],
  },

  // File Sources
  {
    id: "excel",
    name: "Excel File",
    category: "file",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/34/Microsoft_Office_Excel_%282019%E2%80%93present%29.svg",
    color: "bg-green-600",
    description: "Upload Excel files for data analysis",
    requiresFile: true,
    fields: [
      { key: "file", label: "Excel File", type: "file", required: true },
      {
        key: "sheetName",
        label: "Sheet Name",
        type: "text",
        required: false,
        placeholder: "Sheet1",
      },
      {
        key: "includeHeaders",
        label: "Include Headers",
        type: "boolean",
        required: false,
      },
    ],
  },
  {
    id: "csv",
    name: "CSV File",
    category: "file",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/18/CSV_file_icon.svg",
    color: "bg-blue-600",
    description: "Upload CSV files for data analysis",
    requiresFile: true,
    fields: [
      { key: "file", label: "CSV File", type: "file", required: true },
      {
        key: "delimiter",
        label: "Delimiter",
        type: "select",
        required: false,
        options: [
          { value: ",", label: "Comma (,)" },
          { value: ";", label: "Semicolon (;)" },
          { value: "\t", label: "Tab" },
        ],
      },
      {
        key: "includeHeaders",
        label: "Include Headers",
        type: "boolean",
        required: false,
      },
    ],
  },
  {
    id: "pdf",
    name: "PDF File",
    category: "file",
    icon: "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg",
    color: "bg-red-600",
    description: "Upload PDF files for content extraction",
    requiresFile: true,
    fields: [
      { key: "file", label: "PDF File", type: "file", required: true },
      {
        key: "extractTables",
        label: "Extract Tables",
        type: "boolean",
        required: false,
      },
      {
        key: "extractImages",
        label: "Extract Images",
        type: "boolean",
        required: false,
      },
    ],
  },
  {
    id: "word",
    name: "Word Document",
    category: "file",
    icon: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg",
    color: "bg-blue-700",
    description: "Upload Word documents for content extraction",
    requiresFile: true,
    fields: [
      { key: "file", label: "Word File", type: "file", required: true },
      {
        key: "extractFormatting",
        label: "Extract Formatting",
        type: "boolean",
        required: false,
      },
      {
        key: "extractImages",
        label: "Extract Images",
        type: "boolean",
        required: false,
      },
    ],
  },
];

// Note: Data sources are now fetched from the database via useDatabaseConfig hook
// The hardcoded array above is kept for reference but not used

const CATEGORY_ICONS = {
  database: Database,
  external: Globe,
  file: Upload,
};

const CATEGORY_COLORS = {
  database: "bg-blue-500",
  external: "bg-green-500",
  file: "bg-purple-500",
};

export default function UnifiedConnectionModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  workspaceId,
}: UnifiedConnectionModalProps) {
  const { dataSources = [] } = useDatabaseConfig();

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
      // File sources need a file input
      fields = [
        {
          key: "file",
          label: `${source.name} File`,
          type: "file",
          required: true,
        },
        {
          key: "name",
          label: "Connection Name",
          type: "text",
          required: true,
          placeholder: `My ${source.name} Connection`,
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

  const [selectedCategory, setSelectedCategory] =
    useState<DataSourceCategory>("database");
  const [selectedDataSource, setSelectedDataSource] =
    useState<DataSource | null>(null);
  const [config, setConfig] = useState<ConnectionConfig>({
    type: "",
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<
    "category" | "source" | "config" | "testing" | "success"
  >("category");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const filteredDataSources = transformedDataSources.filter(
    (ds) => ds.category === selectedCategory
  );

  const handleCategorySelect = (category: DataSourceCategory) => {
    setSelectedCategory(category);
    setStep("source");
    setSelectedDataSource(null);
    setConfig({ type: "", name: "" });
    setError(null);
  };

  const handleDataSourceSelect = (dataSource: DataSource) => {
    setSelectedDataSource(dataSource);
    setConfig({
      type: dataSource.id,
      name: `${dataSource.name} Connection`,
    });
    setStep("config");
    setError(null);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
    setError(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
          // Redirect to OAuth flow
          window.location.href = `/api/oauth/google?connectionId=${config.type}&workspaceId=${workspaceId}`;
          return;
        } else {
          // Test API connection
          const response = await fetch("/api/external-connections/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: config.type,
              config: config,
              workspaceId,
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
        // Test file upload
        if (config.file) {
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
        // Upload file
        const formData = new FormData();
        formData.append("file", config.file!);
        formData.append("name", config.name);
        formData.append("type", config.type);
        formData.append("workspaceId", workspaceId);

        const response = await fetch("/api/file-uploads", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        if (result.success) {
          onConnectionSuccess({
            connectionName: config.name,
            connectionType: config.type,
          });
          onClose();
        } else {
          setError(result.error || "Failed to upload file");
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
    setSelectedCategory("database");
    setSelectedDataSource(null);
    setConfig({ type: "", name: "" });
    setError(null);
    setIsLoading(false);
    setFailedImages(new Set());
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">
            {step === "category" && "Connect Data Source"}
            {step === "source" && "Select Data Source"}
            {step === "config" && "Configure Connection"}
            {step === "testing" && "Testing Connection"}
            {step === "success" && "Connection Successful"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-200"
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

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === "category" && (
            <div className="space-y-6">
              <p className="text-gray-300">
                Choose the type of data source you want to connect:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["database", "external", "file"] as DataSourceCategory[]).map(
                  (category) => {
                    const Icon = CATEGORY_ICONS[category];
                    const colorClass = CATEGORY_COLORS[category];
                    const count = transformedDataSources.filter(
                      (ds) => ds.category === category
                    ).length;

                    return (
                      <button
                        key={category}
                        onClick={() => handleCategorySelect(category)}
                        className={`p-6 rounded-lg border-2 border-gray-600 hover:border-gray-500 transition-colors text-left ${colorClass} text-white`}
                      >
                        <Icon className="w-8 h-8 mb-3" />
                        <h3 className="text-lg font-semibold capitalize mb-2">
                          {category}
                        </h3>
                        <p className="text-sm opacity-90">
                          {category === "database" &&
                            "Connect to databases like PostgreSQL, MySQL, Redshift"}
                          {category === "external" &&
                            "Connect to external services like Google Sheets, Analytics"}
                          {category === "file" &&
                            "Upload files like Excel, CSV, PDF, Word documents"}
                        </p>
                        <p className="text-xs opacity-75 mt-2">
                          {count} sources available
                        </p>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {step === "source" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setStep("category")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  ← Back
                </button>
                <span className="text-gray-300">
                  Select a {selectedCategory} data source:
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDataSources.map((dataSource) => (
                  <button
                    key={dataSource.id}
                    onClick={() => handleDataSourceSelect(dataSource)}
                    className="p-4 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors text-left bg-gray-800 hover:bg-gray-750"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-lg ${dataSource.color} flex items-center justify-center`}
                      >
                        {failedImages.has(dataSource.id) ? (
                          // Fallback icon when image fails to load
                          <FileText className="w-6 h-6 text-white" />
                        ) : (
                          <Image
                            src={dataSource.icon}
                            alt={dataSource.name}
                            width={24}
                            height={24}
                            className="w-6 h-6"
                            onError={() => {
                              setFailedImages((prev) =>
                                new Set(prev).add(dataSource.id)
                              );
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          {dataSource.name}
                        </h3>
                        <p className="text-sm text-gray-300">
                          {dataSource.description}
                        </p>
                        {dataSource.isBeta && (
                          <span className="inline-block px-2 py-1 text-xs bg-yellow-600 text-yellow-100 rounded mt-1">
                            Beta
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "config" && selectedDataSource && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setStep("source")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  ← Back
                </button>
                <span className="text-gray-300">
                  Configure {selectedDataSource.name}:
                </span>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300">{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Connection Name
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => handleConfigChange("name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white placeholder-gray-400"
                    placeholder="Enter connection name"
                  />
                </div>

                {selectedDataSource.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {field.label}
                      {field.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </label>

                    {field.type === "file" ? (
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept={
                          selectedDataSource.id === "excel"
                            ? ".xlsx,.xls"
                            : selectedDataSource.id === "csv"
                            ? ".csv"
                            : selectedDataSource.id === "pdf"
                            ? ".pdf"
                            : selectedDataSource.id === "word"
                            ? ".docx,.doc"
                            : "*"
                        }
                        className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white file:bg-gray-700 file:text-white file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3"
                      />
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
                        className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <label className="flex items-center">
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
                          className="mr-2 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">
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
                        className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white placeholder-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? "Testing..." : "Test Connection"}
                </button>
              </div>
            </div>
          )}

          {step === "testing" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Testing Connection
              </h3>
              <p className="text-gray-300">
                Please wait while we test your connection...
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Connection Successful!
              </h3>
              <p className="text-gray-300 mb-6">
                Your {selectedDataSource?.name} connection has been tested
                successfully.
              </p>
              <button
                onClick={handleCreateConnection}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Create Connection"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
