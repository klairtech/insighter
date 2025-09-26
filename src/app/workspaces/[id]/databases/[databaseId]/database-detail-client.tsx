"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DatabaseTable, DatabaseSchema } from "@/types/database-schema";
import ConfirmationModal from "@/components/ConfirmationModal";

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  schema_name: string;
  created_at: string;
  last_schema_sync: string | null;
  schema_version: number;
  workspace_id: string;
}

// DatabaseSchema interface is now imported from @/types/database-schema

// DatabaseSummary is now part of DatabaseSchema.ai_definition

// AIStatus interface no longer needed - AI definitions are generated during connection setup

interface DatabaseDetailClientProps {
  database: DatabaseConnection;
  initialWorkspace: {
    id: string;
    name: string;
    description: string | null;
    organization_id: string;
    created_at: string;
    updated_at: string;
    userRole?: string;
  };
  user: {
    id: string;
    email: string;
  };
}

export default function DatabaseDetailClient({
  database,
}: DatabaseDetailClientProps) {
  const router = useRouter();
  const { session } = useSupabaseAuth();
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(
    null
  );
  // Database summary is now part of the schema
  // const [databaseSummary, setDatabaseSummary] = useState<DatabaseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingColumn, setEditingColumn] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);
  const [editingColumnDefinition, setEditingColumnDefinition] = useState("");
  const [editingDatabase, setEditingDatabase] = useState(false);
  const [editingDatabaseSummary, setEditingDatabaseSummary] = useState(false);
  // AI definitions are now generated during connection setup - no upgrade needed
  // const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  // const [isUpgrading, setIsUpgrading] = useState(false);
  // const [isRegeneratingAI, setIsRegeneratingAI] = useState(false); // No longer needed
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<
    "info" | "success" | "error" | "warning"
  >("info");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTableDeleteConfirm, setShowTableDeleteConfirm] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string>("");
  const [isDeletingTable, setIsDeletingTable] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState<string>("");

  // Local state for editing database details
  const [editingDatabaseData, setEditingDatabaseData] =
    useState<DatabaseConnection | null>(null);

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

  /**
   * Step 13: Frontend display - Fetch column details for tables that don't have them
   * This ensures all selected tables have their column information loaded for display
   */
  const fetchColumnDetails = useCallback(
    async (schema: DatabaseSchema) => {
      try {
        if (!session?.access_token || !database?.id) {
          return;
        }

        const tableNames: string[] = [];

        // Collect table names that need column details
        if (schema.tables) {
          for (const table of schema.tables) {
            if (!table.columns || table.columns.length === 0) {
              tableNames.push(table.name);
            }
          }
        }

        if (schema.views) {
          for (const view of schema.views) {
            if (!view.columns || view.columns.length === 0) {
              tableNames.push(view.name);
            }
          }
        }

        if (tableNames.length === 0) {
          return;
        }

        const response = await fetch(
          `/api/database-connections/${database.id}/fetch-columns`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              tableNames,
            }),
          }
        );

        if (response.ok) {
          // Refresh the schema to get updated column details
          const refreshResponse = await fetch(
            `/api/database-connections/${database.id}/schema`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          if (refreshResponse.ok) {
            const refreshResult = await refreshResponse.json();
            if (refreshResult.schema) {
              setDatabaseSchema(refreshResult.schema);
            }
          }
        } else {
          console.error("Failed to fetch column details");
        }
      } catch (error) {
        console.error("Error fetching column details:", error);
      }
    },
    [database?.id, session?.access_token]
  );

  // Fetch database schema
  const fetchDatabaseSchema = useCallback(async () => {
    try {
      if (!session?.access_token || !database?.id) {
        return;
      }

      const response = await fetch(
        `/api/database-connections/${database.id}/schema`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.schema) {
        setDatabaseSchema(result.schema);

        // If no tables are found, try fetching all tables
        if (
          (result.schema.tables?.length || 0) === 0 &&
          (result.schema.views?.length || 0) === 0
        ) {
          try {
            const allTablesResponse = await fetch(
              `/api/database-connections/${database.id}/schema?showAll=true`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );

            if (allTablesResponse.ok) {
              const allTablesResult = await allTablesResponse.json();
              if (
                allTablesResult.schema &&
                (allTablesResult.schema.tables?.length || 0) > 0
              ) {
                setDatabaseSchema(allTablesResult.schema);
              }
            }
          } catch (error) {
            console.error("Error fetching all tables:", error);
          }
        }

        // Check if we need to fetch column details
        const needsColumnDetails =
          result.schema.tables?.some(
            (table: DatabaseTable) => table.columns?.length === 0
          ) ||
          result.schema.views?.some(
            (view: DatabaseTable) => view.columns?.length === 0
          );

        if (needsColumnDetails) {
          await fetchColumnDetails(result.schema);
        }
      }
      // Database summary is now part of the schema
    } catch (error) {
      console.error("Error fetching database schema:", error);
      toast.error("Failed to load database schema");
    }
  }, [database?.id, session?.access_token, fetchColumnDetails]);

  // Check AI status for existing connections
  // AI definitions are now generated during connection setup - no status check needed

  // AI definitions are now generated during connection setup - no upgrade needed

  // Update column definition
  const updateColumnDefinition = useCallback(
    async (tableName: string, columnName: string, newDefinition: string) => {
      if (!session?.access_token || !database?.id) {
        return;
      }

      try {
        const response = await fetch(
          `/api/database-connections/${database.id}/update-column-definition`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              tableName,
              columnName,
              definition: newDefinition,
            }),
          }
        );

        if (response.ok) {
          toast.success("Column definition updated successfully!");
          await fetchDatabaseSchema();
        } else {
          const error = await response.json();
          toast.error(`Failed to update definition: ${error.error}`);
        }
      } catch (error) {
        console.error("Error updating column definition:", error);
        toast.error("Failed to update column definition");
      }
    },
    [database?.id, session?.access_token, fetchDatabaseSchema]
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!session?.access_token) {
        return;
      }

      setIsLoading(true);
      await fetchDatabaseSchema();
      setIsLoading(false);
    };

    loadData();
  }, [session?.access_token, fetchDatabaseSchema]);

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDatabaseIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "postgresql":
        return "PG";
      case "mysql":
        return "MY";
      case "bigquery":
        return "BQ";
      default:
        return "DB";
    }
  };

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleEditColumn = (tableName: string, columnName: string) => {
    // Find the current column definition
    let currentDefinition = "";

    // Check in tables
    const table = databaseSchema?.tables?.find((t) => t.name === tableName);
    if (table) {
      const column = table.columns?.find((c) => c.name === columnName);
      if (column?.ai_definition) {
        currentDefinition = column.ai_definition.description || "";
      }
    }

    // Check in views if not found in tables
    if (!currentDefinition) {
      const view = databaseSchema?.views?.find((v) => v.name === tableName);
      if (view) {
        const column = view.columns?.find((c) => c.name === columnName);
        if (column?.ai_definition) {
          currentDefinition = column.ai_definition.description || "";
        }
      }
    }

    setEditingColumn({ tableName, columnName });
    setEditingColumnDefinition(currentDefinition);
  };

  const handleSaveColumnEdit = (newDefinition: string) => {
    if (editingColumn) {
      updateColumnDefinition(
        editingColumn.tableName,
        editingColumn.columnName,
        newDefinition
      );
      setEditingColumn(null);
    }
  };

  const handleDeleteTable = (tableName: string) => {
    setTableToDelete(tableName);
    setShowTableDeleteConfirm(true);
  };

  const confirmDeleteTable = async () => {
    if (!session?.access_token || !database?.id) {
      updateStatus("No session or database available", "error");
      return;
    }

    setIsDeletingTable(true);
    try {
      const response = await fetch(
        `/api/database-connections/${
          database.id
        }/tables?tableName=${encodeURIComponent(tableToDelete)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        updateStatus(
          `Table "${tableToDelete}" deleted successfully!`,
          "success"
        );
        await fetchDatabaseSchema();
      } else {
        const error = await response.json();
        updateStatus(`Failed to delete table: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      updateStatus("Failed to delete table", "error");
    } finally {
      setIsDeletingTable(false);
    }
  };

  const handleAddTable = () => {
    setNewTableName("");
    setShowAddTableModal(true);
  };

  const confirmAddTable = async () => {
    if (!newTableName.trim()) return;

    if (!session?.access_token || !database?.id) {
      toast.error("No session or database available");
      return;
    }

    try {
      // Step 1: Add the table to the schema
      const response = await fetch(
        `/api/database-connections/${database.id}/tables`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tableName: newTableName,
            tableType: "table",
          }),
        }
      );

      if (response.ok) {
        toast.success(`Table "${newTableName}" added successfully!`);

        // Step 2: Fetch column details with sample data
        toast.info("Fetching column details and sample data...");
        try {
          const columnsResponse = await fetch(
            `/api/database-connections/${database.id}/fetch-columns`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                tableNames: [newTableName],
              }),
            }
          );

          const columnsResult = await columnsResponse.json();
          if (columnsResult.success) {
            toast.success("Column details fetched successfully!");

            // Step 3: Generate AI definitions for the new table
            toast.info("Generating AI definitions for the new table...");
            try {
              const aiResponse = await fetch(
                `/api/database-connections/${database.id}/generate-ai-definitions`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );

              const aiResult = await aiResponse.json();
              if (aiResult.success) {
                toast.success("AI definitions generated successfully!");

                // Step 4: Regenerate database summary
                toast.info("Updating database summary...");
                try {
                  const summaryResponse = await fetch(
                    `/api/database-connections/${database.id}/generate-summary`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        schema: databaseSchema,
                      }),
                    }
                  );

                  const summaryResult = await summaryResponse.json();
                  if (summaryResult.success) {
                    toast.success("Database summary updated successfully!");
                  } else {
                    toast.warning(
                      "AI definitions generated but summary update failed"
                    );
                  }
                } catch (summaryError) {
                  console.error("Database summary update error:", summaryError);
                  toast.warning(
                    "AI definitions generated but summary update failed"
                  );
                }
              } else {
                toast.warning(
                  "Column details fetched but AI definitions generation failed"
                );
              }
            } catch (aiError) {
              console.error("AI definitions generation error:", aiError);
              toast.warning(
                "Column details fetched but AI definitions generation failed"
              );
            }
          } else {
            toast.warning("Table added but column details fetching failed");
          }
        } catch (columnsError) {
          console.error("Column details fetching error:", columnsError);
          toast.warning("Table added but column details fetching failed");
        }

        // Refresh the schema to show the new table
        await fetchDatabaseSchema();
      } else {
        const error = await response.json();
        toast.error(`Failed to add table: ${error.error}`);
      }
    } catch (error) {
      console.error("Error adding table:", error);
      toast.error("Failed to add table");
    }
  };

  const handleEditDatabase = () => {
    setEditingDatabaseData(database);
    setEditingDatabase(true);
  };

  const handleSaveDatabaseEdit = async () => {
    if (!session?.access_token || !database?.id) {
      toast.error("No session or database available");
      return;
    }

    try {
      const response = await fetch(`/api/database-connections/${database.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editingDatabaseData?.name,
          host: editingDatabaseData?.host,
          port: editingDatabaseData?.port,
          database: editingDatabaseData?.database,
          username: editingDatabaseData?.username,
          schema_name: editingDatabaseData?.schema_name,
        }),
      });

      if (response.ok) {
        toast.success("Database updated successfully!");
        setEditingDatabase(false);
      } else {
        const error = await response.json();
        toast.error(`Failed to update database: ${error.error}`);
      }
    } catch (error) {
      console.error("Error updating database:", error);
      toast.error("Failed to update database");
    }
  };

  const handleSaveDatabaseSummary = async (newDescription: string) => {
    if (
      !session?.access_token ||
      !database?.id ||
      !databaseSchema?.ai_definition
    ) {
      toast.error("No session, database, or AI definition available");
      return;
    }

    try {
      // Update the database AI definition in the schema
      const updatedSchema = {
        ...databaseSchema,
        ai_definition: {
          ...databaseSchema.ai_definition,
          description: newDescription,
        },
      };

      const response = await fetch(
        `/api/database-connections/${database.id}/update-schema`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            schema: updatedSchema,
          }),
        }
      );

      if (response.ok) {
        toast.success("Database AI definition updated successfully!");
        setEditingDatabaseSummary(false);
        setDatabaseSchema(updatedSchema);
      } else {
        const error = await response.json();
        toast.error(`Failed to update AI definition: ${error.error}`);
      }
    } catch (error) {
      console.error("Error updating database AI definition:", error);
      toast.error("Failed to update database AI definition");
    }
  };

  const handleSaveColumnDefinition = async () => {
    if (!editingColumn || !session?.access_token || !database?.id) {
      toast.error("No session or database available");
      return;
    }

    try {
      const response = await fetch(
        `/api/database-connections/${database.id}/update-column-definition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tableName: editingColumn.tableName,
            columnName: editingColumn.columnName,
            definition: editingColumnDefinition,
          }),
        }
      );

      if (response.ok) {
        toast.success("Column definition updated successfully!");
        setEditingColumn(null);
        setEditingColumnDefinition("");
        // Refresh the schema
        await fetchDatabaseSchema();
      } else {
        const error = await response.json();
        toast.error(`Failed to update column definition: ${error.error}`);
      }
    } catch (error) {
      console.error("Error updating column definition:", error);
      toast.error("Failed to update column definition");
    }
  };

  const handleDeleteDatabase = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteDatabase = async () => {
    if (!session?.access_token || !database?.id) {
      updateStatus("No session or database available", "error");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/database-connections/${database.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        updateStatus("Database deleted successfully!", "success");
        setTimeout(() => {
          router.push(
            `/workspaces/${database.workspace_id || "unknown"}?refresh=true`
          );
        }, 1000);
      } else {
        const error = await response.json();
        updateStatus(`Failed to delete database: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Error deleting database:", error);
      updateStatus("Failed to delete database", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // AI definitions are now generated during connection setup - no regeneration needed

  if (isLoading || !database) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading database details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() =>
                  router.push(`/workspaces/${database.workspace_id}`)
                }
                className="text-gray-400 hover:text-white transition-colors"
                title="Go to Workspace"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {getDatabaseIcon(database.type)}
                </span>
                <div>
                  <h1 className="text-xl font-semibold text-white">
                    {database.name}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {database.type.toUpperCase()} Database
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                Last synced:{" "}
                {database.last_schema_sync
                  ? formatDate(database.last_schema_sync)
                  : "Never"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Database Information - Compact */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Database Information
              </h2>
              <div className="flex items-center space-x-2">
                {/* AI definitions are now generated during connection setup */}
                <button
                  onClick={() => {
                    /* TODO: Implement database sharing */
                  }}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  Share
                </button>
                <button
                  onClick={handleEditDatabase}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteDatabase}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="text-gray-400">Host</label>
                <p className="text-white font-mono">
                  {database.host}:{database.port}
                </p>
              </div>
              <div>
                <label className="text-gray-400">Database</label>
                <p className="text-white font-mono">{database.database}</p>
              </div>
              <div>
                <label className="text-gray-400">Username</label>
                <p className="text-white font-mono">{database.username}</p>
              </div>
              <div>
                <label className="text-gray-400">Schema</label>
                <p className="text-white font-mono">{database.schema_name}</p>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-700 ${
                statusType === "success"
                  ? "bg-green-900/20 border-green-700"
                  : statusType === "error"
                  ? "bg-red-900/20 border-red-700"
                  : statusType === "warning"
                  ? "bg-yellow-900/20 border-yellow-700"
                  : "bg-blue-900/20 border-blue-700"
              }`}
            >
              <div className="max-w-7xl mx-auto">
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
            </div>
          )}

          {/* AI Summary Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Smart Database Summary
              </h2>
              <div className="flex items-center space-x-2">
                {databaseSchema?.ai_definition && (
                  <button
                    onClick={() => setEditingDatabaseSummary(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Edit Summary
                  </button>
                )}
              </div>
            </div>

            {databaseSchema?.ai_definition ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Description
                  </h3>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {databaseSchema.ai_definition.description}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Business Purpose
                  </h3>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {databaseSchema.ai_definition.business_purpose}
                  </p>
                </div>
                {databaseSchema.ai_definition.key_entities &&
                  databaseSchema.ai_definition.key_entities.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        Key Entities
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {databaseSchema.ai_definition.key_entities.map(
                          (entity, index) => (
                            <li key={index} className="text-gray-200 text-sm">
                              {entity}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                {databaseSchema.ai_definition.common_use_cases &&
                  databaseSchema.ai_definition.common_use_cases.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        Common Use Cases
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {databaseSchema.ai_definition.common_use_cases.map(
                          (useCase, index) => (
                            <li key={index} className="text-gray-200 text-sm">
                              {useCase}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Architecture
                  </h3>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {databaseSchema.ai_definition.overall_architecture}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="w-12 h-12 mx-auto mb-2"
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
                  <p className="text-sm">
                    Smart descriptions will be available after connection setup
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Smart descriptions are automatically generated when you
                    connect to a database
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tables Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Database Tables
              </h2>
              <div className="flex space-x-2">
                {databaseSchema &&
                  (databaseSchema.tables?.some(
                    (table) => !table.columns || table.columns.length === 0
                  ) ||
                    databaseSchema.views?.some(
                      (view) => !view.columns || view.columns.length === 0
                    )) && (
                    <button
                      onClick={() => fetchColumnDetails(databaseSchema)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Fetch Column Details
                    </button>
                  )}
                <button
                  onClick={handleAddTable}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  + Add Table
                </button>
              </div>
            </div>

            {(databaseSchema?.tables && databaseSchema.tables.length > 0) ||
            (databaseSchema?.views && databaseSchema.views.length > 0) ? (
              <div className="space-y-4">
                {/* Render tables */}
                {databaseSchema?.tables?.map((table) => (
                  <div
                    key={table.name}
                    className="border border-gray-700 rounded-lg"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                      onClick={() => toggleTableExpansion(table.name)}
                    >
                      <div className="flex items-center space-x-3">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            expandedTables.has(table.name) ? "rotate-90" : ""
                          }`}
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
                        <div>
                          <h3 className="text-white font-medium">
                            {table.name}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {table.columns?.length || 0} columns
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {table.ai_definition && (
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                            AI Enhanced
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table.name);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {expandedTables.has(table.name) && (
                      <div className="border-t border-gray-700 p-4">
                        {table.ai_definition && (
                          <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">
                              AI Table Summary
                            </h4>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-200">
                                {table.ai_definition.description}
                              </p>
                              <p className="text-sm text-gray-300">
                                <span className="font-medium">Purpose:</span>{" "}
                                {table.ai_definition.business_purpose}
                              </p>
                              {table.ai_definition.key_entities &&
                                table.ai_definition.key_entities.length > 0 && (
                                  <div>
                                    <span className="text-sm font-medium text-gray-300">
                                      Key Entities:
                                    </span>
                                    <ul className="list-disc list-inside text-sm text-gray-300 ml-2">
                                      {table.ai_definition.key_entities.map(
                                        (entity, index) => (
                                          <li key={index}>{entity}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                              {table.ai_definition.common_use_cases &&
                                table.ai_definition.common_use_cases.length >
                                  0 && (
                                  <div>
                                    <span className="text-sm font-medium text-gray-300">
                                      Common Use Cases:
                                    </span>
                                    <ul className="list-disc list-inside text-sm text-gray-300 ml-2">
                                      {table.ai_definition.common_use_cases.map(
                                        (useCase, index) => (
                                          <li key={index}>{useCase}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {table.columns && table.columns.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-600">
                                  <th className="text-left py-2 text-gray-300">
                                    Column Name
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Column Type
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Foreign Key
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Sample Values
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Description
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {table.columns.map((column) => (
                                  <tr
                                    key={column.name}
                                    className="border-b border-gray-700/50"
                                  >
                                    <td className="py-2">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-white font-mono">
                                          {column.name}
                                        </span>
                                        {column.is_primary_key && (
                                          <span className="px-1 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded">
                                            PK
                                          </span>
                                        )}
                                        {column.is_foreign_key && (
                                          <span className="px-1 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded">
                                            FK
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 text-gray-300 font-mono">
                                      {column.type}
                                    </td>
                                    <td className="py-2 text-gray-300">
                                      <div className="space-y-1">
                                        {column.nullable === false && (
                                          <span className="px-1 py-0.5 bg-red-600/20 text-red-400 text-xs rounded">
                                            NOT NULL
                                          </span>
                                        )}
                                        {column.foreign_table &&
                                          column.foreign_column && (
                                            <div className="text-xs text-gray-400">
                                              → {column.foreign_table}.
                                              {column.foreign_column}
                                            </div>
                                          )}
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      <div className="text-xs text-gray-300">
                                        {column.sample_values &&
                                        column.sample_values.length > 0 ? (
                                          <div
                                            className="truncate max-w-xs"
                                            title={column.sample_values.join(
                                              ", "
                                            )}
                                          >
                                            {column.sample_values
                                              .slice(0, 3)
                                              .join(", ")}
                                            {column.sample_values.length >
                                              3 && (
                                              <span className="text-gray-400 ml-1">
                                                (+
                                                {column.sample_values.length -
                                                  3}{" "}
                                                more)
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500 italic">
                                            No sample data
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      {editingColumn?.tableName ===
                                        table.name &&
                                      editingColumn?.columnName ===
                                        column.name ? (
                                        <div className="space-y-2">
                                          <textarea
                                            defaultValue={
                                              column.ai_definition
                                                ?.description || ""
                                            }
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                            rows={2}
                                            placeholder="Enter column description..."
                                          />
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() => {
                                                const textarea =
                                                  document.querySelector(
                                                    "textarea"
                                                  ) as HTMLTextAreaElement;
                                                handleSaveColumnEdit(
                                                  textarea.value
                                                );
                                              }}
                                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() =>
                                                setEditingColumn(null)
                                              }
                                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          {column.ai_definition ? (
                                            <div className="space-y-1">
                                              <p className="text-gray-200 text-sm">
                                                {
                                                  column.ai_definition
                                                    .description
                                                }
                                              </p>
                                              <p className="text-gray-300 text-xs">
                                                <span className="font-medium">
                                                  Purpose:
                                                </span>{" "}
                                                {
                                                  column.ai_definition
                                                    .business_purpose
                                                }
                                              </p>
                                              {column.ai_definition
                                                .data_insights &&
                                                column.ai_definition
                                                  .data_insights.length > 0 && (
                                                  <div className="text-xs text-gray-300">
                                                    <span className="font-medium">
                                                      Insights:
                                                    </span>{" "}
                                                    {column.ai_definition.data_insights
                                                      .slice(0, 2)
                                                      .join(", ")}
                                                    {column.ai_definition
                                                      .data_insights.length >
                                                      2 && "..."}
                                                  </div>
                                                )}
                                            </div>
                                          ) : (
                                            <p className="text-gray-500 text-sm italic">
                                              No description
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2">
                                      <button
                                        onClick={() =>
                                          handleEditColumn(
                                            table.name,
                                            column.name
                                          )
                                        }
                                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                                      >
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-gray-400 text-sm mb-3">
                              No columns found
                            </p>
                            <button
                              onClick={() => fetchColumnDetails(databaseSchema)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                            >
                              Fetch Column Details
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Render views */}
                {databaseSchema?.views?.map((view) => (
                  <div
                    key={view.name}
                    className="border border-gray-700 rounded-lg"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                      onClick={() => toggleTableExpansion(view.name)}
                    >
                      <div className="flex items-center space-x-3">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            expandedTables.has(view.name) ? "rotate-90" : ""
                          }`}
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
                        <div>
                          <h3 className="text-white font-medium">
                            {view.name}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {view.columns?.length || 0} columns (View)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {view.ai_definition && (
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                            AI Enhanced
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(view.name);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {expandedTables.has(view.name) && (
                      <div className="border-t border-gray-700 p-4">
                        {view.ai_definition && (
                          <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                            <h4 className="text-sm font-medium text-white mb-2">
                              Description
                            </h4>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-300">
                                {view.ai_definition.description}
                              </p>
                              <p className="text-sm text-gray-300">
                                <span className="font-medium">Purpose:</span>{" "}
                                {view.ai_definition.business_purpose}
                              </p>
                              {view.ai_definition.key_entities &&
                                view.ai_definition.key_entities.length > 0 && (
                                  <div>
                                    <span className="text-sm font-medium text-gray-300">
                                      Key Entities:
                                    </span>
                                    <ul className="list-disc list-inside text-sm text-gray-300 ml-2">
                                      {view.ai_definition.key_entities.map(
                                        (entity, index) => (
                                          <li key={index}>{entity}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {view.columns && view.columns.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-600">
                                  <th className="text-left py-2 text-gray-300">
                                    Column Name
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Column Type
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Foreign Key
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Sample Values
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Description
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {view.columns.map((column) => (
                                  <tr
                                    key={column.name}
                                    className="border-b border-gray-700/50"
                                  >
                                    <td className="py-2">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-white font-mono">
                                          {column.name}
                                        </span>
                                        {column.is_primary_key && (
                                          <span className="px-1 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded">
                                            PK
                                          </span>
                                        )}
                                        {column.is_foreign_key && (
                                          <span className="px-1 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded">
                                            FK
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 text-gray-300 font-mono">
                                      {column.type}
                                    </td>
                                    <td className="py-2 text-gray-300">
                                      <div className="space-y-1">
                                        {column.nullable === false && (
                                          <span className="px-1 py-0.5 bg-red-600/20 text-red-400 text-xs rounded">
                                            NOT NULL
                                          </span>
                                        )}
                                        {column.default_value && (
                                          <div className="text-xs text-gray-400">
                                            Default: {column.default_value}
                                          </div>
                                        )}
                                        {column.foreign_table &&
                                          column.foreign_column && (
                                            <div className="text-xs text-gray-400">
                                              → {column.foreign_table}.
                                              {column.foreign_column}
                                            </div>
                                          )}
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      <div className="text-xs text-gray-300">
                                        {column.sample_values &&
                                        column.sample_values.length > 0 ? (
                                          <div
                                            className="truncate max-w-xs"
                                            title={column.sample_values.join(
                                              ", "
                                            )}
                                          >
                                            {column.sample_values
                                              .slice(0, 3)
                                              .join(", ")}
                                            {column.sample_values.length >
                                              3 && (
                                              <span className="text-gray-400 ml-1">
                                                (+
                                                {column.sample_values.length -
                                                  3}{" "}
                                                more)
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500 italic">
                                            No sample data
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      {column.ai_definition ? (
                                        <div className="max-w-xs space-y-1">
                                          <p className="text-sm text-gray-300 line-clamp-2">
                                            {column.ai_definition.description}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            <span className="font-medium">
                                              Purpose:
                                            </span>{" "}
                                            {
                                              column.ai_definition
                                                .business_purpose
                                            }
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="text-gray-500 text-xs">
                                          No description
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2">
                                      <button
                                        onClick={() =>
                                          handleEditColumn(
                                            view.name,
                                            column.name
                                          )
                                        }
                                        className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded hover:bg-blue-600/30 transition-colors"
                                      >
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-gray-400 text-sm mb-3">
                              No columns found for this view
                            </p>
                            <button
                              onClick={() => fetchColumnDetails(databaseSchema)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                            >
                              Fetch Column Details
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="w-12 h-12 mx-auto mb-2"
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
                  <p className="text-sm">No tables found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add tables to see their structure and descriptions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Database Modal */}
      {editingDatabase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit Database
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editingDatabaseData?.name || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Host</label>
                <input
                  type="text"
                  value={editingDatabaseData?.host || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      host: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Port</label>
                <input
                  type="number"
                  value={editingDatabaseData?.port || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      port: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Database
                </label>
                <input
                  type="text"
                  value={editingDatabaseData?.database || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      database: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editingDatabaseData?.username || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      username: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Schema Name
                </label>
                <input
                  type="text"
                  value={editingDatabaseData?.schema_name || ""}
                  onChange={(e) =>
                    setEditingDatabaseData({
                      ...editingDatabaseData!,
                      schema_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditingDatabase(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDatabaseEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Database Summary Modal */}
      {editingDatabaseSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit Database Summary
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">
                Summary
              </label>
              <textarea
                value={databaseSchema?.ai_definition?.description || ""}
                onChange={(e) => {
                  if (databaseSchema?.ai_definition) {
                    setDatabaseSchema({
                      ...databaseSchema,
                      ai_definition: {
                        ...databaseSchema.ai_definition,
                        description: e.target.value,
                      },
                    });
                  }
                }}
                rows={8}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter database summary..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingDatabaseSummary(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleSaveDatabaseSummary(
                    databaseSchema?.ai_definition?.description || ""
                  )
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Column Description Modal */}
      {editingColumn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit Column Description: {editingColumn.columnName}
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={editingColumnDefinition}
                onChange={(e) => setEditingColumnDefinition(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter column description..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setEditingColumn(null);
                  setEditingColumnDefinition("");
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveColumnDefinition}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteDatabase}
        title="Delete Database"
        message={`Are you sure you want to delete database "${database?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />

      <ConfirmationModal
        isOpen={showTableDeleteConfirm}
        onClose={() => setShowTableDeleteConfirm(false)}
        onConfirm={confirmDeleteTable}
        title="Delete Table"
        message={`Are you sure you want to delete table "${tableToDelete}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeletingTable}
      />

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                Add New Table
              </h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Table Name
              </label>
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Enter table name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTableName.trim()) {
                    confirmAddTable();
                  } else if (e.key === "Escape") {
                    setShowAddTableModal(false);
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowAddTableModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddTable}
                disabled={!newTableName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
