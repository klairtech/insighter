"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
}

interface DatabaseSchema {
  tables?: Array<{
    name: string;
    columns?: Array<{
      name: string;
      type: string;
      is_nullable?: boolean;
      is_primary_key?: boolean;
      is_foreign_key?: boolean;
      foreign_key_info?: {
        referenced_table: string;
        referenced_column: string;
      };
      ai_definition?: string;
      sample_values?: string[];
    }>;
    ai_definition?: string;
  }>;
  views?: Array<{
    name: string;
    columns?: Array<{
      name: string;
      type: string;
      is_nullable?: boolean;
      ai_definition?: string;
      sample_values?: string[];
    }>;
    ai_definition?: string;
  }>;
}

interface DatabaseSummary {
  id: string;
  summary: string;
  key_points: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface AIStatus {
  has_ai_definitions: boolean;
  has_database_summary: boolean;
  needs_upgrade: boolean;
  upgrade_available: boolean;
  selected_tables_count: number;
  total_columns_count: number;
}

interface DatabaseDetailClientProps {
  database: DatabaseConnection;
  initialWorkspace: { id: string; name: string; organization_id: string };
  user: { id: string; email: string; role: string };
}

export default function DatabaseDetailClient({
  database,
}: DatabaseDetailClientProps) {
  const router = useRouter();
  const { session } = useSupabaseAuth();
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(
    null
  );
  const [databaseSummary, setDatabaseSummary] =
    useState<DatabaseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingColumn, setEditingColumn] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showTableDeleteConfirm, setShowTableDeleteConfirm] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string>("");

  // Fetch database schema
  const fetchDatabaseSchema = useCallback(async () => {
    try {
      if (!session?.access_token) {
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
      }
      if (result.summary) {
        setDatabaseSummary(result.summary);
      }
    } catch (error) {
      console.error("Error fetching database schema:", error);
      toast.error("Failed to load database schema");
    }
  }, [database.id, session?.access_token]);

  // Check AI status for existing connections
  const checkAIStatus = useCallback(async () => {
    try {
      if (!session?.access_token) {
        return;
      }
      const response = await fetch(
        `/api/database-connections/${database.id}/check-ai-status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setAiStatus(result.ai_status);
      }
    } catch (error) {
      console.error("Error checking AI status:", error);
    }
  }, [database.id, session?.access_token]);

  // Generate AI summary
  const generateAISummary = useCallback(async () => {
    if (!session?.access_token || !databaseSchema) {
      return;
    }

    setIsLoadingSummary(true);
    try {
      const response = await fetch(
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

      if (response.ok) {
        const result = await response.json();
        setDatabaseSummary(result.summary);
        toast.success("Database summary generated successfully!");
        await checkAIStatus();
      } else {
        const error = await response.json();
        toast.error(`Failed to generate summary: ${error.error}`);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate database summary");
    } finally {
      setIsLoadingSummary(false);
    }
  }, [database.id, databaseSchema, session?.access_token, checkAIStatus]);

  // Upgrade existing connection with AI definitions and summary
  const upgradeConnection = useCallback(async () => {
    if (!session?.access_token || !databaseSchema) {
      return;
    }
    setIsUpgrading(true);
    try {
      // Step 1: Generate AI definitions
      toast.info("Generating AI definitions for existing connection...");
      const aiResponse = await fetch(
        `/api/database-connections/${database.id}/generate-ai-definitions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            selectedTables:
              databaseSchema.tables?.map((table) => ({
                table_name: table.name,
                selected_columns: table.columns?.map((col) => col.name) || [],
              })) || [],
          }),
        }
      );

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        toast.success(
          `AI definitions generated for ${aiResult.tables_processed} tables!`
        );

        // Step 2: Generate database summary
        toast.info("Generating database summary...");
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

        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          setDatabaseSummary(summaryResult.summary);
          toast.success("Database summary generated successfully!");

          // Refresh the page data
          await fetchDatabaseSchema();
          await checkAIStatus();
        } else {
          toast.warning(
            "AI definitions generated but summary generation failed"
          );
        }
      } else {
        toast.error("Failed to generate AI definitions");
      }
    } catch (error) {
      console.error("Error upgrading connection:", error);
      toast.error("Failed to upgrade connection");
    } finally {
      setIsUpgrading(false);
    }
  }, [
    database.id,
    databaseSchema,
    session?.access_token,
    fetchDatabaseSchema,
    checkAIStatus,
  ]);

  // Update column definition
  const updateColumnDefinition = useCallback(
    async (tableName: string, columnName: string, newDefinition: string) => {
      if (!session?.access_token) {
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
    [database.id, session?.access_token, fetchDatabaseSchema]
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!session?.access_token) {
        return;
      }

      setIsLoading(true);
      await fetchDatabaseSchema();
      await checkAIStatus();
      setIsLoading(false);
    };

    loadData();
  }, [session?.access_token, checkAIStatus, fetchDatabaseSchema]);

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
    setEditingColumn({ tableName, columnName });
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
    // TODO: Implement delete table functionality
    toast.info("Delete table functionality coming soon!");
  };

  const handleAddTable = () => {
    // TODO: Implement add table functionality
    toast.info("Add table functionality coming soon!");
  };

  if (isLoading) {
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
                onClick={() => router.back()}
                className="text-gray-400 hover:text-white transition-colors"
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
                <button
                  onClick={() => {
                    /* TODO: Implement edit database */
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    /* TODO: Implement delete database */
                  }}
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

          {/* AI Summary Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Smart Database Summary
              </h2>
              <div className="flex items-center space-x-2">
                {databaseSummary && (
                  <span className="text-xs text-gray-400">
                    Generated {formatDate(databaseSummary.created_at)}
                  </span>
                )}
                {!databaseSummary && (
                  <button
                    onClick={generateAISummary}
                    disabled={isLoadingSummary}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoadingSummary ? "Generating..." : "Generate Summary"}
                  </button>
                )}
                {aiStatus?.needs_upgrade && aiStatus?.upgrade_available && (
                  <button
                    onClick={upgradeConnection}
                    disabled={isUpgrading}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUpgrading ? "Upgrading..." : "Upgrade to AI"}
                  </button>
                )}
              </div>
            </div>

            {databaseSummary ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Summary
                  </h3>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {databaseSummary.summary}
                  </p>
                </div>
                {databaseSummary.key_points &&
                  databaseSummary.key_points.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        Key Points
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {databaseSummary.key_points.map((point, index) => (
                          <li key={index} className="text-gray-200 text-sm">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {databaseSummary.tags && databaseSummary.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {databaseSummary.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-700 text-gray-200 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                  <p className="text-sm">No AI summary available</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Generate an AI summary to get insights about your database
                    structure
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
              <button
                onClick={handleAddTable}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                + Add Table
              </button>
            </div>

            {databaseSchema?.tables && databaseSchema.tables.length > 0 ? (
              <div className="space-y-4">
                {databaseSchema.tables.map((table) => (
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
                            <p className="text-sm text-gray-200">
                              {table.ai_definition}
                            </p>
                          </div>
                        )}

                        {table.columns && table.columns.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-600">
                                  <th className="text-left py-2 text-gray-300">
                                    Column
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Type
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    Constraints
                                  </th>
                                  <th className="text-left py-2 text-gray-300">
                                    AI Definition
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
                                        {column.is_nullable === false && (
                                          <span className="px-1 py-0.5 bg-red-600/20 text-red-400 text-xs rounded">
                                            NOT NULL
                                          </span>
                                        )}
                                        {column.foreign_key_info && (
                                          <div className="text-xs text-gray-400">
                                            →{" "}
                                            {
                                              column.foreign_key_info
                                                .referenced_table
                                            }
                                            .
                                            {
                                              column.foreign_key_info
                                                .referenced_column
                                            }
                                          </div>
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
                                              column.ai_definition || ""
                                            }
                                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                            rows={2}
                                            placeholder="Enter AI definition..."
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
                                            <p className="text-gray-200 text-sm">
                                              {column.ai_definition}
                                            </p>
                                          ) : (
                                            <p className="text-gray-500 text-sm italic">
                                              No AI definition
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
                          <p className="text-gray-400 text-sm">
                            No columns found
                          </p>
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
                    Add tables to see their structure and AI definitions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showTableDeleteConfirm}
        onClose={() => setShowTableDeleteConfirm(false)}
        onConfirm={confirmDeleteTable}
        title="Delete Table"
        message={`Are you sure you want to delete table "${tableToDelete}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={false}
      />
    </div>
  );
}
