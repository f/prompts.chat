"use client";

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Loader2, Sparkles, X, ChevronRight, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MiniPromptCard } from "./mini-prompt-card";
import { cn } from "@/lib/utils";

interface PromptBuilderState {
  title: string;
  description: string;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SKILL" | "TASTE"; // Output type, SKILL, or TASTE
  structuredFormat?: "JSON" | "YAML"; // Input type indicator
  categoryId?: string;
  tagIds: string[];
  isPrivate: boolean;
  requiresMediaUpload: boolean;
  requiredMediaType?: "IMAGE" | "VIDEO" | "DOCUMENT";
  requiredMediaCount?: number;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  searchResults?: Array<{
    id: string;
    title: string;
    contentPreview: string;
    type: string;
    tags: string[];
  }>;
}

interface PromptBuilderProps {
  availableTags: Array<{ id: string; name: string; slug: string; color: string }>;
  availableCategories: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
  currentState: PromptBuilderState;
  onStateChange: (state: PromptBuilderState) => void;
  modelName?: string;
  initialPromptRequest?: string;
}

export interface PromptBuilderHandle {
  sendMessage: (content: string) => void;
  open: () => void;
}

export const PromptBuilder = forwardRef<PromptBuilderHandle, PromptBuilderProps>(function PromptBuilder({
  availableTags,
  availableCategories,
  currentState,
  onStateChange,
  modelName = "gpt-4o-mini",
  initialPromptRequest,
}, ref) {
  const t = useTranslations("promptBuilder");
  // Default to closed on mobile (< 768px)
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Expose sendMessage and open to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (content: string) => {
      setIsOpen(true);
      setTimeout(() => sendMessageWithContent(content), 100);
    },
    open: () => setIsOpen(true),
  }));

  // Auto-send initial prompt request if provided
  const initialRequestSentRef = useRef(false);
  useEffect(() => {
    if (initialPromptRequest && !initialRequestSentRef.current && !isLoading) {
      initialRequestSentRef.current = true;
      setInput(initialPromptRequest);
      // Clear the URL querystring so refresh won't re-run the prompt
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("prompt");
        window.history.replaceState({}, "", url.pathname);
      }
      // Use setTimeout to ensure the input is set before sending
      setTimeout(() => {
        sendMessageWithContent(initialPromptRequest);
      }, 100);
    }
  }, [initialPromptRequest]);

  const sendMessageWithContent = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    // Add a placeholder for streaming
    const assistantMessageId = crypto.randomUUID();
    let fullContent = "";
    const toolCalls: ToolCall[] = [];
    const searchResults: Message["searchResults"] = [];
    let newState: PromptBuilderState | null = null;
    let streamError: string | null = null;
    let responseFinalized = false;

    try {
      const response = await fetch("/api/prompt-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentState,
          availableTags,
          availableCategories,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let pendingLine = "";

      const processLine = (line: string) => {
        if (responseFinalized) return;

        const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
        if (!normalizedLine.startsWith("data: ")) return;

        const data = normalizedLine.slice(6);
        if (data === "[DONE]") return;

        let parsed: {
          type?: string;
          content?: string;
          toolCall?: ToolCall;
          state?: PromptBuilderState;
          error?: string;
        };
        try {
          parsed = JSON.parse(data);
        } catch {
          // Ignore malformed events; complete lines are buffered before parsing.
          return;
        }

        if (parsed.type === "text" && parsed.content) {
          fullContent += parsed.content;
          setStreamingContent(fullContent);
        } else if (parsed.type === "tool_call" && parsed.toolCall) {
          toolCalls.push(parsed.toolCall);
          newState = parsed.state ?? newState;
          // Extract search results
          const resultData = parsed.toolCall.result?.data as
            | { prompts?: NonNullable<Message["searchResults"]> }
            | undefined;
          if (parsed.toolCall.name === "search_prompts" &&
              parsed.toolCall.result?.success &&
              resultData?.prompts) {
            searchResults.push(...resultData.prompts);
          }
        } else if (parsed.type === "state") {
          newState = parsed.state ?? null;
        } else if (parsed.type === "error") {
          streamError = parsed.error || t("errorMessage");
        } else if (parsed.type === "done") {
          responseFinalized = true;
          // Finalize the message
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant",
              content: fullContent,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              searchResults: searchResults.length > 0 ? searchResults : undefined,
            },
          ]);
          setStreamingContent("");

          if (newState) {
            onStateChange(newState);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          pendingLine += decoder.decode();
          if (pendingLine) processLine(pendingLine);
          break;
        }

        pendingLine += decoder.decode(value, { stream: true });
        const lines = pendingLine.split("\n");
        pendingLine = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
          if (streamError || responseFinalized) break;
        }

        if (streamError || responseFinalized) {
          await reader.cancel().catch(() => undefined);
          break;
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      if (!responseFinalized) {
        throw new Error("Prompt builder stream ended before completion");
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (responseFinalized) return;

      if (newState) {
        onStateChange(newState);
      }
      setStreamingContent("");
      setMessages((prev) => {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t("errorMessage"),
        };

        if (!fullContent && toolCalls.length === 0) {
          return [...prev, errorMessage];
        }

        return [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: fullContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
          },
          errorMessage,
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessageWithContent(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getToolCallDisplay = (toolCall: ToolCall) => {
    const isSuccess = toolCall.result?.success;
    const data = toolCall.result?.data as Record<string, unknown> | undefined;
    
    // Build detailed description based on tool type
    let detail = "";
    switch (toolCall.name) {
      case "set_title":
        detail = `Title → "${(data?.title as string)?.substring(0, 30)}${(data?.title as string)?.length > 30 ? "..." : ""}"`;
        break;
      case "set_description":
        detail = `Description → "${(data?.description as string)?.substring(0, 25)}..."`;
        break;
      case "set_content":
        detail = `Content set (${(data?.content as string)?.length || 0} chars)`;
        break;
      case "set_type":
        detail = `Type → ${data?.type}${data?.structuredFormat ? ` (${data.structuredFormat})` : ""}`;
        break;
      case "set_tags":
        const tags = data?.appliedTags as string[] | undefined;
        detail = tags?.length ? `Tags → ${tags.join(", ")}` : "No matching tags";
        break;
      case "set_category":
        detail = `Category → ${data?.category || "not found"}`;
        break;
      case "set_privacy":
        detail = data?.isPrivate ? "Set to Private" : "Set to Public";
        break;
      case "set_media_requirements":
        detail = data?.requiresMediaUpload 
          ? `Requires ${data.mediaCount || 1} ${data.mediaType || "file"}(s)` 
          : "No media required";
        break;
      case "search_prompts":
        const count = (data?.prompts as unknown[])?.length || 0;
        detail = `Found ${count} example${count !== 1 ? "s" : ""}`;
        break;
      case "get_available_tags":
        detail = `${(data?.tags as unknown[])?.length || 0} tags available`;
        break;
      case "get_available_categories":
        detail = `${(data?.categories as unknown[])?.length || 0} categories`;
        break;
      case "get_current_state":
        detail = "Retrieved current state";
        break;
      default:
        detail = toolCall.name.replace(/_/g, " ");
    }

    const toolLabel = toolCall.name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    
    return (
      <div
        key={toolCall.id}
        className={cn(
          "text-[11px] px-2 py-1.5 rounded border",
          isSuccess 
            ? "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400" 
            : "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400"
        )}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
          <span className="opacity-60 flex-shrink-0">{isSuccess ? "✓" : "✗"}</span>
          <span className="font-medium flex-shrink-0">{toolLabel}:</span>
          <span className="opacity-80 truncate">{detail}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <>
        {/* Desktop: inline button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="hidden sm:inline-flex gap-1.5 h-7 text-xs px-2"
        >
          <Bot className="h-3 w-3" />
          {t("openBuilder")}
        </Button>
        {/* Mobile: floating button */}
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="sm:hidden fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </>
    );
  }

  return (
    <>
      {/* Mobile: backdrop overlay */}
      <div 
        className="sm:hidden fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      {/* Desktop: side panel, Mobile: bottom drawer */}
      <div className="fixed z-50 bg-background shadow-lg flex flex-col
        sm:right-0 sm:left-auto sm:top-12 sm:bottom-auto sm:h-[calc(100vh-3rem)] sm:w-[400px] sm:border-l
        inset-x-0 bottom-0 h-[70vh] rounded-t-xl sm:rounded-none border-t
        animate-in slide-in-from-bottom duration-300 sm:animate-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="font-medium text-xs">{t("title")}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {messages.length === 0 && !streamingContent && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">{t("welcomeTitle")}</p>
            <p className="text-xs">{t("welcomeDescription")}</p>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">{t("tryAsking")}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {/* Show edit mode actions if there's existing content */}
                {currentState.content ? (
                  <>
                    {[t("editAction1"), t("editAction2"), t("editAction3"), t("editAction4")].map((action, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => {
                          setInput(action);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[t("example1"), t("example2"), t("example3")].map((example, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => {
                          setInput(example);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "text-sm",
                message.role === "user" ? "ml-8" : "mr-4"
              )}
            >
              <div
                className={cn(
                  "rounded-lg px-3 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                )}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="text-sm">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc list-inside">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal list-inside">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ className, children, ...props }) => {
                          const isBlock = className?.includes("language-") || String(children).includes("\n");
                          if (isBlock) {
                            return (
                              <pre className="bg-background/80 border rounded-md p-3 my-2 overflow-x-auto">
                                <code className="text-xs">{children}</code>
                              </pre>
                            );
                          }
                          return <code className="bg-background/80 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                        },
                        pre: ({ children }) => <>{children}</>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-muted-foreground/50 pl-3 my-2 italic">{children}</blockquote>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Tool calls indicator */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {message.toolCalls.map((tc) => getToolCallDisplay(tc))}
                </div>
              )}

              {/* Search results */}
              {message.searchResults && message.searchResults.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t("foundExamples", { count: message.searchResults.length })}
                  </span>
                  {message.searchResults.map((prompt) => (
                    <MiniPromptCard key={prompt.id} prompt={prompt} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streamingContent && (
            <div className="text-sm mr-4">
              <div className="rounded-lg px-3 py-2 bg-muted">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
                <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
              </div>
            </div>
          )}

          {/* Loading indicator (when waiting for stream to start) */}
          {isLoading && !streamingContent && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("thinking")}</span>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Current state summary */}
      {(currentState.title || currentState.content) && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium">{t("currentPrompt")}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {currentState.title && (
              <Badge variant="secondary" className="text-[10px]">
                {t("stateTitle")}: {currentState.title.substring(0, 20)}
                {currentState.title.length > 20 ? "..." : ""}
              </Badge>
            )}
            {currentState.content && (
              <Badge variant="secondary" className="text-[10px]">
                {t("stateContent")}: {currentState.content.length} chars
              </Badge>
            )}
            {currentState.tagIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {currentState.tagIds.length} {t("stateTags")}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t">
        <div className="rounded-lg bg-muted/50 border px-2.5 py-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            className="min-h-[32px] max-h-[80px] resize-none text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Bot className="h-2.5 w-2.5" />
              <span>{modelName}</span>
            </div>
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 sm:h-6 sm:w-6 rounded-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 sm:h-3 sm:w-3 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4 sm:h-3 sm:w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
});
