"use client";

import React from "react";
import { useLoading } from "@/contexts/LoadingContext";
import LoadingButton from "@/components/ui/LoadingButton";

// Example component showing how to use loading states
export default function LoadingExample() {
  const { isLoading, withLoading } = useLoading();

  // Example async function that simulates an API call
  const simulateApiCall = async (delay: number = 2000) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return "API call completed!";
  };

  // Wrap the function with loading state
  const handleApiCall = withLoading("example-api-call", simulateApiCall);

  const handleClick = async () => {
    try {
      const result = await handleApiCall(3000);
      console.log(result);
    } catch (error) {
      console.error("API call failed:", error);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-white">Loading States Example</h2>

      {/* Method 1: Using LoadingButton component */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-300">
          Method 1: LoadingButton Component
        </h3>
        <LoadingButton
          onClick={handleClick}
          loadingKey="example-api-call"
          variant="primary"
          loadingText="Calling API..."
        >
          Call API
        </LoadingButton>
      </div>

      {/* Method 2: Using withLoading wrapper */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-300">
          Method 2: withLoading Wrapper
        </h3>
        <button
          onClick={handleClick}
          disabled={isLoading("example-api-call")}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading("example-api-call") ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" />
              Loading...
            </>
          ) : (
            "Call API (withLoading)"
          )}
        </button>
      </div>

      {/* Method 3: Manual loading state management */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-300">
          Method 3: Manual State Management
        </h3>
        <button
          onClick={async () => {
            // This would be done manually in your component
            console.log("Manual loading state management example");
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Manual Loading (see console)
        </button>
      </div>

      {/* Show current loading state */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">
          Current Loading States:
        </h4>
        <p className="text-sm text-gray-400">
          example-api-call:{" "}
          {isLoading("example-api-call") ? "Loading..." : "Idle"}
        </p>
      </div>
    </div>
  );
}
