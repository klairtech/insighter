"use client";

import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface DataSourceConfig {
  id: string;
  source_id: string;
  name: string;
  category: string;
  is_enabled: boolean;
  is_beta: boolean;
  sort_order: number;
  release_notes?: string;
}

export default function DataSourceAdminPage() {
  const { session } = useSupabaseAuth();
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/data-sources/config");
      if (!response.ok) {
        throw new Error("Failed to fetch data sources");
      }

      const data = await response.json();
      setDataSources(data.dataSources);
    } catch (err) {
      console.error("Error fetching data sources:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const updateDataSource = async (
    sourceId: string,
    updates: Partial<DataSourceConfig>
  ) => {
    try {
      setUpdating(sourceId);

      const response = await fetch("/api/data-sources/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceId,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update data source");
      }

      // Refresh the list
      await fetchDataSources();
    } catch (err) {
      console.error("Error updating data source:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdating(null);
    }
  };

  const toggleEnabled = (source: DataSourceConfig) => {
    updateDataSource(source.source_id, { is_enabled: !source.is_enabled });
  };

  const toggleBeta = (source: DataSourceConfig) => {
    updateDataSource(source.source_id, { is_beta: !source.is_beta });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Please log in to access this page.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Loading data sources...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Data Source Configuration</h1>
          <p className="text-gray-400">
            Manage which data sources are enabled in the frontend. Enable them
            one by one as you test.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 mb-6">
            <div className="text-red-400">Error: {error}</div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Data Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Enabled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Beta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Sort Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {dataSources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {source.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {source.source_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {source.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          source.is_enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {source.is_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          source.is_beta
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {source.is_beta ? "Beta" : "Stable"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {source.sort_order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleEnabled(source)}
                          disabled={updating === source.source_id}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            source.is_enabled
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          } ${
                            updating === source.source_id
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {updating === source.source_id
                            ? "Updating..."
                            : source.is_enabled
                            ? "Disable"
                            : "Enable"}
                        </button>
                        <button
                          onClick={() => toggleBeta(source)}
                          disabled={updating === source.source_id}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            source.is_beta
                              ? "bg-gray-600 hover:bg-gray-700 text-white"
                              : "bg-orange-600 hover:bg-orange-700 text-white"
                          } ${
                            updating === source.source_id
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {source.is_beta ? "Remove Beta" : "Mark Beta"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
          <h3 className="text-lg font-medium text-blue-400 mb-2">How to Use</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>
              • <strong>Enable/Disable:</strong> Control which data sources
              appear in the frontend
            </li>
            <li>
              • <strong>Beta:</strong> Mark data sources as beta to show a beta
              badge
            </li>
            <li>
              • <strong>Sort Order:</strong> Controls the order in which data
              sources appear
            </li>
            <li>
              • <strong>Gradual Rollout:</strong> Enable one data source at a
              time for testing
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
