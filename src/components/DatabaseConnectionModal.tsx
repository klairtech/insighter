"use client";

import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  DatabaseSchema,
  DatabaseTable,
  SelectedTable,
} from "@/types/database-schema";

interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: () => void;
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

const DATABASE_TYPES = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    icon: "P",
    color: "bg-blue-500",
    defaultPort: "5432",
    description: "Advanced open source relational database",
  },
  {
    id: "mysql",
    name: "MySQL",
    icon: "M",
    color: "bg-orange-500",
    defaultPort: "3306",
    description: "Popular open source relational database",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    icon: "M",
    color: "bg-green-500",
    defaultPort: "27017",
    description: "NoSQL document database",
  },
  {
    id: "redis",
    name: "Redis",
    icon: "R",
    color: "bg-red-500",
    defaultPort: "6379",
    description: "In-memory data structure store",
  },
  {
    id: "sqlite",
    name: "SQLite",
    icon: "S",
    color: "bg-purple-500",
    defaultPort: "",
    description: "Lightweight embedded database",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    icon: "B",
    color: "bg-yellow-500",
    defaultPort: "",
    description: "Google's cloud data warehouse",
  },
];

export default function DatabaseConnectionModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  workspaceId,
}: DatabaseConnectionModalProps) {
  const { session } = useSupabaseAuth();
  const [selectedDbType, setSelectedDbType] = useState<string>("");

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setStatusMessage("");
      setStatusType("info");
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

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");

  const selectedDb = DATABASE_TYPES.find((db) => db.id === selectedDbType);

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
   * Step 1: User clicks on database type
   * Sets the selected database type and moves to configuration step
   */
  const handleDbTypeSelect = (dbType: string) => {
    setSelectedDbType(dbType);
    setConnectionConfig((prev) => ({
      ...prev,
      type: dbType,
      name: DATABASE_TYPES.find((db) => db.id === dbType)?.name || "",
      port: DATABASE_TYPES.find((db) => db.id === dbType)?.defaultPort || "",
    }));
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
    setConnectionConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
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
   * Step 3: Test database connection
   * This validates the connection credentials and basic connectivity
   */
  const handleTestConnection = async () => {
    if (!session?.access_token) {
      updateStatus("Authentication required. Please log in again.", "error");
      return;
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

      if (result.success) {
        updateStatus("Connection test successful!", "success");
        setStep("schema-input"); // Move to schema input step
      } else {
        updateStatus(`Connection failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Connection test error:", error);
      updateStatus(
        "Connection test failed. Please check your configuration.",
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
      console.log("Validating schema:", schemaName);
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
      console.log("Fetching tables from validated schema:", schemaName);

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

    setStep("processing"); // Move to processing step
    setIsConnecting(true);
    updateStatus("Setting up database connection...", "info");

    try {
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
        updateStatus(
          `Database connection completed successfully! ${result.tables_processed} tables processed with AI definitions.`,
          "success"
        );

        // Close modal and refresh workspace
        setTimeout(() => {
          onConnectionSuccess();
          onClose();
        }, 1000);

        // Reset form for next connection
        setSelectedDbType("");
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
        updateStatus(`Failed to setup connection: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Save connection error:", error);
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
                <h2 className="text-xl font-semibold text-white">
                  Connect Database
                </h2>
                <p className="text-sm text-gray-400">
                  Add a new database connection to your workspace
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
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Choose Database Type
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DATABASE_TYPES.map((db) => (
                  <button
                    key={db.id}
                    onClick={() => handleDbTypeSelect(db.id)}
                    className="p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-all duration-200 hover:border-gray-500 group"
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div
                        className={`w-10 h-10 ${db.color} rounded-lg flex items-center justify-center`}
                      >
                        <span className="text-white font-bold text-lg">
                          {db.icon}
                        </span>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">{db.name}</h4>
                        <p className="text-gray-400 text-sm">
                          Port: {db.defaultPort || "N/A"}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm text-left">
                      {db.description}
                    </p>
                  </button>
                ))}
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
                  <span className="text-white font-bold text-lg">
                    {selectedDb.icon}
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
                </div>

                {selectedDbType === "postgresql" && (
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
                    <label htmlFor="ssl" className="text-sm text-gray-300">
                      Use SSL connection
                    </label>
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
                        handleConfigChange("connectionString", e.target.value)
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
    </div>
  );
}
