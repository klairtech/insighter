"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import * as d3 from "d3";

// Register Chart.js components
Chart.register(...registerables);

// D3.js Visualization Container Component
function D3VisualizationContainer({
  htmlContent,
  altText,
}: {
  htmlContent: string;
  altText: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !htmlContent) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = "";

      // Clean the HTML content to remove only specific unwanted patterns
      let cleanedHtmlContent = htmlContent;

      console.log("🔍 D3VisualizationContainer: Original HTML content:", {
        length: htmlContent.length,
        preview: htmlContent.substring(0, 200),
        startsWithCodeBlock: htmlContent.trim().startsWith("```html"),
        endsWithCodeBlock: htmlContent.trim().endsWith("```"),
      });

      // Only remove markdown code blocks that wrap the entire content
      // Check if the content starts and ends with code blocks
      if (
        cleanedHtmlContent.trim().startsWith("```html") &&
        cleanedHtmlContent.trim().endsWith("```")
      ) {
        // Extract content from markdown code blocks
        cleanedHtmlContent = cleanedHtmlContent
          .replace(/^```html\s*/i, "") // Remove opening ```html
          .replace(/\s*```$/i, "") // Remove closing ```
          .trim();
      }

      // Remove only specific unwanted text patterns that appear outside HTML tags
      cleanedHtmlContent = cleanedHtmlContent
        .replace(/Interactive visualization/gi, "") // Remove unwanted text
        .replace(/Chart visualization/gi, "") // Remove unwanted text
        .replace(/table chart/gi, "") // Remove unwanted text
        .replace(/A bar chart would help compare the[\s\S]*?\./g, "") // Remove reasoning text
        .replace(/Chart title reads as[\s\S]*?\./g, "") // Remove chart title text
        .replace(/Here is a visual representation[\s\S]*?\./g, "") // Remove description text
        .replace(/Data visualization/gi, "") // Remove data visualization text
        .trim();

      // Clean up excessive whitespace but preserve HTML structure
      cleanedHtmlContent = cleanedHtmlContent
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Clean up multiple line breaks
        .trim();

      console.log("🔍 D3VisualizationContainer: Cleaned HTML content:", {
        originalLength: htmlContent.length,
        cleanedLength: cleanedHtmlContent.length,
        preview: cleanedHtmlContent.substring(0, 200),
      });

      // Only proceed if we have meaningful HTML content after cleaning
      if (!cleanedHtmlContent || cleanedHtmlContent.length < 20) {
        console.warn(
          "🔍 D3VisualizationContainer: Insufficient HTML content after cleaning",
          {
            originalLength: htmlContent.length,
            cleanedLength: cleanedHtmlContent.length,
          }
        );
        setError("No valid visualization content available");
        return;
      }

      // Create a new div to hold the D3.js content
      const d3Container = document.createElement("div");
      d3Container.innerHTML = cleanedHtmlContent;
      d3Container.style.width = "100%";
      d3Container.style.height = "100%";
      d3Container.style.overflow = "hidden";
      d3Container.style.display = "flex";
      d3Container.style.alignItems = "center";
      d3Container.style.justifyContent = "center";

      // Make D3.js and Chart.js available globally for the generated code
      (window as any).d3 = d3;
      (window as any).Chart = Chart;

      // Append the content
      containerRef.current.appendChild(d3Container);

      // Force resize of any SVG elements to fit container
      const svgElements = d3Container.querySelectorAll("svg");
      svgElements.forEach((svg) => {
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.style.overflow = "visible";

        // Ensure the SVG viewBox is set properly
        if (!svg.getAttribute("viewBox")) {
          const width = svg.getAttribute("width") || "800";
          const height = svg.getAttribute("height") || "400";
          svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }
      });

      // Also handle any canvas elements
      const canvasElements = d3Container.querySelectorAll("canvas");
      canvasElements.forEach((canvas) => {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.maxWidth = "100%";
        canvas.style.maxHeight = "100%";
      });

      // Execute any script tags in the content with a safer approach
      const scripts = d3Container.querySelectorAll("script");
      scripts.forEach((script, index) => {
        try {
          // Create a unique function wrapper to avoid variable conflicts
          const scriptContent = script.textContent || "";
          if (!scriptContent.trim()) return;

          // Wrap the script in an IIFE to create a new scope
          const wrappedScript = `
            (function() {
              try {
                ${scriptContent}
              } catch (error) {
                console.error('D3.js script error:', error);
              }
            })();
          `;

          const newScript = document.createElement("script");
          newScript.textContent = wrappedScript;
          newScript.type = "text/javascript";
          newScript.id = `d3-script-${Date.now()}-${index}`;
          document.head.appendChild(newScript);

          // Clean up after execution
          setTimeout(() => {
            const scriptElement = document.getElementById(newScript.id);
            if (scriptElement) {
              document.head.removeChild(scriptElement);
            }
          }, 100);
        } catch (scriptError) {
          console.error("❌ Error executing script:", scriptError);
        }
      });

      setIsLoaded(true);
      setError(null);
      console.log("✅ D3.js visualization loaded successfully");
    } catch (err) {
      console.error("❌ D3.js visualization failed to load:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoaded(false);
    }
  }, [htmlContent]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded">
        <div className="text-center text-red-400">
          <div className="text-sm font-medium">Visualization Error</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex items-center justify-center"
      aria-label={altText}
      role="img"
      style={{ minHeight: "200px" }}
    />
  );
}

interface VisualizationDisplayProps {
  graphData?: {
    visualization?: {
      visualization_type?: "interactive" | "static" | "both";
      chart_data?: Record<string, unknown>;
      chart_config?: {
        library?: "d3" | "chartjs" | "plotly" | "observable_plot";
        chart_type?: string;
        interactive_features?: string[];
        animation_config?: Record<string, unknown>;
        color_scheme?: string;
      };
      html_content?: string;
      image_url?: string;
      alt_text?: string;
      screen_reader_description?: string;
    };
    visual_decision?: {
      visualization_required?: boolean;
      chart_type?: string;
      reasoning?: string;
      confidence_score?: number;
    };
    metadata?: {
      visualization_required?: boolean;
      chart_type?: string;
    };
  };
  className?: string;
  title?: string;
}

export default function VisualizationDisplay({
  graphData,
  className = "",
  title = "Data Visualization",
}: VisualizationDisplayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if visualization is available
  const hasVisualization =
    graphData?.visualization &&
    graphData.visual_decision?.visualization_required;

  const visualization = graphData?.visualization;
  const visualDecision = graphData?.visual_decision;

  // Check if we have HTML content to render directly
  const hasHtmlContent =
    visualization?.html_content &&
    !visualization.html_content.includes("Error generating visualization") &&
    !visualization.html_content.includes("No visualization data available") &&
    visualization.html_content.length > 20; // Ensure we have some content

  // Debug logging after variables are declared
  console.log("🔍 VisualizationDisplay: Component rendered with props:", {
    graphData,
    hasGraphData: !!graphData,
    graphDataKeys: graphData ? Object.keys(graphData) : [],
    hasVisualization,
    hasHtmlContent,
    visualization,
    visualDecision,
  });

  // Debug HTML content
  console.log("🔍 VisualizationDisplay: HTML content debug:", {
    hasHtmlContent,
    htmlContentLength: visualization?.html_content?.length,
    htmlContentPreview: visualization?.html_content?.substring(0, 200),
    htmlContentType: typeof visualization?.html_content,
  });

  // Create Chart.js configuration from the data
  const createChartConfig = useCallback((): ChartConfiguration => {
    if (!visualization?.chart_data || !visualization?.chart_data?.labels) {
      throw new Error("No chart data available");
    }

    const { labels, values } = visualization?.chart_data as {
      labels: string[];
      values: number[];
    };
    const chartType = visualDecision?.chart_type as
      | "bar"
      | "line"
      | "pie"
      | "scatter"
      | "doughnut"
      | "polarArea";

    return {
      type: chartType,
      data: {
        labels: labels,
        datasets: [
          {
            label: "Data",
            data: values,
            backgroundColor: [
              "#3B82F6",
              "#EF4444",
              "#10B981",
              "#F59E0B",
              "#8B5CF6",
              "#EC4899",
              "#06B6D4",
              "#84CC16",
              "#F97316",
              "#6366F1",
            ],
            borderColor: [
              "#1E40AF",
              "#DC2626",
              "#059669",
              "#D97706",
              "#7C3AED",
              "#DB2777",
              "#0891B2",
              "#65A30D",
              "#EA580C",
              "#4F46E5",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Data Visualization - ${
              visualDecision?.chart_type?.toUpperCase() || "UNKNOWN"
            } Chart`,
            color: "#E5E7EB",
            font: {
              size: 16,
              weight: "bold",
            },
          },
          legend: {
            display: chartType === "pie",
            labels: {
              color: "#E5E7EB",
            },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleColor: "#E5E7EB",
            bodyColor: "#E5E7EB",
            borderColor: "#374151",
            borderWidth: 1,
          },
        },
        scales:
          chartType !== "pie"
            ? {
                x: {
                  ticks: {
                    color: "#9CA3AF",
                  },
                  grid: {
                    color: "#374151",
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    color: "#9CA3AF",
                  },
                  grid: {
                    color: "#374151",
                  },
                },
              }
            : {},
        animation: {
          duration: 2000,
          easing: "easeInOutQuart",
        },
      },
    };
  }, [visualization, visualDecision]);

  // Download as image functionality
  const downloadAsImage = useCallback(async () => {
    if (!containerRef.current) return;

    setIsDownloading(true);
    try {
      // For D3.js visualizations, we'll use html2canvas
      if (hasHtmlContent) {
        // Dynamic import to avoid SSR issues
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: "#1f2937",
          scale: 2,
          useCORS: true,
          allowTaint: true,
        });

        const link = document.createElement("a");
        link.download = `visualization-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } else if (chartInstanceRef.current) {
        // For Chart.js, use the built-in toBase64Image method
        const link = document.createElement("a");
        link.download = `chart-${Date.now()}.png`;
        link.href = chartInstanceRef.current.toBase64Image("image/png", 1);
        link.click();
      }
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [hasHtmlContent]);

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Initialize chart when component mounts or data changes (only for Chart.js charts)
  useEffect(() => {
    if (hasHtmlContent || !chartRef.current || !visualization?.chart_data) {
      return;
    }

    // Destroy existing chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    try {
      const config = createChartConfig();
      chartInstanceRef.current = new Chart(chartRef.current, config);
    } catch (error) {
      console.error("Error creating chart:", error);
    }

    // Cleanup function
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [
    hasHtmlContent,
    visualization?.chart_data,
    visualDecision?.chart_type,
    createChartConfig,
  ]);

  if (!hasVisualization || !visualization || !visualDecision) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Always show the visualization by default - like WhatsApp image */}
      <div
        ref={containerRef}
        className={`bg-gray-800/50 rounded-lg border border-gray-600/50 backdrop-blur-sm overflow-hidden transition-all duration-300 ${
          isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-600/50">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span className="text-sm font-medium text-gray-300">{title}</span>
          </div>
          <div className="flex items-center space-x-1">
            {/* Download Button */}
            <button
              onClick={downloadAsImage}
              disabled={isDownloading}
              className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700/50 disabled:opacity-50"
              title="Download as image"
            >
              {isDownloading ? (
                <svg
                  className="w-3 h-3 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              <span>{isDownloading ? "Saving..." : "Download"}</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700/50"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isFullscreen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                )}
              </svg>
              <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </button>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative bg-gray-900/30">
          <div
            className={`relative w-full ${
              isFullscreen ? "h-[calc(100vh-120px)]" : "h-96"
            }`}
            style={{
              minHeight: isFullscreen ? "500px" : "400px",
              maxHeight: isFullscreen ? "none" : "500px",
            }}
          >
            {hasHtmlContent ? (
              <D3VisualizationContainer
                htmlContent={visualization.html_content}
                altText={visualization?.alt_text || "Data visualization chart"}
              />
            ) : (
              <canvas
                ref={chartRef}
                className="w-full h-full"
                aria-label={
                  visualization?.alt_text || "Data visualization chart"
                }
                role="img"
              />
            )}
          </div>

          {/* Overlay with chart info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/80 to-transparent p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-300">
                {(() => {
                  if (hasHtmlContent) {
                    // For D3.js visualizations, try to extract data count from HTML
                    const htmlContent = visualization?.html_content || "";
                    const dataMatches =
                      htmlContent.match(/data\s*:\s*\[(.*?)\]/g);
                    if (dataMatches) {
                      return `${dataMatches.length} data series`;
                    }
                    return "Data visualization";
                  } else {
                    // For Chart.js visualizations
                    const labels =
                      (visualization?.chart_data?.labels as string[])?.length ||
                      0;
                    const values =
                      (visualization?.chart_data?.values as number[])?.length ||
                      0;
                    return `${Math.max(labels, values)} data points`;
                  }
                })()}
              </div>
              <div className="text-xs text-gray-400 truncate max-w-48">
                {visualDecision?.chart_type
                  ? `${visualDecision.chart_type}`
                  : "Visualization"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
