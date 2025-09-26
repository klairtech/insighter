"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import { getAgentAvatar as getAgentAvatarById } from "@/lib/agent-avatars";

// Function to get avatar for an agent (from config or fallback to ID-based)
function getAgentAvatar(agent: Agent) {
  // Check if agent has avatar in config
  if (
    agent.config &&
    typeof agent.config === "object" &&
    "avatar" in agent.config
  ) {
    const config = agent.config as Record<string, unknown>;
    const avatar = config.avatar as Record<string, unknown> | undefined;
    if (avatar && avatar.image && typeof avatar.image === "string") {
      return {
        image: avatar.image,
        name:
          avatar.name && typeof avatar.name === "string"
            ? avatar.name
            : "Agent",
      };
    }
  }

  // Fallback to ID-based avatar
  return getAgentAvatarById(agent.id);
}

interface Agent {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  agent_type: string;
  status: string;
  config: Record<string, unknown>;
  data_sources: Record<string, unknown>[];
  created_by: string;
  created_at: string;
  updated_at: string;
  access_level?: string;
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
    content: string;
    role: "user" | "assistant";
    created_at: string;
    isThinking?: boolean;
  }>;
}

interface ChatClientProps {
  initialAgents: Agent[];
  initialConversations: Conversation[];
  user: {
    id: string;
    email: string;
  };
}

export default function ChatClient({
  initialAgents,
  initialConversations,
  user,
}: ChatClientProps) {
  // Debug logging removed to prevent infinite re-rendering
  const searchParams = useSearchParams();

  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations.filter((conv) => conv.agent !== null)
  );
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only auto-scroll to bottom if we're not loading more messages
    if (!isLoadingMoreMessages) {
      scrollToBottom();
    }
  }, [currentConversation?.messages, isLoadingMoreMessages]);

  // Debug logging for current conversation changes
  useEffect(() => {
    console.log("Current conversation changed:", {
      conversationId: currentConversation?.id,
      messageCount: currentConversation?.messages?.length || 0,
      agentName: currentConversation?.agent?.name,
      lastMessage:
        currentConversation?.messages?.[
          currentConversation.messages.length - 1
        ],
    });
  }, [currentConversation]);

  // Auto-setup agent access if no agents are available
  useEffect(() => {
    if (agents.length === 0) {
      console.log("No agents available, setting up agent access...");
      setupAgentAccess();
    }
  }, [agents.length]);

  // Auto-select agent from URL parameters - moved after handleAgentSelect definition

  const setupAgentAccess = async () => {
    try {
      const response = await fetch("/api/setup-agent-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Agent access setup successful:", data);
        // Reload the page to get the updated agents
        window.location.reload();
      } else {
        console.error("Failed to setup agent access:", await response.text());
      }
    } catch (error) {
      console.error("Error setting up agent access:", error);
    }
  };

  const loadConversationMessages = useCallback(
    async (conversationId: string, page: number = 1, limit: number = 10) => {
      try {
        setIsLoadingMessages(true);
        const response = await fetch(
          `/api/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
        );
        if (response.ok) {
          const data = await response.json();
          return {
            messages: data.messages || [],
            hasMore: data.hasMore || false,
            totalCount: data.totalCount || 0,
          };
        } else {
          console.error("Failed to load messages:", await response.text());
          return { messages: [], hasMore: false, totalCount: 0 };
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        return { messages: [], hasMore: false, totalCount: 0 };
      } finally {
        setIsLoadingMessages(false);
      }
    },
    []
  );

  const handleAgentSelect = useCallback(
    async (agent: Agent) => {
      console.log("Selecting agent:", agent.name, agent.id);
      setSelectedAgent(agent);
      setMessagesPage(1);
      setHasMoreMessages(false);

      // Update URL to reflect the selected agent
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("agentId", agent.id);
      window.history.replaceState({}, "", currentUrl.toString());
      console.log("Updated URL to:", currentUrl.toString());

      // Find or create conversation for this agent
      let conversation = conversations.find(
        (conv) => conv.agent && conv.agent.id === agent.id
      );

      if (!conversation) {
        // Create new conversation
        conversation = {
          id: `temp-${agent.id}`,
          title: `Chat with ${agent.name}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          agent,
          messages: [],
        };
        setConversations((prev) => [...prev, conversation!]);
        setCurrentConversation(conversation);
      } else {
        // Load latest messages for existing conversation
        if (!conversation.id.startsWith("temp-")) {
          console.log(
            "Loading messages for existing conversation:",
            conversation.id
          );
          const messageData = await loadConversationMessages(
            conversation.id,
            1,
            10
          );
          conversation = {
            ...conversation,
            messages: messageData.messages,
          };
          setHasMoreMessages(messageData.hasMore);

          // Update the conversation in the state
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversation!.id ? conversation! : conv
            )
          );
        }
        setCurrentConversation(conversation);
      }
    },
    [conversations, loadConversationMessages]
  );

  // Fetch specific agent if not found in initial list
  const fetchSpecificAgent = useCallback(
    async (agentId: string) => {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        if (response.ok) {
          const agentData = await response.json();
          if (agentData && agentData.status === "active") {
            // Add to agents list and select
            const newAgent = {
              ...agentData,
              access_level: "chat",
            };
            setAgents((prev) => [...prev, newAgent]);
            handleAgentSelect(newAgent);
          }
        }
      } catch (error) {
        console.error(`Error fetching specific agent:`, error);
      }
    },
    [handleAgentSelect]
  );

  // Auto-select agent from URL parameters (only on initial load)
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const agentId = searchParams.get("agentId");
    if (agentId && !hasInitializedRef.current && agents.length > 0) {
      console.log("Auto-selecting agent from URL:", agentId);
      hasInitializedRef.current = true;

      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        handleAgentSelect(agent);
      } else {
        // Try exact string match
        const exactMatch = agents.find((a) => a.id === agentId.trim());
        if (exactMatch) {
          handleAgentSelect(exactMatch);
        } else {
          // Try to fetch the specific agent from API
          fetchSpecificAgent(agentId);
        }
      }
    } else if (!agentId && !hasInitializedRef.current && agents.length > 0) {
      // No agentId in URL, mark as initialized
      hasInitializedRef.current = true;
    }
  }, [searchParams, agents, handleAgentSelect, fetchSpecificAgent]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedAgent || isLoading) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      content: message.trim(),
      role: "user" as const,
      created_at: new Date().toISOString(),
    };

    // Add user message to current conversation (optimistic update)
    const updatedConversation = currentConversation
      ? {
          ...currentConversation,
          messages: [...currentConversation.messages, userMessage],
        }
      : {
          id: `temp-${Date.now()}`,
          title: `Chat with ${selectedAgent.name}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          agent: selectedAgent,
          messages: [userMessage],
        };

    console.log("Adding user message to conversation:", {
      conversationId: updatedConversation.id,
      messageCount: updatedConversation.messages.length,
      userMessage: userMessage,
    });

    setCurrentConversation(updatedConversation);
    setConversations((prev) => {
      const existingIndex = prev.findIndex(
        (conv) => conv.agent.id === selectedAgent.id
      );
      if (existingIndex >= 0) {
        return prev.map((conv, index) =>
          index === existingIndex ? updatedConversation : conv
        );
      } else {
        return [...prev, updatedConversation];
      }
    });

    setMessage("");
    setIsLoading(true);

    try {
      // Send message directly to agent - the API will handle conversation creation/retrieval
      console.log(
        "Sending message to agent:",
        selectedAgent.id,
        "Content:",
        userMessage.content
      );

      const response = await fetch(
        `/api/chat/agents/${selectedAgent.id}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: userMessage.content,
            message_type: "text",
          }),
        }
      );

      if (response.ok) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        // Add a temporary thinking message
        const thinkingMessage = {
          id: `thinking-${Date.now()}`,
          content: "🤔 Analyzing your question...",
          role: "assistant" as const,
          created_at: new Date().toISOString(),
          isThinking: true,
        };

        const conversationWithThinking = {
          ...updatedConversation,
          messages: [...updatedConversation.messages, thinkingMessage],
        };

        setCurrentConversation(conversationWithThinking);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "thinking") {
                  // Update thinking message
                  setCurrentConversation((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      messages: prev.messages.map((msg) =>
                        msg.id === thinkingMessage.id
                          ? { ...msg, content: `🤔 ${data.data.message}` }
                          : msg
                      ),
                    };
                  });
                } else if (data.type === "complete") {
                  // Replace thinking message with actual response
                  const assistantMessage = {
                    id:
                      data.data.agent_message?.id || `msg-${Date.now()}-agent`,
                    content:
                      data.data.agent_message?.content ||
                      "No response received",
                    role: "assistant" as const,
                    created_at:
                      data.data.agent_message?.created_at ||
                      new Date().toISOString(),
                  };

                  // Remove the thinking message and add the actual response
                  const messagesWithoutThinking =
                    updatedConversation.messages.filter(
                      (msg) => msg.id !== thinkingMessage.id
                    );

                  const finalConversation = {
                    ...updatedConversation,
                    id: data.data.conversation_id,
                    messages: [...messagesWithoutThinking, assistantMessage],
                  };

                  console.log("Final conversation with assistant message:", {
                    conversationId: finalConversation.id,
                    messageCount: finalConversation.messages.length,
                    lastMessage:
                      finalConversation.messages[
                        finalConversation.messages.length - 1
                      ],
                  });

                  setCurrentConversation(finalConversation);
                  setConversations((prev) => {
                    const existingIndex = prev.findIndex(
                      (conv) => conv.agent.id === selectedAgent.id
                    );
                    if (existingIndex >= 0) {
                      const updated = prev.map((conv, index) =>
                        index === existingIndex ? finalConversation : conv
                      );
                      console.log("Updated conversations array:", updated);
                      return updated;
                    } else {
                      const newArray = [...prev, finalConversation];
                      console.log("Added new conversation to array:", newArray);
                      return newArray;
                    }
                  });
                } else if (data.type === "error") {
                  throw new Error(data.data.message);
                }
              } catch (parseError) {
                console.error("Error parsing SSE data:", parseError);
              }
            }
          }
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Agent message API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(
          `Failed to send message: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove the thinking message and revert to the conversation before the thinking message was added
      if (updatedConversation) {
        const messagesWithoutThinking = updatedConversation.messages.filter(
          (msg) => !("isThinking" in msg) || !msg.isThinking
        );

        const revertedConversation = {
          ...updatedConversation,
          messages: messagesWithoutThinking,
        };

        setCurrentConversation(revertedConversation);
        setConversations((prev) => {
          const existingIndex = prev.findIndex(
            (conv) => conv.agent.id === selectedAgent.id
          );
          if (existingIndex >= 0) {
            return prev.map((conv, index) =>
              index === existingIndex ? revertedConversation : conv
            );
          }
          return prev;
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const loadMoreMessages = useCallback(async () => {
    if (
      !currentConversation ||
      !hasMoreMessages ||
      isLoadingMessages ||
      isLoadingMoreMessages ||
      currentConversation.id.startsWith("temp-")
    ) {
      return;
    }

    setIsLoadingMoreMessages(true);
    const nextPage = messagesPage + 1;
    console.log("Loading more messages, page:", nextPage);

    // Store current scroll position and height before loading
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) {
      setIsLoadingMoreMessages(false);
      return;
    }

    const previousScrollHeight = messagesContainer.scrollHeight;
    const previousScrollTop = messagesContainer.scrollTop;

    const messageData = await loadConversationMessages(
      currentConversation.id,
      nextPage,
      10
    );

    if (messageData.messages.length > 0) {
      const updatedConversation = {
        ...currentConversation,
        messages: [...messageData.messages, ...currentConversation.messages],
      };

      setCurrentConversation(updatedConversation);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversation.id ? updatedConversation : conv
        )
      );

      setMessagesPage(nextPage);
      setHasMoreMessages(messageData.hasMore);

      // Restore scroll position after new messages are loaded
      requestAnimationFrame(() => {
        if (messagesContainer) {
          const newScrollHeight = messagesContainer.scrollHeight;
          const heightDifference = newScrollHeight - previousScrollHeight;
          messagesContainer.scrollTop = previousScrollTop + heightDifference;
        }
        setIsLoadingMoreMessages(false);
      });
    } else {
      setIsLoadingMoreMessages(false);
    }
  }, [
    currentConversation,
    hasMoreMessages,
    isLoadingMessages,
    isLoadingMoreMessages,
    messagesPage,
    loadConversationMessages,
  ]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget;
      if (
        scrollTop === 0 &&
        hasMoreMessages &&
        !isLoadingMessages &&
        !isLoadingMoreMessages
      ) {
        loadMoreMessages();
      }
    },
    [
      hasMoreMessages,
      isLoadingMessages,
      isLoadingMoreMessages,
      loadMoreMessages,
    ]
  );

  return (
    <div className="h-[calc(100vh-6rem)] bg-gray-900 flex overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white">
              Your Data Agents
            </h1>
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
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <p className="text-sm">No agents available</p>
            </div>
          ) : (
            <div className="space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    console.log("Agent button clicked:", agent.name, agent.id);
                    handleAgentSelect(agent);
                  }}
                  className={`w-full text-left p-3 hover:bg-gray-700 transition-colors ${
                    selectedAgent?.id === agent.id ? "bg-gray-700" : ""
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Agent Avatar */}
                    {(() => {
                      const avatar = getAgentAvatar(agent);
                      return (
                        <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg ring-2 ring-gray-600">
                          <Image
                            src={avatar.image}
                            alt={`${agent.name} avatar`}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to a default avatar if image fails to load
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                agent.name
                              )}&background=6366f1&color=fff&size=150`;
                            }}
                          />
                        </div>
                      );
                    })()}

                    {/* Agent Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {agent.name}
                        </h3>
                        <span className="text-xs text-gray-400">Online</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {agent.description || "AI Assistant"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {(() => {
                  const avatar = getAgentAvatar(currentConversation.agent);
                  return (
                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg ring-2 ring-gray-600">
                      <Image
                        src={avatar.image}
                        alt={`${currentConversation.agent.name} avatar`}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to a default avatar if image fails to load
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            currentConversation.agent.name
                          )}&background=6366f1&color=fff&size=150`;
                        }}
                      />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {currentConversation.agent.name}
                  </h2>
                  <p className="text-xs text-gray-400">Online</p>
                </div>
              </div>

              {/* Workspace Button */}
              <button
                onClick={() =>
                  window.open(
                    `/workspaces/${currentConversation.agent.workspace_id}`,
                    "_blank"
                  )
                }
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                title="Go to Workspace"
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span>Workspace</span>
              </button>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-gray-900"
              onScroll={handleScroll}
            >
              {/* Loading indicator for older messages */}
              {isLoadingMessages && hasMoreMessages && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <span className="text-sm">Loading older messages...</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {currentConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-end space-x-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    } animate-fade-in`}
                  >
                    {/* Agent Avatar (left side) */}
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0">
                        {(() => {
                          const avatar = getAgentAvatar(
                            currentConversation.agent
                          );
                          return (
                            <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg ring-1 ring-gray-600">
                              <Image
                                src={avatar.image}
                                alt={`${currentConversation.agent.name} avatar`}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to a default avatar if image fails to load
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    currentConversation.agent.name
                                  )}&background=6366f1&color=fff&size=150`;
                                }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-300 ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white"
                          : msg.isThinking
                          ? "bg-gray-600 text-gray-200 shadow-sm animate-thinking-pulse"
                          : "bg-gray-700 text-white shadow-sm"
                      }`}
                    >
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
                              <em className="italic text-gray-200">
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
                              <li className="text-gray-200">{children}</li>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mb-2 text-white">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-bold mb-2 text-white">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-bold mb-1 text-white">
                                {children}
                              </h3>
                            ),
                            code: ({ children }) => (
                              <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-blue-300">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto mb-2">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-600 pl-3 italic text-gray-300 mb-2">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* User Avatar (right side) */}
                    {msg.role === "user" && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-sm font-semibold">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {/* Old typing indicator removed - now using real-time thinking updates */}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-gray-800 border-t border-gray-700 p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message"
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isLoading}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Welcome to AI Assistants
              </h2>
              <p className="text-gray-400">
                Select an AI assistant from the sidebar to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
