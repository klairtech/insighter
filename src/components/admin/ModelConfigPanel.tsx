/**
 * Model Configuration Panel
 *
 * Admin interface for managing AI model configurations and cost limits
 */

"use client";

import React, { useState } from "react";
import { useModelConfig } from "@/hooks/useModelConfig";
import { ModelConfig, CostLimits } from "@/lib/model-config";

interface ModelConfigPanelProps {
  className?: string;
}

export function ModelConfigPanel({ className = "" }: ModelConfigPanelProps) {
  const {
    models,
    activeModels: _activeModels,
    usageStats,
    costLimits,
    limitCheck,
    updateModel: _updateModel,
    setModelActive,
    updateCostLimits,
    refreshUsage,
    loading,
    error,
  } = useModelConfig();

  const [selectedTab, setSelectedTab] = useState<"models" | "usage" | "limits">(
    "models"
  );
  const [editingLimits, setEditingLimits] = useState(false);
  const [newLimits, setNewLimits] = useState<Partial<CostLimits>>({});

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleModelToggle = async (modelId: string, isActive: boolean) => {
    await setModelActive(modelId, isActive);
  };

  const handleUpdateLimits = async () => {
    await updateCostLimits(newLimits);
    setEditingLimits(false);
    setNewLimits({});
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const _formatPercentage = (value: number, total: number) =>
    total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Model Configuration
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={refreshUsage}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1">
          {[
            { id: "models", label: "Models", count: models.length },
            { id: "usage", label: "Usage", count: null },
            { id: "limits", label: "Limits", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                selectedTab === tab.id
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {selectedTab === "models" && (
          <div className="space-y-6">
            {/* Embedding Models */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Embedding Models
              </h3>
              <div className="grid gap-4">
                {models
                  .filter((m) => m.type === "embedding")
                  .map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onToggle={handleModelToggle}
                    />
                  ))}
              </div>
            </div>

            {/* Chat Models */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Chat Models
              </h3>
              <div className="grid gap-4">
                {models
                  .filter((m) => m.type === "chat")
                  .map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onToggle={handleModelToggle}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === "usage" && (
          <div className="space-y-6">
            {/* Usage Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800">
                  Total Tokens
                </h4>
                <p className="text-2xl font-bold text-blue-900">
                  {usageStats?.total_tokens.toLocaleString() || "0"}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-green-800">
                  Total Cost
                </h4>
                <p className="text-2xl font-bold text-green-900">
                  {formatCost(usageStats?.total_cost || 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800">
                  Requests
                </h4>
                <p className="text-2xl font-bold text-purple-900">
                  {usageStats?.requests_count || 0}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-orange-800">
                  Avg Tokens/Request
                </h4>
                <p className="text-2xl font-bold text-orange-900">
                  {Math.round(usageStats?.average_tokens_per_request || 0)}
                </p>
              </div>
            </div>

            {/* Usage by Model */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Usage by Model
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Model
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tokens
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(usageStats?.usage_by_model || {}).map(
                      ([modelId, usage]) => (
                        <tr key={modelId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {modelId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {usage.tokens.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCost(usage.cost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {usage.requests}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Limit Warnings */}
            {limitCheck &&
              (limitCheck.warnings.length > 0 ||
                limitCheck.errors.length > 0) && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Limit Status
                  </h3>
                  {limitCheck.errors.map((error, index) => (
                    <div
                      key={index}
                      className="mb-2 p-3 bg-red-50 border border-red-200 rounded"
                    >
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  ))}
                  {limitCheck.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded"
                    >
                      <p className="text-yellow-800 text-sm">{warning}</p>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {selectedTab === "limits" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Cost Limits</h3>
              <button
                onClick={() => setEditingLimits(!editingLimits)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingLimits ? "Cancel" : "Edit Limits"}
              </button>
            </div>

            {editingLimits ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily Limit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        newLimits.daily_limit || costLimits?.daily_limit || ""
                      }
                      onChange={(e) =>
                        setNewLimits((prev) => ({
                          ...prev,
                          daily_limit: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Limit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        newLimits.monthly_limit ||
                        costLimits?.monthly_limit ||
                        ""
                      }
                      onChange={(e) =>
                        setNewLimits((prev) => ({
                          ...prev,
                          monthly_limit: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Per-User Limit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        newLimits.per_user_limit ||
                        costLimits?.per_user_limit ||
                        ""
                      }
                      onChange={(e) =>
                        setNewLimits((prev) => ({
                          ...prev,
                          per_user_limit: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Per-Workspace Limit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        newLimits.per_workspace_limit ||
                        costLimits?.per_workspace_limit ||
                        ""
                      }
                      onChange={(e) =>
                        setNewLimits((prev) => ({
                          ...prev,
                          per_workspace_limit: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleUpdateLimits}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditingLimits(false);
                      setNewLimits({});
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">Daily Limit</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCost(costLimits?.daily_limit || 0)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">Monthly Limit</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCost(costLimits?.monthly_limit || 0)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">Per-User Limit</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCost(costLimits?.per_user_limit || 0)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">
                    Per-Workspace Limit
                  </h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCost(costLimits?.per_workspace_limit || 0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Model Card Component
interface ModelCardProps {
  model: ModelConfig;
  onToggle: (modelId: string, isActive: boolean) => void;
}

function ModelCard({ model, onToggle }: ModelCardProps) {
  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

  return (
    <div
      className={`p-4 border rounded-lg ${
        model.is_active ? "border-blue-200 bg-blue-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="font-medium text-gray-900">{model.name}</h4>
            {model.is_active && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {model.provider} • {model.model}
          </p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <span>Cost: {formatCost(model.cost_per_1k_tokens)}/1K tokens</span>
            <span>Context: {model.context_window.toLocaleString()}</span>
            <span>Max tokens: {model.max_tokens.toLocaleString()}</span>
          </div>
          {model.fallback_model && (
            <p className="text-xs text-gray-500 mt-1">
              Fallback: {model.fallback_model}
            </p>
          )}
        </div>
        <div className="ml-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={model.is_active}
              onChange={(e) => onToggle(model.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
