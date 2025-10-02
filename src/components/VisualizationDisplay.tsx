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
  const [, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size changes for responsive D3.js
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size
    updateSize();

    // Create resize observer
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !htmlContent) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = "";

      // Clean the HTML content to remove only specific unwanted patterns
      let cleanedHtmlContent = htmlContent;

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

      // Only proceed if we have meaningful HTML content after cleaning
      if (!cleanedHtmlContent || cleanedHtmlContent.length < 20) {
        setError("No valid visualization content available");
        return;
      }

      // Create a new div to hold the D3.js content
      const d3Container = document.createElement("div");
      d3Container.innerHTML = cleanedHtmlContent;
      d3Container.style.width = "100%";
      d3Container.style.height = "100%";
      d3Container.style.overflow = "visible"; // Allow interactive elements to be accessible
      d3Container.style.position = "relative"; // Better positioning for interactive elements
      d3Container.style.display = "block"; // Use block instead of flex for better D3.js compatibility

      // Make D3.js and Chart.js available globally for the generated code
      (window as typeof window & { d3: typeof d3; Chart: typeof Chart }).d3 =
        d3;
      (window as typeof window & { d3: typeof d3; Chart: typeof Chart }).Chart =
        Chart;

      // Append the content
      containerRef.current.appendChild(d3Container);

      // Force resize of any SVG elements to fit container and ensure interactivity
      const svgElements = d3Container.querySelectorAll("svg");
      svgElements.forEach((svg) => {
        // Set responsive dimensions
        svg.style.width = "100%";
        svg.style.height = "auto"; // Use auto for better aspect ratio preservation
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.style.overflow = "visible";

        // Ensure pointer events work for interactivity
        svg.style.pointerEvents = "auto";

        // Ensure the SVG viewBox is set properly for responsiveness
        if (!svg.getAttribute("viewBox")) {
          const width = svg.getAttribute("width") || "800";
          const height = svg.getAttribute("height") || "400";
          svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }

        // Remove fixed width/height attributes to allow responsive behavior
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        // Ensure all interactive elements have proper pointer events
        const interactiveElements = svg.querySelectorAll(
          "g, circle, rect, path, line, text"
        );
        interactiveElements.forEach((element) => {
          const style = element.getAttribute("style");
          if (!style || !style.includes("pointer-events")) {
            element.setAttribute(
              "style",
              (element.getAttribute("style") || "") + "; pointer-events: auto;"
            );
          }
        });
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
          if (!scriptContent.trim()) {
            return;
          }

          // Wrap the script in an IIFE to create a new scope and make it responsive
          // Use a safer approach with Function constructor to avoid template literal conflicts
          const wrappedScript = `
            (function() {
              try {
                // Make D3.js responsive to container size and ensure interactivity
                const container = document.getElementById('d3-container');
                if (container) {
                  const rect = container.getBoundingClientRect();
                  window.d3ContainerWidth = rect.width;
                  window.d3ContainerHeight = rect.height;
                  
                  // Set responsive dimensions for D3.js
                  window.d3Width = Math.max(rect.width - 40, 300);
                  window.d3Height = Math.max(rect.height - 40, 200);
                  
                  // Ensure container allows pointer events for interactivity
                  container.style.pointerEvents = 'auto';
                  container.style.overflow = 'visible';
                  
                  // Log container dimensions for debugging
                  console.log('D3 Container dimensions:', {
                    containerWidth: rect.width,
                    containerHeight: rect.height
                  });
                }
                
                // Execute the script content using Function constructor for better security
                const scriptFunction = new Function(scriptContent);
                scriptFunction();
                
                // Add resize handler for responsive behavior
                let resizeTimeout;
                const handleResize = () => {
                  clearTimeout(resizeTimeout);
                  resizeTimeout = setTimeout(() => {
                    if (container) {
                      const rect = container.getBoundingClientRect();
                      window.d3ContainerWidth = rect.width;
                      window.d3ContainerHeight = rect.height;
                      window.d3Width = Math.max(rect.width - 40, 300);
                      window.d3Height = Math.max(rect.height - 40, 200);
                      
                      // Log new dimensions for debugging
                      console.log('D3 Container resized:', {
                        containerWidth: rect.width,
                        containerHeight: rect.height
                      });
                      
                      // Re-run the visualization with new dimensions
                      try {
                        const resizeScriptFunction = new Function(scriptContent);
                        resizeScriptFunction();
                      } catch (resizeError) {
                        console.warn('Error re-running visualization on resize:', resizeError);
                      }
                    }
                  }, 100);
                };
                
                window.addEventListener('resize', handleResize);
                
              } catch (_error) {
                console.warn('Error executing D3 visualization script:', _error);
              }
            })();
          `;

          const newScript = document.createElement("script");
          newScript.textContent = wrappedScript;
          newScript.type = "text/javascript";
          newScript.id = `d3-script-${Date.now()}-${index}`;
          document.head.appendChild(newScript);

          // Clean up after execution - give more time for D3.js to render
          setTimeout(() => {
            const scriptElement = document.getElementById(newScript.id);
            if (scriptElement) {
              document.head.removeChild(scriptElement);
            }
          }, 2000); // Increased from 100ms to 2 seconds
        } catch (_scriptError) {}
      });

      setIsLoaded(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoaded(false);
    }
  }, [htmlContent, containerSize]);

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
      id="d3-container"
      className="w-full h-full"
      aria-label={altText}
      role="img"
      style={{
        minHeight: "200px",
        width: "100%",
        height: "100%",
        overflow: "visible", // Allow interactive elements to be accessible
        position: "relative", // Better positioning for interactive elements
      }}
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
  title: _title = "Data Visualization",
}: VisualizationDisplayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true);
            setHasLoaded(true);
            // Disconnect observer after first load
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      { threshold: 0.1 } // Load when 10% visible
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasLoaded]);

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
              size: 18,
              weight: "bold",
            },
            padding: {
              top: 20,
              bottom: 20,
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
                    font: {
                      size: 12,
                    },
                  },
                  grid: {
                    color: "#374151",
                  },
                  title: {
                    display: true,
                    color: "#E5E7EB",
                    font: {
                      size: 14,
                      weight: "bold",
                    },
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    color: "#9CA3AF",
                    font: {
                      size: 12,
                    },
                  },
                  grid: {
                    color: "#374151",
                  },
                  title: {
                    display: true,
                    color: "#E5E7EB",
                    font: {
                      size: 14,
                      weight: "bold",
                    },
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

        // Pre-process the container to fix color compatibility issues
        const container = containerRef.current;
        const originalStyles: { [key: string]: string } = {};

        // Temporarily replace unsupported color functions with compatible ones
        const elementsWithColors = container.querySelectorAll("*");
        elementsWithColors.forEach((element) => {
          const htmlElement = element as HTMLElement;
          const computedStyle = window.getComputedStyle(htmlElement);

          // Check for problematic color properties
          [
            "color",
            "fill",
            "stroke",
            "background-color",
            "border-color",
          ].forEach((prop) => {
            const value = computedStyle.getPropertyValue(prop);
            if (
              value &&
              (value.includes("oklab") ||
                value.includes("oklch") ||
                value.includes("color-mix"))
            ) {
              // Store original style
              originalStyles[`${element.tagName}-${prop}`] =
                htmlElement.style.getPropertyValue(prop);

              // Replace with compatible color
              if (prop === "color" || prop === "fill") {
                htmlElement.style.setProperty(prop, "#e5e7eb", "important");
              } else if (prop === "stroke") {
                htmlElement.style.setProperty(prop, "#6b7280", "important");
              } else if (prop === "background-color") {
                htmlElement.style.setProperty(prop, "#1f2937", "important");
              }
            }
          });
        });

        let canvas;
        try {
          canvas = await html2canvas(container, {
            backgroundColor: "#1f2937",
            scale: 2,
            useCORS: true,
            allowTaint: true,
            ignoreElements: (element) => {
              // Skip elements that might cause color parsing issues
              return (
                element.tagName === "SCRIPT" || element.tagName === "STYLE"
              );
            },
            onclone: (clonedDoc) => {
              // Additional processing on the cloned document
              const clonedContainer = clonedDoc.querySelector("#d3-container");
              if (clonedContainer) {
                // Ensure all text elements have compatible colors
                const textElements =
                  clonedContainer.querySelectorAll("text, tspan, title");
                textElements.forEach((textEl) => {
                  const htmlTextEl = textEl as SVGTextElement;
                  if (
                    !htmlTextEl.getAttribute("fill") ||
                    htmlTextEl.getAttribute("fill")?.includes("oklab")
                  ) {
                    htmlTextEl.setAttribute("fill", "#e5e7eb");
                  }
                });
              }
            },
          });
        } catch (_html2canvasError) {
          // Fallback: try with minimal options
          canvas = await html2canvas(container, {
            backgroundColor: "#1f2937",
            scale: 1,
            useCORS: false,
            allowTaint: false,
            ignoreElements: (element) => {
              return (
                element.tagName === "SCRIPT" || element.tagName === "STYLE"
              );
            },
          });
        }

        // Restore original styles
        elementsWithColors.forEach((element) => {
          const htmlElement = element as HTMLElement;
          Object.keys(originalStyles).forEach((key) => {
            const [tagName, prop] = key.split("-");
            if (element.tagName === tagName) {
              htmlElement.style.setProperty(prop, originalStyles[key]);
            }
          });
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
    } catch (_error) {
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
      } else {
        const element = containerRef.current as HTMLElement & {
          webkitRequestFullscreen?: () => void;
          msRequestFullscreen?: () => void;
        };
        if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        const doc = document as Document & {
          webkitExitFullscreen?: () => void;
          msExitFullscreen?: () => void;
        };
        if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
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
    } catch (_error) {}

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
        <div className="flex items-center justify-end p-3 border-b border-gray-600/50">
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
              isVisible ? (
                <D3VisualizationContainer
                  htmlContent={visualization.html_content || ""}
                  altText={
                    visualization?.alt_text || "Data visualization chart"
                  }
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-800/30 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-400">
                      Loading visualization...
                    </p>
                  </div>
                </div>
              )
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
        </div>
      </div>
    </div>
  );
}
