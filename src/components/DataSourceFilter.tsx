"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Filter, Database, FileText, Globe, Check } from "lucide-react";

interface DataSource {
  id: string;
  name: string;
  type: "database" | "file" | "api" | "external";
  source_id?: string;
  source_name?: string;
  is_active?: boolean;
  last_accessed_at?: string;
}

interface DataSourceFilterProps {
  workspaceId: string;
  selectedSources: string[];
  onSelectionChange: (selectedSources: string[]) => void;
  className?: string;
  userCredits?: number;
  onDataSourcesLoaded?: (dataSources: string[]) => void;
}

export default function DataSourceFilter({
  workspaceId,
  selectedSources,
  onSelectionChange,
  className = "",
  userCredits = 0,
  onDataSourcesLoaded,
}: DataSourceFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data sources for the workspace
  const fetchDataSources = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/data-sources`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setDataSources(data.dataSources || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch data sources"
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  // Notify parent when data sources are loaded
  useEffect(() => {
    if (dataSources.length > 0 && onDataSourcesLoaded) {
      const sourceIds = dataSources.map(source => source.id);
      onDataSourcesLoaded(sourceIds);
    }
  }, [dataSources, onDataSourcesLoaded]);

  const handleSourceToggle = (sourceId: string) => {
    const newSelection = selectedSources.includes(sourceId)
      ? selectedSources.filter((id) => id !== sourceId)
      : [...selectedSources, sourceId];

    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    const allSourceIds = dataSources.map((source) => source.id);
    onSelectionChange(allSourceIds);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "database":
        return <Database className="w-4 h-4" />;
      case "file":
        return <FileText className="w-4 h-4" />;
      case "api":
      case "external":
        return <Globe className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case "database":
        return "text-blue-400 bg-blue-900/20";
      case "file":
        return "text-green-400 bg-green-900/20";
      case "api":
      case "external":
        return "text-purple-400 bg-purple-900/20";
      default:
        return "text-gray-400 bg-gray-900/20";
    }
  };

  const selectedCount = selectedSources.length;
  const totalCount = dataSources.length;
  const hasMinimumCredits = userCredits >= 10;

  return (
    <div className={`relative ${className}`}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={dataSources.length === 0 || !hasMinimumCredits}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors border ${
          dataSources.length === 0 || !hasMinimumCredits
            ? "bg-gray-600 text-gray-400 border-gray-700 cursor-not-allowed"
            : "bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
        }`}
        title={
          !hasMinimumCredits
            ? "Need at least 10 credits to use chat features"
            : dataSources.length === 0
            ? "No data sources available"
            : "Filter data sources"
        }
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm">
          {selectedCount === 0 ? "All Sources" : `${selectedCount} Selected`}
        </span>
        {selectedCount > 0 && (
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20">
            {/* Header */}
            <div className="p-4 border-b border-gray-600">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Filter Data Sources
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Select which data sources to include in your queries
              </p>
            </div>

            {/* Controls */}
            <div className="p-3 border-b border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <span className="text-xs text-gray-400">
                  {selectedCount} of {totalCount} selected
                </span>
              </div>
            </div>

            {/* Credit Restriction Message */}
            {!hasMinimumCredits && (
              <div className="p-4 border-b border-gray-600 bg-yellow-900/20">
                <div className="flex items-center space-x-2 text-yellow-300">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">Credits Required</p>
                    <p className="text-xs text-yellow-400">
                      You need at least 10 credits to use chat features.
                      Current: {userCredits} credits
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Data Sources List */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-xs text-gray-400 mt-2">
                    Loading data sources...
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-red-400">{error}</p>
                  <button
                    onClick={fetchDataSources}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                  >
                    Retry
                  </button>
                </div>
              ) : dataSources.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">No data sources found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Connect databases, upload files, or add external connections
                    to get started
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {dataSources.map((source) => {
                    const isSelected = selectedSources.includes(source.id);
                    return (
                      <div
                        key={source.id}
                        onClick={() => handleSourceToggle(source.id)}
                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-900/30 border border-blue-700"
                            : "hover:bg-gray-700/50"
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-500"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* Icon */}
                        <div
                          className={`p-1.5 rounded ${getSourceTypeColor(
                            source.type
                          )}`}
                        >
                          {getSourceIcon(source.type)}
                        </div>

                        {/* Source Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-white truncate">
                              {source.name}
                            </p>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${getSourceTypeColor(
                                source.type
                              )}`}
                            >
                              {source.type}
                            </span>
                          </div>
                          {source.last_accessed_at && (
                            <p className="text-xs text-gray-400">
                              Last used:{" "}
                              {new Date(
                                source.last_accessed_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {selectedCount === 0
                    ? "All data sources will be used"
                    : `Only ${selectedCount} selected source${
                        selectedCount === 1 ? "" : "s"
                      } will be used`}
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
