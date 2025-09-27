"use client";

import { useState, useEffect } from "react";

interface AgentActivity {
  id: string;
  name: string;
  status: "thinking" | "working" | "analyzing" | "generating" | "complete";
  message: string;
  progress?: number;
  avatar?: string;
}

interface LiveAgentStatusProps {
  activities: AgentActivity[];
  isVisible: boolean;
}

export default function LiveAgentStatus({
  activities,
  isVisible,
}: LiveAgentStatusProps) {
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [displayedMessage, setDisplayedMessage] = useState("");

  console.log("🔍 LiveAgentStatus rendered:", {
    activities,
    isVisible,
    activitiesLength: activities.length,
  });

  useEffect(() => {
    if (!isVisible || activities.length === 0) return;

    const currentActivity = activities[currentActivityIndex];
    if (!currentActivity) return;

    // Type out the message character by character
    let messageIndex = 0;
    const typeInterval = setInterval(() => {
      if (messageIndex < currentActivity.message.length) {
        setDisplayedMessage(
          currentActivity.message.substring(0, messageIndex + 1)
        );
        messageIndex++;
      } else {
        clearInterval(typeInterval);
        // Move to next activity after a delay
        setTimeout(() => {
          if (currentActivityIndex < activities.length - 1) {
            setCurrentActivityIndex((prev) => prev + 1);
            setDisplayedMessage("");
          }
        }, 2000);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [activities, currentActivityIndex, isVisible]);

  console.log("🔍 LiveAgentStatus visibility check:", {
    isVisible,
    activitiesLength: activities.length,
  });

  if (!isVisible || activities.length === 0) {
    console.log(
      "🔍 LiveAgentStatus: Not rendering - isVisible:",
      isVisible,
      "activities.length:",
      activities.length
    );
    return null;
  }

  const currentActivity = activities[currentActivityIndex];
  if (!currentActivity) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "thinking":
        return (
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse">
            <div className="w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
          </div>
        );
      case "working":
        return (
          <div className="w-3 h-3 bg-blue-400 rounded-full">
            <div className="w-3 h-3 bg-blue-300 rounded-full animate-spin"></div>
          </div>
        );
      case "analyzing":
        return (
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce">
            <div className="w-2 h-2 bg-purple-300 rounded-full ml-0.5 mt-0.5"></div>
          </div>
        );
      case "generating":
        return (
          <div className="w-3 h-3 bg-green-400 rounded-full">
            <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
          </div>
        );
      case "complete":
        return (
          <div className="w-3 h-3 bg-green-500 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full ml-0.5 mt-0.5"></div>
          </div>
        );
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "thinking":
        return "text-yellow-400";
      case "working":
        return "text-blue-400";
      case "analyzing":
        return "text-purple-400";
      case "generating":
        return "text-green-400";
      case "complete":
        return "text-green-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        {/* Agent Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">
              {currentActivity.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Agent Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-white">
              {currentActivity.name}
            </span>
            {getStatusIcon(currentActivity.status)}
            <span
              className={`text-xs font-medium ${getStatusColor(
                currentActivity.status
              )}`}
            >
              {currentActivity.status.toUpperCase()}
            </span>
          </div>

          <div className="text-sm text-gray-300">
            {displayedMessage}
            <span className="animate-pulse">|</span>
          </div>

          {/* Progress Bar */}
          {currentActivity.progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-gray-700 rounded-full h-1">
                <div
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${currentActivity.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      {activities.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-600/50">
          <div className="flex flex-wrap gap-2">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`px-2 py-1 rounded-full text-xs transition-all duration-200 ${
                  index === currentActivityIndex
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : index < currentActivityIndex
                    ? "bg-green-500/20 text-green-300"
                    : "bg-gray-700/50 text-gray-400"
                }`}
              >
                {activity.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
