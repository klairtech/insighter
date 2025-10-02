"use client";

import React from "react";

interface StreamingProgressProps {
  isStreaming: boolean;
  overallProgress: number;
  currentMessage: string;
  agentStatuses: Record<
    string,
    { status: string; progress: number; message: string }
  >;
}

export default function StreamingProgress({
  isStreaming,
  overallProgress,
  currentMessage,
  agentStatuses,
}: StreamingProgressProps) {
  if (!isStreaming) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return "🔄";
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "⏳";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Processing Query</h3>
        <span className="text-sm text-gray-500">{overallProgress}%</span>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Current Message */}
      {currentMessage && (
        <p className="text-sm text-gray-600 mb-3">{currentMessage}</p>
      )}

      {/* Agent Statuses */}
      <div className="space-y-2">
        {Object.entries(agentStatuses).map(([agentName, status]) => (
          <div
            key={agentName}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center space-x-2">
              <span>{getStatusIcon(status.status)}</span>
              <span className="font-medium text-gray-700">{agentName}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`${getStatusColor(status.status)}`}>
                {status.message}
              </span>
              {status.status === "running" && (
                <span className="text-gray-500">{status.progress}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Animated dots for active processing */}
      {isStreaming && (
        <div className="flex items-center justify-center mt-3">
          <div className="flex space-x-1">
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
