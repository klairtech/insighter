"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  DatabaseSchema,
  DatabaseTable,
  SelectedTable,
} from "@/types/database-schema";
import DatabaseSetupProgressModal from "./DatabaseSetupProgressModal";
import { useDatabaseConfig } from "@/hooks/useDatabaseConfig";

// Union type for data sources (hardcoded or from database)
type DataSource = {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  defaultPort: string;
  description: string;
  isBeta?: boolean;
  releaseNotes?: string;
};

interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: (data: {
    connectionName: string;
    tablesProcessed: number;
  }) => void;
  workspaceId: string;
}

interface DatabaseConfig {
  type: string;
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionString?: string;
}

// Data source categories and types
const DATA_SOURCE_CATEGORIES = [
  {
    id: "all",
    name: "All",
    icon: (
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
    ),
  },
  {
    id: "sql",
    name: "SQL",
    icon: (
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: "nosql",
    name: "NoSQL",
    icon: (
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
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    ),
  },
  {
    id: "others",
    name: "Others",
    icon: (
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
    ),
  },
];

const DATA_SOURCE_TYPES = [
  // SQL Databases
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg",
    color: "bg-blue-600",
    defaultPort: "5432",
    description: "Advanced open source relational database",
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/0a/MySQL_textlogo.svg",
    color: "bg-orange-500",
    defaultPort: "3306",
    description: "Popular open source relational database",
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/38/SQLite370.svg",
    color: "bg-purple-600",
    defaultPort: "",
    description: "Lightweight embedded database",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/51/Google_Cloud_logo.svg",
    color: "bg-blue-500",
    defaultPort: "",
    description: "Google's cloud data warehouse",
  },
  {
    id: "redshift",
    name: "Amazon Redshift",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Amazon-S3-Logo.svg",
    color: "bg-orange-600",
    defaultPort: "5439",
    description: "AWS cloud data warehouse",
  },
  {
    id: "azure-sql",
    name: "Azure SQL Database",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Microsoft_Azure.svg",
    color: "bg-blue-600",
    defaultPort: "1433",
    description: "Microsoft Azure managed SQL database",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Snowflake_Logo.svg",
    color: "bg-blue-500",
    defaultPort: "443",
    description: "Cloud data platform for data warehousing",
  },
  {
    id: "oracle",
    name: "Oracle Database",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg",
    color: "bg-red-600",
    defaultPort: "1521",
    description: "Enterprise relational database system",
  },
  {
    id: "mssql",
    name: "SQL Server",
    category: "sql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/8/87/Sql_server_logo.png",
    color: "bg-blue-700",
    defaultPort: "1433",
    description: "Microsoft SQL Server database",
  },

  // NoSQL Databases
  {
    id: "mongodb",
    name: "MongoDB",
    category: "nosql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/9/93/MongoDB_Logo.svg",
    color: "bg-green-600",
    defaultPort: "27017",
    description: "NoSQL document database",
  },
  {
    id: "redis",
    name: "Redis",
    category: "nosql",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Redis_Logo.svg",
    color: "bg-red-600",
    defaultPort: "6379",
    description: "In-memory data structure store",
  },

  // Other Connectors
  {
    id: "notion",
    name: "Notion",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png",
    color: "bg-gray-800",
    defaultPort: "",
    description: "Connect to Notion workspaces and pages",
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Airtable_Logo.svg",
    color: "bg-purple-600",
    defaultPort: "",
    description: "Connect to Airtable bases and tables",
  },
  {
    id: "slack",
    name: "Slack",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Slack_Technologies_Logo.svg",
    color: "bg-purple-500",
    defaultPort: "",
    description: "Connect to Slack workspaces and channels",
  },
  {
    id: "discord",
    name: "Discord",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/9/98/Discord_logo.svg",
    color: "bg-indigo-600",
    defaultPort: "",
    description: "Connect to Discord servers and channels",
  },
  {
    id: "github",
    name: "GitHub",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg",
    color: "bg-gray-800",
    defaultPort: "",
    description: "Connect to GitHub repositories and issues",
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/18/GitLab_Logo.svg",
    color: "bg-orange-600",
    defaultPort: "",
    description: "Connect to GitLab repositories and issues",
  },
  {
    id: "jira",
    name: "Jira",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Jira_Software_%28Atlassian%29_logo.svg",
    color: "bg-blue-600",
    defaultPort: "",
    description: "Connect to Jira projects and issues",
  },
  {
    id: "trello",
    name: "Trello",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/07/Trello_logo.svg",
    color: "bg-blue-500",
    defaultPort: "",
    description: "Connect to Trello boards and cards",
  },
  {
    id: "asana",
    name: "Asana",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Asana_Logo.svg",
    color: "bg-red-500",
    defaultPort: "",
    description: "Connect to Asana projects and tasks",
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Confluence_%28Atlassian%29_logo.svg",
    color: "bg-blue-700",
    defaultPort: "",
    description: "Connect to Confluence pages and documentation",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/67/Microsoft_SharePoint_%282019%E2%80%93present%29.svg",
    color: "bg-blue-600",
    defaultPort: "",
    description: "Connect to SharePoint sites and documents",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Microsoft_OneDrive_%282019%E2%80%93present%29.svg",
    color: "bg-blue-500",
    defaultPort: "",
    description: "Connect to OneDrive files and folders",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg",
    color: "bg-blue-400",
    defaultPort: "",
    description: "Connect to Dropbox files and folders",
  },
  {
    id: "website-url",
    name: "Website URL",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg",
    color: "bg-orange-500",
    defaultPort: "",
    description: "Connect to any website for content extraction",
  },
  {
    id: "rss-feed",
    name: "RSS Feed",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/4/43/Feed-icon.svg",
    color: "bg-orange-600",
    defaultPort: "",
    description: "Connect to RSS feeds for news and updates",
  },
  {
    id: "api-endpoint",
    name: "API Endpoint",
    category: "others",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png",
    color: "bg-yellow-500",
    defaultPort: "",
    description: "Connect to REST APIs and web services",
  },
];

export default function DatabaseConnectionModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  workspaceId,
}: DatabaseConnectionModalProps) {
  // Fetch database configurations from database
  const {
    dataSources: enabledDataSources,
    loading: configLoading,
    error: configError,
  } = useDatabaseConfig();
  const authContext = useSupabaseAuth();
  const { session } = authContext || { session: null };
  const [selectedDbType, setSelectedDbType] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setStatusMessage("");
      setStatusType("info");
      setSelectedCategory("all");
      setSelectedDbType("");
    }
  }, [isOpen]);
  const [connectionConfig, setConnectionConfig] = useState<DatabaseConfig>({
    type: "",
    name: "",
    host: "",
    port: "",
    database: "",
    username: "",
    password: "",
    ssl: false,
    connectionString: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<
    | "select"
    | "configure"
    | "test"
    | "schema-input"
    | "schema-validation"
    | "fetch-tables"
    | "table-selection"
    | "processing"
  >("select");
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(
    null
  );
  const [selectedTables, setSelectedTables] = useState<SelectedTable[]>([]);
  const [schemaName, setSchemaName] = useState<string>("public");
  const [fetchProgress, setFetchProgress] = useState<{
    status: "idle" | "fetching" | "processing" | "complete";
    message: string;
    tablesFound: number;
    currentTable?: string;
  }>({
    status: "idle",
    message: "",
    tablesFound: 0,
  });

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      status: "pending" | "in_progress" | "completed" | "error";
      estimatedTime?: number;
      actualTime?: number;
    }>
  >([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [estimatedTotalTime, setEstimatedTotalTime] = useState(0);

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");

  // Helper function to get filtered data sources based on selected category
  const getFilteredDataSources = (): DataSource[] => {
    if (configLoading) {
      // Return empty array while loading to prevent showing disabled sources
      return [];
    }

    if (configError) {
      // Only show basic database sources as fallback, no file sources
      const fallbackSources = DATA_SOURCE_TYPES.filter(
        (source) => source.category === "sql" || source.category === "nosql"
      );
      if (selectedCategory === "all") {
        return fallbackSources;
      }
      return fallbackSources.filter(
        (source) => source.category === selectedCategory
      );
    }

    // Use database configuration (already filtered to enabled sources only)
    if (selectedCategory === "all") {
      return enabledDataSources;
    }
    return enabledDataSources.filter(
      (source) => source.category === selectedCategory
    );
  };

  // Find selected database from either hardcoded or filtered database configuration
  const selectedDb = getFilteredDataSources().find(
    (db) => db.id === selectedDbType
  );

  /**
   * Helper function to update status messages in the modal
   */
  const updateStatus = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) => {
    setStatusMessage(message);
    setStatusType(type);
  };

  /**
   * Step 1: User clicks on data source type
   * Sets the selected data source type and moves to configuration step
   */
  const handleDbTypeSelect = (dbType: string) => {
    setSelectedDbType(dbType);
    const sourceType = DATA_SOURCE_TYPES.find((db) => db.id === dbType);
    setConnectionConfig((prev) => ({
      ...prev,
      type: dbType,
      name: sourceType?.name || "",
      port: sourceType?.defaultPort || "",
    }));

    // Since we're using database-specific API, all types are database types
    setStep("configure");
  };

  /**
   * Step 2: User enters credentials on modal
   * Updates the connection configuration as user types
   */
  const handleConfigChange = (
    field: keyof DatabaseConfig,
    value: string | boolean
  ) => {
    setConnectionConfig((prev) => {
      const newConfig = {
        ...prev,
        [field]: value,
      };

      // Auto-enable SSL for Supabase connections
      if (field === "host" && typeof value === "string") {
        const isSupabase =
          value.includes("supabase.com") ||
          value.includes("pooler.supabase.com");
        if (isSupabase && !newConfig.ssl) {
          newConfig.ssl = true;
        }
      }

      return newConfig;
    });
  };

  /**
   * Step 7: User selects tables/views they want to load
   * Handles table selection with checkboxes
   */
  const toggleTableSelection = (table: DatabaseTable) => {
    setSelectedTables((prev) => {
      const existingIndex = prev.findIndex((t) => t.table_name === table.name);
      if (existingIndex >= 0) {
        // Remove table
        return prev.filter((t) => t.table_name !== table.name);
      } else {
        // Add table with all columns selected
        const selectedColumns =
          table.columns.length > 0
            ? table.columns.map((col) => col.name)
            : ["*"]; // Select all columns if not loaded yet

        return [
          ...prev,
          {
            table_name: table.name,
            schema_name: table.schema,
            selected_columns: selectedColumns,
            include_sample_data: true,
            sample_size: 100,
          },
        ];
      }
    });
  };

  /**
   * Helper function to check if a table is selected
   */
  const isTableSelected = (tableName: string) => {
    return selectedTables.some((t) => t.table_name === tableName);
  };

  /**
   * Helper function to check if all tables are selected
   */
  const areAllTablesSelected = () => {
    if (!databaseSchema || !databaseSchema.tables || !databaseSchema.views)
      return false;
    const allTables = [...databaseSchema.tables, ...databaseSchema.views];
    return (
      allTables.length > 0 &&
      allTables.every((table) => isTableSelected(table.name))
    );
  };

  /**
   * Helper function to select or deselect all tables
   */
  const toggleSelectAllTables = () => {
    if (!databaseSchema || !databaseSchema.tables || !databaseSchema.views)
      return;

    const allTables = [...databaseSchema.tables, ...databaseSchema.views];

    if (areAllTablesSelected()) {
      // Deselect all tables
      setSelectedTables([]);
    } else {
      // Select all tables
      const allSelectedTables = allTables.map((table) => ({
        table_name: table.name,
        schema_name: table.schema,
        selected_columns:
          table.columns && table.columns.length > 0
            ? table.columns.map((col) => col.name)
            : ["*"], // Select all columns if not loaded yet
        include_sample_data: true,
        sample_size: 100,
      }));
      setSelectedTables(allSelectedTables);
    }
  };

  /**
   * Step 3: Test database connection
   * This validates the connection credentials and basic connectivity
   */
  const handleTestConnection = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
    }

    // Validate required fields before making the request
    const requiredFields = ["type", "name", "database"];
    const missingFields = requiredFields.filter((field) => {
      const value = connectionConfig[field as keyof DatabaseConfig];
      return !value || value.toString().trim() === "";
    });

    if (missingFields.length > 0) {
      updateStatus(
        `Please fill in the following required fields: ${missingFields.join(
          ", "
        )}`,
        "error"
      );
      return;
    }

    // For non-SQLite databases, validate additional fields
    if (connectionConfig.type !== "sqlite") {
      const additionalRequired = ["host", "username", "password"];
      const missingAdditional = additionalRequired.filter((field) => {
        const value = connectionConfig[field as keyof DatabaseConfig];
        return !value || value.toString().trim() === "";
      });

      if (missingAdditional.length > 0) {
        updateStatus(
          `Please fill in the following required fields for ${
            connectionConfig.type
          }: ${missingAdditional.join(", ")}`,
          "error"
        );
        return;
      }
    }

    setIsConnecting(true);
    updateStatus("Testing database connection...", "info");

    try {
      const response = await fetch("/api/database-connections/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          config: connectionConfig,
          fetchSchema: false, // Don't fetch schema during test - keep it fast
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        updateStatus("Connection test successful!", "success");
        setStep("schema-input"); // Move to schema input step
      } else {
        // Handle both API errors and connection failures
        const errorMessage =
          result.error || result.message || "Connection test failed";
        updateStatus(`Connection failed: ${errorMessage}`, "error");
        console.error("Connection test failed:", {
          result,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
      }
    } catch (error) {
      console.error("Connection test error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      updateStatus(
        `Connection test failed: ${errorMessage}. Please check your configuration.`,
        "error"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Step 4: User enters schema name and clicks validate
   * Moves to schema validation step and automatically starts validation
   */
  const handleSchemaInput = () => {
    if (!schemaName.trim()) {
      updateStatus("Please enter a schema name", "error");
      return;
    }
    setStep("schema-validation");
    // Automatically start validation when moving to this step
    setTimeout(() => {
      handleValidateSchema();
    }, 100);
  };

  /**
   * Step 5: Validate if schema exists
   * If fails, show error and allow re-entry or cancel
   * If success, allow them to fetch tables
   */
  const handleValidateSchema = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
    }

    setIsConnecting(true);
    updateStatus(`Validating schema '${schemaName}'...`, "info");

    try {
      const validationResponse = await fetch(
        "/api/database-connections/validate-schema",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            config: connectionConfig,
            schemaName: schemaName,
          }),
        }
      );

      const validationResult = await validationResponse.json();

      if (!validationResult.success) {
        updateStatus(
          `Schema validation failed: ${validationResult.error}`,
          "error"
        );
        // Allow user to re-enter schema name or cancel
        setStep("schema-input");
        return;
      }

      updateStatus(`Schema '${schemaName}' validated successfully!`, "success");
      setStep("fetch-tables");
    } catch (error) {
      console.error("Schema validation error:", error);
      updateStatus("Schema validation failed. Please try again.", "error");
      setStep("schema-input");
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Step 6: Fetch all tables, columns, column types, foreign key info and views
   * Only show table names with checkboxes on frontend, but retain all extra info
   */
  const handleFetchTables = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
    }

    setIsConnecting(true);
    updateStatus("Fetching table information...", "info");
    setFetchProgress({
      status: "processing",
      message: "Fetching table information...",
      tablesFound: 0,
    });

    try {
      // Step 6: Fetch tables from the validated schema

      const response = await fetch("/api/database-connections/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          config: connectionConfig,
          fetchSchema: true,
          schemaName: schemaName, // Include validated schema name
        }),
      });

      const result = await response.json();

      if (result.success && result.schema) {
        setFetchProgress({
          status: "complete",
          message: `Found ${result.schema.tables.length} tables and ${result.schema.views.length} views`,
          tablesFound: result.schema.tables.length + result.schema.views.length,
        });

        setDatabaseSchema(result.schema);
        setStep("table-selection"); // Move to table selection step
        updateStatus(
          `Found ${result.schema.tables.length} tables and ${result.schema.views.length} views in schema '${schemaName}'!`,
          "success"
        );
      } else {
        setFetchProgress({
          status: "idle",
          message: "",
          tablesFound: 0,
        });
        updateStatus(
          `Failed to fetch tables: ${result.error || "Unknown error"}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Fetch tables error:", error);
      setFetchProgress({
        status: "idle",
        message: "",
        tablesFound: 0,
      });
      updateStatus("Failed to fetch tables. Please try again.", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Step 8: Complete database setup in a single optimized API call
   * This does everything in one go:
   * 1. Saves the database connection with encrypted credentials
   * 2. Fetches detailed column information with sample data
   * 3. Generates AI definitions for tables and columns using LLM
   * 4. Generates a holistic database summary
   * 5. Stores everything in encrypted form
   */
  const handleSaveConnection = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
    }

    if (selectedTables.length === 0) {
      updateStatus("Please select at least one table to connect.", "error");
      return;
    }

    // Initialize progress steps
    const steps = [
      {
        id: "validate",
        title: "Validating Connection",
        description: "Testing database connectivity and permissions",
        status: "pending" as const,
        estimatedTime: 10,
      },
      {
        id: "fetch_schema",
        title: "Fetching Schema",
        description: "Retrieving table structures and column information",
        status: "pending" as const,
        estimatedTime: 15,
      },
      {
        id: "generate_ai",
        title: "Generating Smart Definitions",
        description: `Creating intelligent descriptions for ${selectedTables.length} tables`,
        status: "pending" as const,
        estimatedTime: selectedTables.length * 20,
      },
      {
        id: "save_connection",
        title: "Saving Connection",
        description: "Storing connection details and AI definitions",
        status: "pending" as const,
        estimatedTime: 5,
      },
    ];

    setProgressSteps(steps);
    setOverallProgress(0);
    setEstimatedTotalTime(
      steps.reduce((total, step) => total + (step.estimatedTime || 0), 0)
    );
    setShowProgressModal(true);
    setStep("processing");
    setIsConnecting(true);

    try {
      // Step 1: Validating Connection
      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === "validate"
            ? { ...step, status: "in_progress" as const }
            : step
        )
      );
      setOverallProgress(10);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === "validate"
            ? { ...step, status: "completed" as const }
            : step
        )
      );
      setOverallProgress(25);

      // Step 2: Fetching Schema
      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === "fetch_schema"
            ? { ...step, status: "in_progress" as const }
            : step
        )
      );
      setOverallProgress(35);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === "fetch_schema"
            ? { ...step, status: "completed" as const }
            : step
        )
      );
      setOverallProgress(50);

      // Step 3: Generating AI Definitions
      setProgressSteps((prev) =>
        prev.map((step) =>
          step.id === "generate_ai"
            ? { ...step, status: "in_progress" as const }
            : step
        )
      );
      setOverallProgress(60);

      // Single API call that does everything: save connection, fetch columns, generate AI definitions
      const response = await fetch("/api/database-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          config: connectionConfig,
          schema: databaseSchema,
          selectedTables,
          schemaName: schemaName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Step 4: Saving Connection
        setProgressSteps((prev) =>
          prev.map((step) =>
            step.id === "save_connection"
              ? { ...step, status: "in_progress" as const }
              : step
          )
        );
        setOverallProgress(80);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update all steps to completed
        setProgressSteps((prev) =>
          prev.map((step) => ({ ...step, status: "completed" as const }))
        );
        setOverallProgress(100);

        updateStatus(
          `Database connection completed successfully! ${result.tables_processed} tables processed with AI definitions.`,
          "success"
        );

        // Close progress modal and main modal after a delay
        setTimeout(() => {
          setShowProgressModal(false);
          onConnectionSuccess({
            connectionName: connectionConfig.name,
            tablesProcessed: result.tables_processed || selectedTables.length,
          });
          onClose();
        }, 2000);

        // Reset form for next connection
        setSelectedDbType("");
        setSelectedCategory("all");
        setConnectionConfig({
          type: "",
          name: "",
          host: "",
          port: "",
          database: "",
          username: "",
          password: "",
          ssl: false,
          connectionString: "",
        });
        setStep("select");
      } else {
        // Update progress to show error
        setProgressSteps((prev) =>
          prev.map((step) => ({
            ...step,
            status:
              step.status === "in_progress" ? ("error" as const) : step.status,
          }))
        );

        updateStatus(`Failed to setup connection: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Save connection error:", error);

      // Update progress to show error
      setProgressSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status:
            step.status === "in_progress" ? ("error" as const) : step.status,
        }))
      );

      updateStatus("Failed to setup connection. Please try again.", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("select");
    } else if (step === "test") {
      setStep("configure");
    } else if (step === "schema-input") {
      setStep("test");
    } else if (step === "schema-validation") {
      setStep("schema-input");
    } else if (step === "fetch-tables") {
      setStep("schema-validation");
    } else if (step === "table-selection") {
      setStep("fetch-tables");
    } else if (step === "processing") {
      setStep("table-selection");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
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
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Connect Data Source
                </h2>
                <p className="text-xs text-gray-400">
                  Add a new data source to your workspace
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
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

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`px-6 py-3 border-b border-gray-700 ${
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

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {step === "select" && (
            <div className="flex h-full">
              {/* Left Sidebar - Categories */}
              <div className="w-56 bg-gray-800/50 border-r border-gray-700 p-3">
                <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">
                  Data Sources
                </h3>
                <div className="space-y-1">
                  {DATA_SOURCE_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded text-left transition-colors ${
                        selectedCategory === category.id
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                      }`}
                    >
                      <div className="flex-shrink-0">{category.icon}</div>
                      <span className="text-xs font-medium">
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Content - Data Source Types */}
              <div className="flex-1 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {selectedCategory === "all"
                      ? "All Data Sources"
                      : `${
                          DATA_SOURCE_CATEGORIES.find(
                            (c) => c.id === selectedCategory
                          )?.name
                        } Data Sources`}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Select a data source to connect to your workspace
                  </p>
                </div>

                {/* Loading state */}
                {configLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span>Loading data sources...</span>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {configError && (
                  <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">
                        Using fallback data sources (database types only). File
                        sources are disabled when configuration fails.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getFilteredDataSources().map((source) => (
                    <button
                      key={source.id}
                      onClick={() => handleDbTypeSelect(source.id)}
                      className="p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-all duration-200 hover:border-gray-500 group text-left"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <div
                          className={`w-8 h-8 ${source.color} rounded flex items-center justify-center flex-shrink-0`}
                        >
                          {source.icon.startsWith("http") ? (
                            <Image
                              src={source.icon}
                              alt={source.name}
                              width={24}
                              height={24}
                              className="w-6 h-6 object-contain filter brightness-0 invert"
                              onError={(e) => {
                                // Fallback to a simple icon if image fails to load
                                e.currentTarget.style.display = "none";
                                const nextElement = e.currentTarget
                                  .nextElementSibling as HTMLElement;
                                if (nextElement) {
                                  nextElement.style.display = "block";
                                }
                              }}
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {source.icon}
                            </span>
                          )}
                          {/* Fallback icon for failed image loads */}
                          <span
                            className="text-white font-bold text-sm hidden"
                            style={{ display: "none" }}
                          >
                            {source.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-white font-medium text-sm">
                              {source.name}
                            </h4>
                            {source.isBeta && (
                              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Beta
                              </span>
                            )}
                          </div>
                          {source.defaultPort && (
                            <p className="text-gray-400 text-xs">
                              Port: {source.defaultPort}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-300 text-xs">
                        {source.description}
                      </p>
                    </button>
                  ))}
                </div>

                {getFilteredDataSources().length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
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
                          d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-white font-medium mb-2">
                      No data sources found
                    </h4>
                    <p className="text-gray-400 text-sm">
                      No data sources available in this category.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "configure" && selectedDb && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div
                  className={`w-10 h-10 ${selectedDb.color} rounded-lg flex items-center justify-center`}
                >
                  {selectedDb.icon.startsWith("http") ? (
                    <Image
                      src={selectedDb.icon}
                      alt={selectedDb.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain filter brightness-0 invert"
                      onError={(e) => {
                        // Fallback to a simple icon if image fails to load
                        e.currentTarget.style.display = "none";
                        const nextElement = e.currentTarget
                          .nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = "block";
                        }
                      }}
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {selectedDb.icon}
                    </span>
                  )}
                  {/* Fallback icon for failed image loads */}
                  <span
                    className="text-white font-bold text-lg hidden"
                    style={{ display: "none" }}
                  >
                    {selectedDb.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Configure {selectedDb.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Enter your database connection details
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Connection Name *
                    </label>
                    <input
                      type="text"
                      value={connectionConfig.name}
                      onChange={(e) =>
                        handleConfigChange("name", e.target.value)
                      }
                      placeholder="e.g., Production DB, Analytics DB"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Database-specific fields */}
                  {selectedDbType !== "sqlite" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Host *
                      </label>
                      <input
                        type="text"
                        value={connectionConfig.host}
                        onChange={(e) =>
                          handleConfigChange("host", e.target.value)
                        }
                        placeholder="localhost, db.example.com"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Non-database specific fields - removed since we only handle database types */}
                  {false && (
                    <>
                      {selectedDbType === "google-sheets" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Google Sheets URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "google-docs" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Google Docs URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://docs.google.com/document/d/..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "website-url" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Website URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://example.com"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "confluence" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Confluence URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://yourcompany.atlassian.net/wiki"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "notion" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Notion Workspace URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://notion.so/yourworkspace"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "airtable" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Airtable Base URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://airtable.com/appXXXXXXXXXXXXXX"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "slack" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Slack Workspace URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://yourworkspace.slack.com"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "discord" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Discord Server ID *
                          </label>
                          <input
                            type="text"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="123456789012345678"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "github" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            GitHub Repository URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://github.com/username/repository"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "gitlab" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            GitLab Project URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://gitlab.com/username/project"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "jira" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Jira Instance URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://yourcompany.atlassian.net"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "trello" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Trello Board URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://trello.com/b/boardid/boardname"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "asana" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Asana Project URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://app.asana.com/0/projectid"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "sharepoint" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            SharePoint Site URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://yourcompany.sharepoint.com/sites/sitename"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "onedrive" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            OneDrive Folder URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://yourcompany-my.sharepoint.com/personal/..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "dropbox" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Dropbox Folder URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://www.dropbox.com/home/foldername"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "rss-feed" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            RSS Feed URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://example.com/feed.xml"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      {selectedDbType === "api-endpoint" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            API Endpoint URL *
                          </label>
                          <input
                            type="url"
                            value={connectionConfig.host}
                            onChange={(e) =>
                              handleConfigChange("host", e.target.value)
                            }
                            placeholder="https://api.example.com/v1/endpoint"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Database-specific fields - only show for database types */}
                  {true && (
                    <>
                      {selectedDbType !== "sqlite" &&
                        selectedDbType !== "bigquery" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Port *
                            </label>
                            <input
                              type="text"
                              value={connectionConfig.port}
                              onChange={(e) =>
                                handleConfigChange("port", e.target.value)
                              }
                              placeholder={selectedDb.defaultPort}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        )}

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Database Name *
                        </label>
                        <input
                          type="text"
                          value={connectionConfig.database}
                          onChange={(e) =>
                            handleConfigChange("database", e.target.value)
                          }
                          placeholder="database_name"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {selectedDbType !== "sqlite" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Username *
                          </label>
                          <input
                            type="text"
                            value={connectionConfig.username}
                            onChange={(e) =>
                              handleConfigChange("username", e.target.value)
                            }
                            placeholder="username"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {selectedDbType !== "sqlite" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Password *
                          </label>
                          <input
                            type="password"
                            value={connectionConfig.password}
                            onChange={(e) =>
                              handleConfigChange("password", e.target.value)
                            }
                            placeholder="password"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Database-specific configuration options */}
                {true && (
                  <>
                    {selectedDbType === "postgresql" && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="ssl"
                            checked={connectionConfig.ssl}
                            onChange={(e) =>
                              handleConfigChange("ssl", e.target.checked)
                            }
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <label
                            htmlFor="ssl"
                            className="text-sm text-gray-300"
                          >
                            Use SSL connection
                          </label>
                        </div>
                        {connectionConfig.ssl &&
                          (connectionConfig.host.includes("supabase.com") ||
                            connectionConfig.host.includes(
                              "pooler.supabase.com"
                            )) && (
                            <p className="text-xs text-blue-400 flex items-center">
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              SSL automatically enabled for Supabase connections
                            </p>
                          )}
                      </div>
                    )}

                    {selectedDbType === "bigquery" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Connection String *
                        </label>
                        <textarea
                          value={connectionConfig.connectionString || ""}
                          onChange={(e) =>
                            handleConfigChange(
                              "connectionString",
                              e.target.value
                            )
                          }
                          placeholder="bigquery://project.dataset"
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    {selectedDbType === "sqlite" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Database File Path *
                        </label>
                        <input
                          type="text"
                          value={connectionConfig.host}
                          onChange={(e) =>
                            handleConfigChange("host", e.target.value)
                          }
                          placeholder="/path/to/database.db"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Non-database specific configuration options - removed since we only handle database types */}
                {false && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
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
                      <span className="text-blue-400 font-medium">
                        Connection Information
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      {selectedDbType === "google-sheets" &&
                        "Make sure the Google Sheets document is publicly accessible or shared with the appropriate permissions."}
                      {selectedDbType === "google-docs" &&
                        "Make sure the Google Docs document is publicly accessible or shared with the appropriate permissions."}
                      {selectedDbType === "notion" &&
                        "You'll need to create an integration token in Notion and share the workspace with the integration."}
                      {selectedDbType === "airtable" &&
                        "You'll need to create a personal access token in Airtable and ensure the base is accessible."}
                      {selectedDbType === "slack" &&
                        "You'll need to create a Slack app and obtain the necessary OAuth tokens for your workspace."}
                      {selectedDbType === "discord" &&
                        "You'll need to create a Discord bot and obtain the server ID for the channels you want to access."}
                      {selectedDbType === "github" &&
                        "You'll need to create a GitHub personal access token with appropriate repository permissions."}
                      {selectedDbType === "gitlab" &&
                        "You'll need to create a GitLab personal access token with appropriate project permissions."}
                      {selectedDbType === "jira" &&
                        "You'll need to create an API token in Jira and ensure you have access to the projects."}
                      {selectedDbType === "trello" &&
                        "You'll need to create a Trello API key and token to access the board data."}
                      {selectedDbType === "asana" &&
                        "You'll need to create a personal access token in Asana to access the project data."}
                      {selectedDbType === "confluence" &&
                        "You may need to provide authentication credentials or API tokens for private Confluence instances."}
                      {selectedDbType === "sharepoint" &&
                        "You'll need to authenticate with Microsoft Graph API to access SharePoint sites and documents."}
                      {selectedDbType === "onedrive" &&
                        "You'll need to authenticate with Microsoft Graph API to access OneDrive files and folders."}
                      {selectedDbType === "dropbox" &&
                        "You'll need to create a Dropbox app and obtain access tokens to access files and folders."}
                      {selectedDbType === "website-url" &&
                        "The website should be publicly accessible. Some websites may require authentication or have rate limits."}
                      {selectedDbType === "rss-feed" &&
                        "The RSS feed should be publicly accessible. Most news sites and blogs provide RSS feeds."}
                      {selectedDbType === "api-endpoint" &&
                        "The API endpoint should be accessible and may require authentication tokens or API keys."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "test" && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Connection Test Successful!
                  </h3>
                  <p className="text-sm text-gray-400">
                    Your database connection is working properly
                  </p>
                </div>
              </div>

              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
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
                  <span className="text-green-400 font-medium">
                    Connection verified successfully
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-2">
                  Your {selectedDb?.name} database is accessible and ready to
                  use with Insighter.
                </p>
              </div>
            </div>
          )}

          {step === "schema-input" && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Enter Schema Name
                  </h3>
                  <p className="text-sm text-gray-400">
                    Specify the database schema to connect to
                  </p>
                </div>
              </div>

              <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5 text-purple-400"
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
                  <span className="text-purple-400 font-medium">
                    Schema Information
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-2">
                  Enter the name of the database schema you want to connect to.
                  Common schema names include &quot;public&quot; for PostgreSQL,
                  &quot;information_schema&quot; for MySQL, etc.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schema Name *
                  </label>
                  <input
                    type="text"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value)}
                    placeholder="public"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {step === "schema-validation" && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={() => setStep("schema-input")}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Validating Schema
                  </h3>
                  <p className="text-sm text-gray-400">
                    Checking if schema &apos;{schemaName}&apos; exists in your
                    database
                  </p>
                </div>
              </div>

              <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-5 h-5 text-orange-400 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="text-orange-400 font-medium">
                    Validating schema access...
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-2">
                  We&apos;re checking if the schema &apos;{schemaName}&apos;
                  exists and is accessible with your current credentials.
                </p>
              </div>
            </div>
          )}

          {step === "fetch-tables" && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
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
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Fetch Database Tables
                  </h3>
                  <p className="text-sm text-gray-400">
                    Get available tables and views from your database
                  </p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
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
                  <span className="text-blue-400 font-medium">
                    Ready to fetch tables
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-2">
                  Click the button below to retrieve all available tables and
                  views from your {selectedDb?.name} database. This will allow
                  you to select which tables to connect to Insighter.
                </p>
              </div>

              {/* Step 4: Schema Selection - User enters schema name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schema Name (Optional)
                </label>
                <input
                  type="text"
                  value={schemaName}
                  onChange={(e) => setSchemaName(e.target.value)}
                  placeholder="public"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-gray-400 text-xs mt-1">
                  Leave empty or use &apos;public&apos; for default schema. This
                  will limit the search to specific schema, making it faster.
                </p>
              </div>

              {/* Progress Display */}
              {fetchProgress.status !== "idle" && (
                <div className="mb-6 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
                  <div className="flex items-center space-x-3 mb-2">
                    {fetchProgress.status === "fetching" && (
                      <svg
                        className="w-5 h-5 text-blue-400 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {fetchProgress.status === "processing" && (
                      <svg
                        className="w-5 h-5 text-yellow-400 animate-pulse"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                        />
                      </svg>
                    )}
                    {fetchProgress.status === "complete" && (
                      <svg
                        className="w-5 h-5 text-green-400"
                        fill="none"
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
                    <span className="text-white font-medium">
                      {fetchProgress.message}
                    </span>
                  </div>
                  {fetchProgress.tablesFound > 0 && (
                    <p className="text-gray-300 text-sm">
                      Tables found: {fetchProgress.tablesFound}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "table-selection" && databaseSchema && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Select Tables & Views
                  </h3>
                  <p className="text-sm text-gray-400">
                    Choose which tables and views to connect from{" "}
                    {databaseSchema.database_name}
                  </p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
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
                  <span className="text-blue-400 font-medium">
                    Schema Information Loaded
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-2">
                  Found {databaseSchema.total_tables} tables and{" "}
                  {databaseSchema.total_views} views. Select the ones you want
                  to connect to your workspace.
                </p>
              </div>

              <div className="space-y-4">
                {/* Select All Section - Only show if there are tables or views */}
                {(databaseSchema.tables.length > 0 ||
                  databaseSchema.views.length > 0) && (
                  <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={areAllTablesSelected()}
                        onChange={toggleSelectAllTables}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <h4 className="text-white font-medium">
                          Select All Tables & Views
                        </h4>
                        <p className="text-gray-400 text-sm">
                          Select or deselect all{" "}
                          {databaseSchema.total_tables +
                            databaseSchema.total_views}{" "}
                          tables and views at once
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Tables Section - Display tables with checkboxes for selection */}
                {databaseSchema.tables.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-white mb-3 flex items-center space-x-2">
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                        />
                      </svg>
                      <span>Tables ({databaseSchema.tables.length})</span>
                      <span className="text-xs text-blue-400 ml-2">
                        AI Definitions
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {databaseSchema.tables.map((table, index) => (
                        <div
                          key={`table-${table.name}-${index}`}
                          className="bg-gray-700/30 border border-gray-600 rounded-lg"
                        >
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isTableSelected(table.name)}
                                  onChange={() => toggleTableSelection(table)}
                                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                  <h5 className="text-white font-medium">
                                    {table.name}
                                  </h5>
                                  {table.ai_definition && (
                                    <p className="text-blue-300 text-xs mt-1">
                                      {table.ai_definition.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Views Section */}
                {databaseSchema.views.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-white mb-3 flex items-center space-x-2">
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <span>Views ({databaseSchema.views.length})</span>
                    </h4>
                    <div className="space-y-2">
                      {databaseSchema.views.map((view, index) => (
                        <div
                          key={`view-${view.name}-${index}`}
                          className="bg-gray-700/30 border border-gray-600 rounded-lg"
                        >
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isTableSelected(view.name)}
                                  onChange={() => toggleTableSelection(view)}
                                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                  <h5 className="text-white font-medium">
                                    {view.name}
                                  </h5>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTables.length > 0 && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
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
                      <span className="text-green-400 font-medium">
                        {selectedTables.length} table
                        {selectedTables.length !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mt-2">
                      Ready to connect {selectedTables.length} table
                      {selectedTables.length !== 1 ? "s" : ""} to your
                      workspace.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                step === "select" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "configure" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "test" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "schema-input" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "schema-validation" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "fetch-tables" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "table-selection" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                step === "processing" ? "bg-blue-500" : "bg-gray-600"
              }`}
            ></div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            {step === "configure" && (
              <button
                onClick={handleTestConnection}
                disabled={
                  isConnecting ||
                  !connectionConfig.name ||
                  !connectionConfig.database
                }
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
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
            )}

            {step === "test" && (
              <button
                onClick={handleFetchTables}
                disabled={isConnecting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Fetching Tables...</span>
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
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                    <span>Fetch Tables</span>
                  </>
                )}
              </button>
            )}

            {step === "schema-input" && (
              <button
                onClick={handleSchemaInput}
                disabled={!schemaName.trim()}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Validate Schema</span>
              </button>
            )}

            {step === "schema-validation" && (
              <button
                onClick={handleValidateSchema}
                disabled={isConnecting}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Validating...</span>
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
                    <span>Validate Schema</span>
                  </>
                )}
              </button>
            )}

            {step === "fetch-tables" && (
              <button
                onClick={handleFetchTables}
                disabled={isConnecting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Fetching Tables...</span>
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
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                    <span>Fetch Tables</span>
                  </>
                )}
              </button>
            )}

            {/* Step 8: Load button - User selects and clicks load to start main process */}
            {step === "table-selection" && (
              <button
                onClick={handleSaveConnection}
                disabled={isConnecting || selectedTables.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Saving...</span>
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Save Connection</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <DatabaseSetupProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        connectionName={connectionConfig.name}
        steps={progressSteps}
        overallProgress={overallProgress}
        estimatedTotalTime={estimatedTotalTime}
        onCancel={() => {
          setShowProgressModal(false);
          setIsConnecting(false);
          setStep("table-selection");
        }}
      />
    </div>
  );
}
