"use client";

import React, { useState, useEffect } from "react";

interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  estimatedTime?: number; // in seconds
  actualTime?: number; // in seconds
}

interface DatabaseSetupProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionName: string;
  steps: ProgressStep[];
  overallProgress: number; // 0-100
  estimatedTotalTime: number; // in seconds
  onCancel?: () => void;
}

export default function DatabaseSetupProgressModal({
  isOpen,
  onClose,
  connectionName,
  steps,
  overallProgress,
  estimatedTotalTime,
  onCancel,
}: DatabaseSetupProgressModalProps) {
  console.log("🔍 Progress Modal Props:", {
    isOpen,
    connectionName,
    stepsLength: steps.length,
    overallProgress,
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(estimatedTotalTime);

  // Update elapsed time every second
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Calculate remaining time based on progress
  useEffect(() => {
    if (overallProgress > 0) {
      const totalElapsed = elapsedTime;
      const estimatedRemaining = Math.max(
        0,
        (totalElapsed / overallProgress) * 100 - totalElapsed
      );
      setRemainingTime(Math.round(estimatedRemaining));
    }
  }, [elapsedTime, overallProgress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStepIcon = (status: ProgressStep["status"]) => {
    switch (status) {
      case "completed":
        return (
          <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
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
        );
      case "in_progress":
        return (
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          </div>
        );
      case "error":
        return (
          <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
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
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-6 py-4 border-b border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Setting up Database Connection
              </h2>
              <p className="text-blue-200 text-sm mt-1">{connectionName}</p>
            </div>
            <div className="text-right">
              <div className="text-white text-sm">
                Elapsed: {formatTime(elapsedTime)}
              </div>
              <div className="text-blue-200 text-xs">
                Elapsed for this step: {formatTime(remainingTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">
              Overall Progress
            </span>
            <span className="text-sm text-gray-400">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  step.status === "in_progress"
                    ? "bg-blue-900/20 border-blue-700"
                    : step.status === "completed"
                    ? "bg-green-900/20 border-green-700"
                    : step.status === "error"
                    ? "bg-red-900/20 border-red-700"
                    : "bg-gray-700/20 border-gray-600"
                }`}
              >
                {getStepIcon(step.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">
                      {step.title}
                    </h3>
                    {step.actualTime && (
                      <span className="text-xs text-gray-400">
                        {formatTime(step.actualTime)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    {step.description}
                  </p>
                  {step.status === "in_progress" && step.estimatedTime && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>
                          Estimated time: {formatTime(step.estimatedTime)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full animate-pulse"
                          style={{ width: "60%" }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {steps.filter((s) => s.status === "completed").length} of{" "}
              {steps.length} steps completed
            </div>
            <div className="flex space-x-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onClose}
                disabled={overallProgress < 100}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  overallProgress >= 100
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
              >
                {overallProgress >= 100 ? "Close" : "Processing..."}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
