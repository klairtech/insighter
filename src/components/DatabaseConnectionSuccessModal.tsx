"use client";

import { useEffect, useState } from "react";

interface DatabaseConnectionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionName: string;
  tablesProcessed: number;
  onViewDatabase?: () => void;
}

export default function DatabaseConnectionSuccessModal({
  isOpen,
  onClose,
  connectionName,
  tablesProcessed,
  onViewDatabase,
}: DatabaseConnectionSuccessModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger animation after modal opens
      setTimeout(() => setShowAnimation(true), 100);
    } else {
      setShowAnimation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg
                className={`w-6 h-6 text-white transition-transform duration-500 ${
                  showAnimation ? "scale-110" : "scale-100"
                }`}
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
              <h2 className="text-xl font-semibold text-white">
                Connection Successful!
              </h2>
              <p className="text-sm text-green-100">
                Database connected successfully
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <div
              className={`w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${
                showAnimation ? "scale-110 shadow-lg" : "scale-100"
              }`}
            >
              <svg
                className="w-8 h-8 text-green-600"
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

            <h3 className="text-lg font-semibold text-white mb-2">
              {connectionName} Connected
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Your database has been successfully connected to your workspace
              with AI-powered insights.
            </p>

            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2 text-green-400">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium">
                  {tablesProcessed} table{tablesProcessed !== 1 ? "s" : ""}{" "}
                  processed with AI definitions
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {onViewDatabase && (
                <button
                  onClick={onViewDatabase}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
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
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                  <span>View Database</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Continue to Workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
