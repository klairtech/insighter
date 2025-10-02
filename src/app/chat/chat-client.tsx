"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SQLQueryDisplay from "@/components/SQLQueryDisplay";
import LiveAgentStatus from "@/components/LiveAgentStatus";
import DataSourceFilter from "@/components/DataSourceFilter";
import { useAnalytics } from "@/hooks/useAnalytics";

// MessageContent component with "See More" functionality
function MessageContent({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Filter out HTML content that should be rendered as visualizations
  const filteredContent = content
    .replace(/```html[\s\S]*?```/g, "") // Remove HTML code blocks
    .replace(/```[\s\S]*?```/g, "") // Remove any code blocks
    .replace(/<script[\s\S]*?<\/script>/g, "") // Remove script tags
    .replace(/<svg[\s\S]*?<\/svg>/g, "") // Remove SVG content
    .replace(/<div[\s\S]*?<\/div>/g, "") // Remove div content
    .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
    .replace(/\n\s*\n/g, "\n") // Remove extra line breaks
    .trim();

  // Check if content is long enough to truncate
  useEffect(() => {
    if (contentRef.current) {
      // Temporarily remove height restriction to measure full content
      const originalMaxHeight = contentRef.current.style.maxHeight;
      contentRef.current.style.maxHeight = "none";

      const lineHeight = 20; // Approximate line height in pixels
      const maxHeight = lineHeight * 8; // Show max 8 lines
      const actualHeight = contentRef.current.scrollHeight;

      // Restore original max height
      contentRef.current.style.maxHeight = originalMaxHeight;

      setShouldTruncate(actualHeight > maxHeight);
    }
  }, [filteredContent]);

  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-2 last:mb-0">{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-gray-200">{children}</em>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-gray-200">{children}</li>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-lg font-bold mb-2 text-white">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-base font-bold mb-2 text-white">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-bold mb-1 text-white">{children}</h3>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-blue-300">
        {children}
      </code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto mb-2">
        {children}
      </pre>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-gray-600 pl-3 italic text-gray-300 mb-2">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="text-sm prose prose-invert prose-sm max-w-none">
      <div
        ref={contentRef}
        className={`transition-all duration-300 ${
          shouldTruncate && !isExpanded ? "max-h-40 overflow-hidden" : ""
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {filteredContent}
        </ReactMarkdown>
      </div>

      {shouldTruncate && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-gray-600/50"
          >
            {isExpanded ? "See Less" : "See More"}
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function to deduplicate messages by ID
function deduplicateMessages(
  messages: Array<{
    id: string;
    created_at: string;
    role: "user" | "assistant";
    content: string;
    metadata?: Record<string, unknown>;
  }>
) {
  return messages.filter(
    (msg, index, arr) => arr.findIndex((m) => m.id === msg.id) === index
  );
}

interface Agent {
  id: string;
  name: string;
  description: string;
  workspace_id: string;
  avatar_url?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  agent: Agent;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface ChatClientProps {
  initialAgents: Agent[];
  user: {
    name?: string;
    email: string;
    avatar_url?: string;
  };
  initialAgentId?: string;
  userCredits?: number;
}

function getUserAvatar(user: {
  name?: string;
  email: string;
  avatar_url?: string;
}) {
  const displayName = user.name || user.email.split("@")[0];
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (user.avatar_url) {
    return {
      type: "image" as const,
      src: user.avatar_url,
      alt: `${displayName} avatar`,
      initials,
      name: displayName,
    };
  }

  return {
    type: "initials" as const,
    initials,
    name: displayName,
  };
}

function getAgentAvatar(agent: Agent) {
  if (agent.avatar_url) {
    return {
      type: "image" as const,
      src: agent.avatar_url,
      alt: `${agent.name} avatar`,
    };
  }

  return {
    type: "initials" as const,
    initials: agent.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
  };
}

export default function ChatClient({
  initialAgents,
  user,
  initialAgentId,
  userCredits = 0,
}: ChatClientProps) {
  const router = useRouter();
  const { trackSendMessage, trackAIResponse } = useAnalytics();

  // Client-side authentication protection
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, router]);
  const [agents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [agentActivities, setAgentActivities] = useState<
    {
      id: string;
      name: string;
      status: "thinking" | "working" | "analyzing" | "generating" | "complete";
      message: string;
      progress?: number;
    }[]
  >([]);
  const [showLiveStatus, setShowLiveStatus] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>([]);
  const [_availableDataSources, setAvailableDataSources] = useState<string[]>(
    []
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const initialAgentSelectedRef = useRef<boolean>(false);

  // Generate natural thinking activities based on user query
  const generateAgentActivities = (
    userQuery: string
  ): {
    id: string;
    name: string;
    status: "thinking" | "working" | "analyzing" | "generating" | "complete";
    message: string;
    progress?: number;
  }[] => {
    const activities: {
      id: string;
      name: string;
      status: "thinking" | "working" | "analyzing" | "generating" | "complete";
      message: string;
      progress?: number;
    }[] = [];

    // Message pools for variety
    const initialMessages = [
      "Let me understand what you're asking...",
      "Processing your request...",
      "Analyzing your question...",
      "Breaking down your query...",
      "Understanding the requirements...",
    ];

    const contextMessages = [
      "Analyzing the context and conversation history...",
      "Reviewing previous conversation context...",
      "Considering the conversation flow...",
      "Checking for relevant context...",
      "Understanding the background...",
    ];

    // Always start with initial analysis
    activities.push({
      id: "initial",
      name: "Initial Analysis",
      status: "thinking",
      message:
        initialMessages[Math.floor(Math.random() * initialMessages.length)],
      progress: 0,
    });

    // Add context analysis
    activities.push({
      id: "context",
      name: "Context Analysis",
      status: "thinking",
      message:
        contextMessages[Math.floor(Math.random() * contextMessages.length)],
      progress: 0,
    });

    // Add activities based on query content

    if (
      userQuery.toLowerCase().includes("sql") ||
      userQuery.toLowerCase().includes("query") ||
      userQuery.toLowerCase().includes("data") ||
      userQuery.toLowerCase().includes("how many") ||
      userQuery.toLowerCase().includes("count") ||
      userQuery.toLowerCase().includes("donations")
    ) {
      const databaseMessages = [
        "Connecting to your data and preparing the analysis...",
        "Accessing the database and setting up queries...",
        "Establishing connection to your data sources...",
        "Preparing to query your database...",
        "Initializing data connection...",
      ];

      const queryMessages = [
        "Executing database queries to fetch the data...",
        "Running SQL queries to retrieve the information...",
        "Processing database requests...",
        "Fetching data from your sources...",
        "Querying the database for results...",
      ];

      activities.push({
        id: "database",
        name: "Data Processing",
        status: "working",
        message:
          databaseMessages[Math.floor(Math.random() * databaseMessages.length)],
        progress: 0,
      });

      activities.push({
        id: "query",
        name: "Query Execution",
        status: "working",
        message:
          queryMessages[Math.floor(Math.random() * queryMessages.length)],
        progress: 0,
      });
    }

    // Add data analysis step
    const analysisMessages = [
      "Analyzing the results and identifying key insights...",
      "Processing the data to extract meaningful patterns...",
      "Examining the results for important trends...",
      "Reviewing the data to find key insights...",
      "Interpreting the results and patterns...",
    ];

    activities.push({
      id: "analysis",
      name: "Data Analysis",
      status: "analyzing",
      message:
        analysisMessages[Math.floor(Math.random() * analysisMessages.length)],
      progress: 0,
    });

    // Always include response generation
    const responseMessages = [
      "Crafting a comprehensive answer for you...",
      "Formulating the response with key insights...",
      "Preparing a detailed explanation...",
      "Structuring the answer for clarity...",
      "Compiling the findings into a response...",
    ];

    activities.push({
      id: "response",
      name: "Response Generation",
      status: "analyzing",
      message:
        responseMessages[Math.floor(Math.random() * responseMessages.length)],
      progress: 0,
    });

    // Add quality check
    const qualityMessages = [
      "Reviewing the response for accuracy and completeness...",
      "Double-checking the information for correctness...",
      "Validating the response quality...",
      "Ensuring the answer is comprehensive...",
      "Finalizing the response details...",
    ];

    activities.push({
      id: "quality",
      name: "Quality Check",
      status: "analyzing",
      message:
        qualityMessages[Math.floor(Math.random() * qualityMessages.length)],
      progress: 0,
    });

    // Add follow-up suggestions
    const followupMessages = [
      "Thinking of related questions you might find helpful...",
      "Considering follow-up questions for deeper insights...",
      "Preparing additional questions you might want to explore...",
      "Generating suggestions for further analysis...",
      "Brainstorming related topics of interest...",
    ];

    activities.push({
      id: "followup",
      name: "Follow-up Suggestions",
      status: "generating",
      message:
        followupMessages[Math.floor(Math.random() * followupMessages.length)],
      progress: 0,
    });

    return activities;
  };

  // Auto-scroll to bottom when new messages arrive (but not when loading more, restoring scroll, or user is scrolling)
  useEffect(() => {
    if (
      messagesEndRef.current &&
      !isLoadingMoreMessages &&
      !isRestoringScroll &&
      !isUserScrolling
    ) {
      // Add a small delay to ensure DOM is updated
      setTimeout(() => {
        if (messagesEndRef.current && !isRestoringScroll && !isUserScrolling) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [
    currentConversation?.messages?.length,
    isLoadingMoreMessages,
    isRestoringScroll,
    isUserScrolling,
  ]); // Only trigger on message count change, not message content

  // Handle agent selection
  const handleAgentSelect = useCallback(async (agent: Agent) => {
    setSelectedAgent(agent);
    setIsLoadingMessages(true);
    setMessagesPage(1);
    setHasMoreMessages(false);

    try {
      // Load conversations for this agent with pagination
      const response = await fetch(
        `/api/conversations?agent_id=${agent.id}&type=chat&include_messages=true&page=1&limit=20`
      );
      if (response.ok) {
        const data = await response.json();

        if (data.conversations && data.conversations.length > 0) {
          // Use the first conversation or create a new one
          const conversation = data.conversations[0];

          // Deduplicate messages in the conversation
          if (conversation.messages) {
            conversation.messages = deduplicateMessages(conversation.messages);
          }

          setCurrentConversation(conversation);
          // Set pagination metadata
          setHasMoreMessages(
            data.hasMoreMessages || conversation.messages.length >= 20
          );
          setMessagesPage(data.currentPage || 1);
        } else {
          // No conversations yet, create a new conversation object for the UI
          const newConversation: Conversation = {
            id: `new-${agent.id}`,
            title: `Chat with ${agent.name}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            agent: agent,
            messages: [],
          };
          setCurrentConversation(newConversation);
          setHasMoreMessages(false);
          setMessagesPage(1);
        }
      } else {
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Auto-select agent from URL (only on initial load)
  useEffect(() => {
    // Skip if we've already made the initial selection
    if (initialAgentSelectedRef.current) {
      return;
    }

    if (initialAgentId && agents.length > 0) {
      const agent = agents.find((a) => a.id === initialAgentId);
      if (agent) {
        handleAgentSelect(agent);
        initialAgentSelectedRef.current = true;
      } else {
        initialAgentSelectedRef.current = true; // Mark as attempted even if failed
      }
    } else if (agents.length > 0 && !selectedAgent) {
      // Auto-select first available agent if no specific agent ID provided
      handleAgentSelect(agents[0]);
      initialAgentSelectedRef.current = true;
    }
  }, [initialAgentId, agents, handleAgentSelect, selectedAgent]);

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !selectedAgent || isLoading) return;

    // Track message sending
    trackSendMessage(message.trim().length, false);

    const userMessage = {
      content: message.trim(),
      role: "user" as const,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    // Don't add user message locally - wait for API response to avoid duplicates
    // Just clear the input and show loading state

    setMessage("");
    setIsLoading(true);

    // Set start time for response tracking
    (window as unknown as { messageStartTime?: number }).messageStartTime =
      Date.now();

    // Generate and show live agent activities
    const activities = generateAgentActivities(userMessage.content);
    setAgentActivities(activities);
    setShowLiveStatus(true);

    // Add user message to conversation immediately
    if (currentConversation) {
      // Update conversation title if it's still the default "Chat with [Agent]" title
      const shouldUpdateTitle =
        currentConversation.title.startsWith("Chat with");

      setCurrentConversation((prev) =>
        prev
          ? {
              ...prev,
              title: shouldUpdateTitle
                ? message.trim().length > 50
                  ? message.trim().substring(0, 50) + "..."
                  : message.trim()
                : prev.title,
              messages: [...prev.messages, userMessage],
            }
          : null
      );
    } else {
      // Create new conversation with user message
      const newConversation: Conversation = {
        id: `temp-${Date.now()}`,
        title:
          message.trim().length > 50
            ? message.trim().substring(0, 50) + "..."
            : message.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        agent: selectedAgent,
        messages: [userMessage],
      };
      setCurrentConversation(newConversation);
    }

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          content: userMessage.content,
          message_type: "text",
          stream: false,
          selectedDataSources:
            selectedDataSources.length > 0 ? selectedDataSources : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.conversation) {
          // Track AI response
          const responseTime =
            Date.now() -
            ((window as unknown as { messageStartTime?: number })
              .messageStartTime || 0);
          trackAIResponse(responseTime, selectedAgent?.name || "unknown");

          // Hide thinking notes immediately when response arrives
          setShowLiveStatus(false);
          setAgentActivities([]);

          // Replace the entire conversation with the API response
          // This ensures we get the correct user message with the proper ID
          setCurrentConversation((prev) => {
            if (!prev) return data.conversation;

            // Remove processing messages from the API response
            const filteredApiMessages = data.conversation.messages.filter(
              (msg: { metadata?: Record<string, unknown> }) =>
                !msg.metadata?.isProcessing
            );

            // Final deduplication to be extra safe
            const finalMessages = deduplicateMessages(filteredApiMessages);

            return {
              ...data.conversation,
              messages: finalMessages,
            };
          });
        }
      } else {
        // Handle specific error cases
        if (response.status === 402) {
          // Payment Required - insufficient credits
          const errorData = await response.json().catch(() => ({}));

          // Show user-friendly error message
          const isMinimumCreditsError = errorData.requiredCredits === 10;
          const errorMessage = {
            content: isMinimumCreditsError
              ? `❌ **Insufficient Credits for Chat**\n\nYou need at least 10 credits to use the chat feature.\n\n**Current Credits:** ${
                  errorData.currentCredits || 0
                }\n**Minimum Required:** 10 credits\n\nPlease purchase more credits to continue using the AI agent.`
              : `❌ **Insufficient Credits**\n\nYou don't have enough credits to process this request.\n\n**Current Credits:** ${
                  errorData.currentCredits || 0
                }\n**Required Credits:** ${
                  errorData.requiredCredits || 50
                }\n\nPlease purchase more credits to continue using the AI agent.`,
            role: "assistant" as const,
            id: `error-${Date.now()}`,
            created_at: new Date().toISOString(),
            metadata: {
              isError: true,
              errorType: isMinimumCreditsError
                ? "minimum_credits_required"
                : "insufficient_credits",
              currentCredits: errorData.currentCredits,
              requiredCredits: errorData.requiredCredits,
            },
          };

          // Add error message to conversation
          setCurrentConversation((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              messages: [...prev.messages, errorMessage],
            };
          });
        } else {
          // Show generic error message
          const errorMessage = {
            content: `❌ **Error**\n\nFailed to send message. Please try again.`,
            role: "assistant" as const,
            id: `error-${Date.now()}`,
            created_at: new Date().toISOString(),
            metadata: {
              isError: true,
              errorType: "generic_error",
              status: response.status,
              statusText: response.statusText,
            },
          };

          // Add error message to conversation
          setCurrentConversation((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              messages: [...prev.messages, errorMessage],
            };
          });
        }
      }
    } catch (_error) {
      // Show network error message
      const errorMessage = {
        content: `❌ **Network Error**\n\nFailed to connect to the server. Please check your internet connection and try again.`,
        role: "assistant" as const,
        id: `error-${Date.now()}`,
        created_at: new Date().toISOString(),
        metadata: {
          isError: true,
          errorType: "network_error",
          error: _error instanceof Error ? _error.message : "Unknown error",
        },
      };

      // Add error message to conversation
      setCurrentConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, errorMessage],
        };
      });
    } finally {
      setIsLoading(false);
      // Keep live status visible for a minimum duration to show agent activities
      setTimeout(() => {
        setShowLiveStatus(false);
        setAgentActivities([]);
      }, 3000); // Show for at least 3 seconds
    }
  }, [
    message,
    selectedAgent,
    isLoading,
    currentConversation,
    selectedDataSources,
    trackAIResponse,
    trackSendMessage,
  ]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Handle workspace navigation
  const handleWorkspaceNavigation = useCallback(() => {
    try {
      if (currentConversation?.agent?.workspace_id) {
        router.push(`/workspaces/${currentConversation.agent.workspace_id}`);
      } else if (selectedAgent?.workspace_id) {
        router.push(`/workspaces/${selectedAgent.workspace_id}`);
      } else {
        // You could show a toast notification here
      }
    } catch {
      // Handle any errors silently
    }
  }, [
    currentConversation?.agent?.workspace_id,
    selectedAgent?.workspace_id,
    router,
  ]);

  // Load more messages with pagination
  const loadMoreMessages = useCallback(async () => {
    if (
      !selectedAgent ||
      !currentConversation ||
      isLoadingMoreMessages ||
      !hasMoreMessages
    ) {
      return;
    }

    setIsLoadingMoreMessages(true);

    // Store current scroll position
    if (messagesContainerRef.current) {
      scrollPositionRef.current = messagesContainerRef.current.scrollTop;
    }

    try {
      const nextPage = messagesPage + 1;
      const response = await fetch(
        `/api/conversations?agent_id=${selectedAgent.id}&type=chat&include_messages=true&page=${nextPage}&limit=20`
      );

      if (response.ok) {
        const data = await response.json();

        if (data.conversations && data.conversations.length > 0) {
          const conversation = data.conversations[0];

          if (conversation.messages) {
            // Deduplicate and merge messages
            const existingMessages = currentConversation.messages || [];
            const newMessages = deduplicateMessages(conversation.messages);

            // Merge messages, prepending older messages to existing ones
            const mergedMessages = [...newMessages, ...existingMessages];
            const deduplicatedMerged = deduplicateMessages(mergedMessages);

            // Sort by created_at to maintain chronological order (oldest first)
            deduplicatedMerged.sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );

            setCurrentConversation((prev) =>
              prev
                ? {
                    ...prev,
                    messages: deduplicatedMerged,
                  }
                : null
            );
          }

          setHasMoreMessages(data.hasMoreMessages || false);
          setMessagesPage(nextPage);

          // Restore scroll position after a brief delay to allow DOM update
          setIsRestoringScroll(true);
          setTimeout(() => {
            if (messagesContainerRef.current) {
              // Calculate the new scroll position based on the added content height
              const container = messagesContainerRef.current;
              const newScrollTop =
                container.scrollHeight -
                (container.clientHeight - scrollPositionRef.current);
              container.scrollTop = Math.max(0, newScrollTop);
              // Reset the flag after scroll restoration
              setTimeout(() => setIsRestoringScroll(false), 100);
            }
          }, 150); // Slightly longer delay to ensure DOM is fully updated
        }
      }
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [
    selectedAgent,
    currentConversation,
    isLoadingMoreMessages,
    hasMoreMessages,
    messagesPage,
  ]);

  // Handle scroll events for pagination
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Check if user is near the bottom (within 50px)
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;

      // Set user scrolling flag
      setIsUserScrolling(!isNearBottom);

      // Load more messages when user scrolls near the top
      if (scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages) {
        loadMoreMessages();
      }
    },
    [hasMoreMessages, isLoadingMoreMessages, loadMoreMessages]
  );

  return (
    <div className="h-[calc(100vh-6rem)] bg-gray-900 flex overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-white">
                Your Data Agents
              </h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                BETA
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-gray-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:bg-gray-600 focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Agents List */}
        <div className="flex-1 overflow-y-auto">
          {/* Agents List - Debug logging removed to reduce console spam */}
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => handleAgentSelect(agent)}
              className={`p-3 border-b border-gray-700 cursor-pointer transition-colors hover:bg-gray-700 ${
                selectedAgent?.id === agent.id ? "bg-gray-700" : ""
              }`}
            >
              <div className="flex items-center space-x-3">
                {/* Agent Avatar */}
                {(() => {
                  const avatar = getAgentAvatar(agent);
                  return (
                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg ring-2 ring-gray-600">
                      {avatar.type === "image" && avatar.src ? (
                        <Image
                          src={avatar.src}
                          alt={avatar.alt || `${agent.name} avatar`}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to initials avatar if image fails to load
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden"
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center bg-indigo-600 text-white font-semibold text-xl ${
                          avatar.type === "image" && avatar.src ? "hidden" : ""
                        }`}
                      >
                        {avatar.type === "initials"
                          ? avatar.initials
                          : agent.name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  );
                })()}

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-white truncate">
                      {agent.name}
                    </h3>
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Online</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {agent.description ||
                      "AI agent for analyzing workspace data"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        {currentConversation && (
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Agent Avatar */}
                {(() => {
                  const avatar = getAgentAvatar(currentConversation.agent);
                  return (
                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg ring-2 ring-gray-600">
                      {avatar.type === "image" && avatar.src ? (
                        <Image
                          src={avatar.src}
                          alt={
                            avatar.alt ||
                            `${currentConversation.agent.name} avatar`
                          }
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to initials avatar if image fails to load
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden"
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center bg-indigo-600 text-white font-semibold text-lg ${
                          avatar.type === "image" && avatar.src ? "hidden" : ""
                        }`}
                      >
                        {avatar.type === "initials"
                          ? avatar.initials
                          : currentConversation.agent.name
                              .substring(0, 2)
                              .toUpperCase()}
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-semibold text-white">
                      {currentConversation.agent.name}
                    </h2>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                      BETA
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* Data Source Filter */}
                {currentConversation?.agent?.workspace_id && (
                  <DataSourceFilter
                    workspaceId={currentConversation.agent.workspace_id}
                    selectedSources={selectedDataSources}
                    onSelectionChange={setSelectedDataSources}
                    onDataSourcesLoaded={(dataSources) => {
                      setAvailableDataSources(dataSources);
                      // Auto-select all data sources by default if none are selected
                      if (selectedDataSources.length === 0) {
                        setSelectedDataSources(dataSources);
                      }
                    }}
                    className=""
                    userCredits={userCredits}
                  />
                )}

                {/* Workspace Button */}
                <button
                  onClick={handleWorkspaceNavigation}
                  disabled={!currentConversation?.agent?.workspace_id}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    currentConversation?.agent?.workspace_id
                      ? `Go to ${currentConversation.agent.name}'s workspace`
                      : "No workspace available"
                  }
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span>Workspace</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {/* Load more messages button */}
          {hasMoreMessages &&
            !isLoadingMoreMessages &&
            currentConversation &&
            currentConversation.messages.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMoreMessages}
                  className="px-4 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Load More Messages
                </button>
              </div>
            )}

          {/* Loading more messages indicator */}
          {isLoadingMoreMessages && (
            <div className="flex justify-center py-4">
              <div className="flex items-center space-x-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm">Loading more messages...</span>
              </div>
            </div>
          )}

          {/* Loading messages indicator */}
          {isLoadingMessages && (
            <div className="flex justify-center py-8">
              <div className="flex items-center space-x-2 text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span>Loading messages...</span>
              </div>
            </div>
          )}

          {currentConversation && currentConversation.messages.length > 0 ? (
            currentConversation.messages.map((msg, index) => {
              const userAvatar = getUserAvatar(user);

              // Debug: Check for duplicate message IDs
              const duplicateIds = currentConversation.messages.filter(
                (m) => m.id === msg.id
              );
              if (duplicateIds.length > 1) {
              }

              return (
                <div
                  key={`${msg.id}-${index}`}
                  className={`flex items-end ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  } animate-fade-in`}
                >
                  {msg.role === "assistant" ? (
                    // Agent message layout (left side)
                    <>
                      {/* Agent Avatar */}
                      <div className="flex-shrink-0 mr-2">
                        {(() => {
                          if (msg.metadata?.isError) {
                            // Show error icon for error messages
                            return (
                              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg ring-1 ring-red-500">
                                <svg
                                  className="w-5 h-5 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                  />
                                </svg>
                              </div>
                            );
                          }

                          const avatar = getAgentAvatar(
                            currentConversation.agent
                          );
                          return (
                            <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg ring-1 ring-gray-600">
                              {avatar.type === "image" && avatar.src ? (
                                <Image
                                  src={avatar.src}
                                  alt={
                                    avatar.alt ||
                                    `${currentConversation.agent.name} avatar`
                                  }
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Fallback to initials avatar if image fails to load
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.nextElementSibling?.classList.remove(
                                      "hidden"
                                    );
                                  }}
                                />
                              ) : null}
                              <div
                                className={`w-full h-full flex items-center justify-center bg-indigo-600 text-white font-semibold text-sm ${
                                  avatar.type === "image" && avatar.src
                                    ? "hidden"
                                    : ""
                                }`}
                              >
                                {avatar.type === "initials"
                                  ? avatar.initials
                                  : currentConversation.agent.name
                                      .substring(0, 2)
                                      .toUpperCase()}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Agent Message Container */}
                      <div className="max-w-xs lg:max-w-md">
                        {/* Message Bubble */}
                        <div
                          className={`px-4 py-2 shadow-sm rounded-2xl rounded-bl-sm transition-all duration-300 ${
                            msg.metadata?.isError
                              ? "bg-red-900 border border-red-700 text-red-100"
                              : "bg-gray-700 text-white"
                          }`}
                        >
                          {msg.metadata?.isProcessing ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span className="text-gray-300 text-sm">
                                {msg.content}
                              </span>
                            </div>
                          ) : (
                            <MessageContent content={msg.content} />
                          )}

                          {/* SQL Query Display - Inside message bubble */}
                          {(() => {
                            if (
                              msg.metadata &&
                              (msg.metadata.sql_query ||
                                msg.metadata.sql_queries)
                            ) {
                              const sqlQuery =
                                msg.metadata.sql_query ||
                                (msg.metadata.sql_queries as string[])?.[0];
                              if (
                                sqlQuery &&
                                typeof sqlQuery === "string" &&
                                sqlQuery.trim()
                              ) {
                                return (
                                  <div className="mt-3 pt-3 border-t border-gray-600">
                                    <SQLQueryDisplay
                                      sqlQuery={sqlQuery as string}
                                      metadata={
                                        msg.metadata as Record<string, unknown>
                                      }
                                      className="ml-0"
                                    />
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>

                        {/* Message Timestamp */}
                        <div className="text-xs text-gray-400 mt-1 text-left">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    // User message layout (right side)
                    <>
                      {/* User Message Bubble */}
                      <div className="max-w-xs lg:max-w-md px-4 py-2 bg-blue-500 text-white rounded-2xl rounded-br-sm transition-all duration-300">
                        <div className="text-sm prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-white">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic text-blue-100">
                                  {children}
                                </em>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-2 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-2 space-y-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="text-blue-100">{children}</li>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-lg font-bold mb-2 text-white">
                                  {children as React.ReactNode}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-base font-bold mb-2 text-white">
                                  {children as React.ReactNode}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-bold mb-1 text-white">
                                  {children as React.ReactNode}
                                </h3>
                              ),
                              code: ({ children }) => (
                                <code className="bg-blue-600 px-1 py-0.5 rounded text-xs text-blue-100">
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-blue-600 p-2 rounded text-xs overflow-x-auto mb-2">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-blue-400 pl-3 italic text-blue-100 mb-2">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Message Timestamp */}
                        <div className="text-xs text-blue-100 mt-1 text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {/* User Avatar */}
                      <div className="flex-shrink-0 ml-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg ring-1 ring-gray-600">
                          {userAvatar.type === "image" ? (
                            <Image
                              src={userAvatar.src}
                              alt={userAvatar.alt}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to initials if image fails to load
                                e.currentTarget.style.display = "none";
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                        <div class="w-full h-full bg-blue-500 flex items-center justify-center">
                                          <span class="text-white text-sm font-semibold">${
                                            userAvatar.initials ||
                                            user.email.charAt(0).toUpperCase()
                                          }</span>
                                        </div>
                                      `;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {userAvatar.initials ||
                                  user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center">
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
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  No messages yet
                </h3>
                <p className="text-gray-400">
                  Select an AI assistant from the sidebar to start chatting
                </p>
              </div>
            </div>
          )}

          {/* Live Agent Status - Show below messages */}
          <LiveAgentStatus
            activities={agentActivities}
            isVisible={showLiveStatus}
          />

          <div ref={messagesEndRef} />
        </div>

        {/* Data Source Filter Status */}
        {selectedDataSources.length > 0 && (
          <div className="border-t border-gray-700 px-4 py-2 bg-blue-900/20">
            <div className="flex items-center space-x-2 text-sm text-blue-300">
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span>
                Filtered to {selectedDataSources.length} data source
                {selectedDataSources.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setSelectedDataSources([])}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Clear filter
              </button>
            </div>
          </div>
        )}

        {/* Credit Restriction Message */}
        {userCredits < 10 && (
          <div className="border-t border-gray-700 px-4 py-3 bg-yellow-900/20">
            <div className="flex items-center space-x-2 text-yellow-300">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium">Credits Required for Chat</p>
                <p className="text-xs text-yellow-400">
                  You need at least 10 credits to use the chat feature. Current:{" "}
                  {userCredits} credits
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  userCredits < 10
                    ? "Need at least 10 credits to chat..."
                    : "Type your message..."
                }
                disabled={userCredits < 10}
                className={`w-full px-3 py-2 rounded-lg border resize-none ${
                  userCredits < 10
                    ? "bg-gray-600 text-gray-400 border-gray-700 cursor-not-allowed"
                    : "bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                }`}
                rows={1}
                style={{
                  minHeight: "45px",
                  maxHeight: "120px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = target.scrollHeight + "px";
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading || userCredits < 10}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center h-[40px] w-[40px]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
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
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
