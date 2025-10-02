"use client";

import React from "react";

interface StreamingChatToggleProps {
  isStreamingEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function StreamingChatToggle({
  isStreamingEnabled,
  onToggle,
  disabled = false,
}: StreamingChatToggleProps) {
  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">Live Updates</span>
        <span className="text-xs text-gray-500">(Real-time progress)</span>
      </div>

      <button
        onClick={() => onToggle(!isStreamingEnabled)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${isStreamingEnabled ? "bg-blue-600" : "bg-gray-200"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${isStreamingEnabled ? "translate-x-6" : "translate-x-1"}
          `}
        />
      </button>

      <div className="flex items-center space-x-1">
        {isStreamingEnabled ? (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-medium">ON</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-xs text-gray-500">OFF</span>
          </>
        )}
      </div>
    </div>
  );
}
