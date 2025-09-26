"use client";

import { useState } from "react";

interface CanvasWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config?: unknown;
}

interface Canvas {
  id: string;
  name: string;
  config: {
    widgets: CanvasWidget[];
  };
  created_at: string;
  updated_at: string;
}

interface CanvasClientProps {
  initialCanvas: Canvas | null;
  user: {
    id: string;
    email: string;
  };
}

export default function CanvasClient({
  initialCanvas,
  user,
}: CanvasClientProps) {
  const [canvas, setCanvas] = useState<Canvas | null>(initialCanvas);
  const [widgets, setWidgets] = useState<CanvasWidget[]>(
    initialCanvas?.config?.widgets || []
  );
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [, setIsDragging] = useState(false);
  const [, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddWidget, setShowAddWidget] = useState(false);

  const saveCanvasWidgets = async (newWidgets: CanvasWidget[]) => {
    try {
      if (user) {
        // Save to database
        const canvasData = {
          name: canvas?.name || "My Canvas",
          config: { widgets: newWidgets },
          user_id: user.id,
        };

        if (canvas) {
          // Update existing canvas
          const response = await fetch("/api/canvas", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: canvas.id,
              ...canvasData,
            }),
          });

          if (response.ok) {
            const updatedCanvas = await response.json();
            setCanvas(updatedCanvas);
          }
        } else {
          // Create new canvas
          const response = await fetch("/api/canvas", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(canvasData),
          });

          if (response.ok) {
            const newCanvas = await response.json();
            setCanvas(newCanvas);
          }
        }
      } else {
        // Fallback to localStorage for non-authenticated users
        localStorage.setItem("canvas-widgets", JSON.stringify(newWidgets));
      }
    } catch (error) {
      console.error("Error saving canvas widgets:", error);
    }
  };

  const addWidget = (type: string) => {
    const newWidget: CanvasWidget = {
      id: Date.now().toString(),
      type,
      x: Math.random() * 400,
      y: Math.random() * 300,
      width: 200,
      height: 150,
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    saveCanvasWidgets(newWidgets);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId: string) => {
    const newWidgets = widgets.filter((w) => w.id !== widgetId);
    setWidgets(newWidgets);
    saveCanvasWidgets(newWidgets);
    setSelectedWidget(null);
  };

  // const _updateWidget = (widgetId: string, updates: Partial<CanvasWidget>) => {
  //   const newWidgets = widgets.map((w) =>
  //     w.id === widgetId ? { ...w, ...updates } : w
  //   );
  //   setWidgets(newWidgets);
  //   saveCanvasWidgets(newWidgets);
  // };

  const handleMouseDown = (e: React.MouseEvent, widgetId: string) => {
    e.preventDefault();
    setSelectedWidget(widgetId);
    setIsDragging(true);

    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) {
      setDragOffset({
        x: e.clientX - widget.x,
        y: e.clientY - widget.y,
      });
    }
  };

  // const _handleMouseUp = useCallback(() => {
  //   setIsDragging(false);
  //   setSelectedWidget(null);
  // }, []);

  const renderWidget = (widget: CanvasWidget) => {
    const isSelected = selectedWidget === widget.id;

    return (
      <div
        key={widget.id}
        className={`absolute border-2 rounded-lg cursor-move ${
          isSelected ? "border-blue-500" : "border-gray-600"
        }`}
        style={{
          left: widget.x,
          top: widget.y,
          width: widget.width,
          height: widget.height,
        }}
        onMouseDown={(e) => handleMouseDown(e, widget.id)}
      >
        <div className="w-full h-full bg-gray-800 rounded-lg p-4 relative">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-white font-medium capitalize">{widget.type}</h3>
            <button
              onClick={() => removeWidget(widget.id)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              ×
            </button>
          </div>

          {widget.type === "text" && (
            <div className="text-gray-300 text-sm">
              <p>This is a text widget. You can edit this content.</p>
            </div>
          )}

          {widget.type === "chart" && (
            <div className="text-gray-300 text-sm">
              <p>Chart widget placeholder</p>
            </div>
          )}

          {widget.type === "image" && (
            <div className="text-gray-300 text-sm">
              <p>Image widget placeholder</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Canvas</h1>
            <p className="text-gray-400">
              Create and organize your workspace with drag-and-drop widgets
            </p>
          </div>
          <button
            onClick={() => setShowAddWidget(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Add Widget</span>
          </button>
        </div>

        {/* Canvas Area */}
        <div className="relative bg-gray-800/50 border border-gray-700 rounded-xl min-h-[600px] overflow-hidden">
          {widgets.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Empty Canvas
                </h3>
                <p className="text-gray-400 mb-4">
                  Add widgets to start building your workspace
                </p>
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Add Your First Widget
                </button>
              </div>
            </div>
          ) : (
            widgets.map(renderWidget)
          )}
        </div>

        {/* Add Widget Modal */}
        {showAddWidget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Add Widget</h2>
                <button
                  onClick={() => setShowAddWidget(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => addWidget("text")}
                  className="p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg
                      className="w-4 h-4 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-medium">Text</h3>
                  <p className="text-gray-400 text-sm">Add text content</p>
                </button>

                <button
                  onClick={() => addWidget("chart")}
                  className="p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-medium">Chart</h3>
                  <p className="text-gray-400 text-sm">Visualize data</p>
                </button>

                <button
                  onClick={() => addWidget("image")}
                  className="p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg
                      className="w-4 h-4 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-medium">Image</h3>
                  <p className="text-gray-400 text-sm">Display images</p>
                </button>

                <button
                  onClick={() => addWidget("note")}
                  className="p-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg
                      className="w-4 h-4 text-yellow-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-medium">Note</h3>
                  <p className="text-gray-400 text-sm">Quick notes</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
