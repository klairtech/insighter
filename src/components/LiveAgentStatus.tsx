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

  useEffect(() => {
    if (!isVisible || activities.length === 0) {
      setCurrentActivityIndex(0);
      setDisplayedMessage("");
      return;
    }

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

  // Reset state when component becomes invisible
  useEffect(() => {
    if (!isVisible) {
      setCurrentActivityIndex(0);
      setDisplayedMessage("");
    }
  }, [isVisible]);

  if (!isVisible || activities.length === 0) {
    return null;
  }

  const currentActivity = activities[currentActivityIndex];
  if (!currentActivity) return null;

  const _getStatusIcon = (status: string) => {
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

  const _getStatusColor = (status: string) => {
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
    <div className="bg-gray-800/30 backdrop-blur-sm border-l-2 border-blue-500/50 rounded-r-lg p-3 mb-3 ml-4">
      <div className="flex items-start space-x-2">
        {/* Thinking indicator */}
        <div className="flex-shrink-0 mt-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        </div>

        {/* Natural thinking message */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-300 italic">
            {displayedMessage}
            <span className="animate-pulse text-blue-400">|</span>
          </div>
        </div>
      </div>
    </div>
  );
}
