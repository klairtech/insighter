"use client";

import { useState } from "react";

interface SQLQueryDisplayProps {
  sqlQuery?: string | Record<string, unknown>;
  className?: string;
  metadata?: Record<string, unknown>;
}

export default function SQLQueryDisplay({
  sqlQuery,
  className = "",
  metadata,
}: SQLQueryDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle different formats of SQL query
  let queryText = "";
  let queryType = "";
  let confidenceScore = "";
  let rowsAffected = "";

  // First, try to get SQL query from the sql_queries field (array format)
  if (metadata && metadata.sql_queries) {
    if (
      Array.isArray(metadata.sql_queries) &&
      metadata.sql_queries.length > 0
    ) {
      // Handle array of SQL query strings
      queryText = metadata.sql_queries[0] as string;
      queryType = "SELECT"; // Default type for array format
    } else if (typeof metadata.sql_queries === "object") {
      const sqlQueries = metadata.sql_queries as Record<string, unknown>;
      if (
        sqlQueries.queries &&
        Array.isArray(sqlQueries.queries) &&
        sqlQueries.queries.length > 0
      ) {
        // Use the first query from the complex format
        const firstQuery = sqlQueries.queries[0];
        queryText = firstQuery.query_text || firstQuery.query || "";
        queryType = firstQuery.query_type || "SELECT";
        rowsAffected = firstQuery.rows_affected
          ? `${firstQuery.rows_affected} rows`
          : "";
      }
    }
  }

  // If no query found in sql_queries, try the direct sqlQuery prop
  if (!queryText && sqlQuery) {
    if (typeof sqlQuery === "string") {
      queryText = sqlQuery;
    } else if (sqlQuery && typeof sqlQuery === "object") {
      // Handle object format - look for common query fields
      if ("query" in sqlQuery && typeof sqlQuery.query === "string") {
        queryText = sqlQuery.query;
      } else if (
        "query_text" in sqlQuery &&
        typeof sqlQuery.query_text === "string"
      ) {
        queryText = sqlQuery.query_text;
      } else if ("sql" in sqlQuery && typeof sqlQuery.sql === "string") {
        queryText = sqlQuery.sql;
      }

      // Extract additional metadata
      if ("query_type" in sqlQuery && typeof sqlQuery.query_type === "string") {
        queryType = sqlQuery.query_type;
      }
      if ("rows_affected" in sqlQuery) {
        rowsAffected = `${sqlQuery.rows_affected} rows`;
      }
    }
  }

  // Extract metadata from message metadata
  if (metadata) {
    if (
      metadata.confidence_score &&
      typeof metadata.confidence_score === "number"
    ) {
      confidenceScore = `${(metadata.confidence_score * 100).toFixed(
        1
      )}% confidence`;
    }
  }

  // Don't render if no valid query found
  if (!queryText || queryText.trim() === "") {
    return null;
  }

  return (
    <div className={`${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-xs text-gray-400 hover:text-gray-300 transition-colors group"
      >
        <svg
          className={`w-3 h-3 transition-transform ${
            isExpanded ? "rotate-90" : ""
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
        <span className="font-medium">
          {isExpanded ? "Hide SQL" : "View SQL"}
        </span>
        <div className="flex items-center space-x-1">
          {queryType && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
              {queryType}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-600/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-xs font-medium text-gray-300">
                SQL Query
              </span>
              {confidenceScore && (
                <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                  {confidenceScore}
                </span>
              )}
              {rowsAffected && (
                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full">
                  {rowsAffected}
                </span>
              )}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(queryText)}
              className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-500/10"
              title="Copy to clipboard"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <div className="relative">
            <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed bg-gray-900/50 p-3 rounded border border-gray-700/50">
              {queryText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
