import { NextRequest } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import {
  PROMPT_BUILDER_TOOLS,
  executeToolCall,
  type PromptBuilderState,
} from "@/lib/ai/prompt-builder-tools";
import { loadPrompt, getSystemPrompt } from "@/lib/ai/load-prompt";

const promptBuilderAgentPrompt = loadPrompt("src/app/api/prompt-builder/chat/prompt-builder-agent.prompt.yml");

const GENERATIVE_MODEL = process.env.OPENAI_GENERATIVE_MODEL || "gpt-4o-mini";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per user

// In-memory rate limit store (resets on server restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetAt - now };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count, resetIn: userLimit.resetAt - now };
}

const SYSTEM_PROMPT = getSystemPrompt(promptBuilderAgentPrompt);

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  toolResults?: Array<{
    id: string;
    result: unknown;
  }>;
}

interface RequestBody {
  messages: ChatMessage[];
  currentState: PromptBuilderState;
  availableTags: Array<{ id: string; name: string; slug: string; color: string }>;
  availableCategories: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
}

/**
 * Authenticates a prompt-builder request and streams the model response and tool results.
 * @param request Incoming conversation, prompt state, and available taxonomy data.
 * @returns An authorization/configuration error response or a server-sent event stream.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check rate limit
  const userId = session.user.id || session.user.email || "anonymous";
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: "Rate limit exceeded. Please try again later.",
      resetIn: Math.ceil(rateLimit.resetIn / 1000)
    }), {
      status: 429,
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000)),
      },
    });
  }

  const config = await getConfig();
  if (!config.features.aiGeneration) {
    return new Response(JSON.stringify({ error: "AI generation is not enabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: RequestBody = await request.json();
  const { messages, currentState, availableTags, availableCategories } = body;

  // Create a streaming response using TransformStream for better Node.js compatibility
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const close = async () => {
    try {
      await writer.close();
    } catch {
      // The client may have disconnected and closed the stream already.
    }
  };

  // The form represents structured input as TEXT plus a format selector.
  const toClientState = (state: PromptBuilderState): PromptBuilderState => ({
    ...state,
    type: state.type === "STRUCTURED" ? "TEXT" : state.type,
  });

  let pendingStructuredConfiguration = false;
  let committedContentConfiguration = {
    content: currentState.content,
    type: currentState.type,
    structuredFormat: currentState.structuredFormat,
  };
  const toCheckpointState = (state: PromptBuilderState): PromptBuilderState => {
    if (!pendingStructuredConfiguration) return toClientState(state);
    return toClientState({ ...state, ...committedContentConfiguration });
  };

  // Start processing in background
  void (async () => {

    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      });

      // Build available tags and categories context
      const tagNames = availableTags.map(t => t.name).join(", ");
      const categoryNames = availableCategories.map(c => c.name).join(", ");
        
      const availableContext = `

AVAILABLE TAGS (use exact names with set_tags):
${tagNames || "(none)"}

AVAILABLE CATEGORIES (use exact names with set_category):
${categoryNames || "(none)"}`;

      // Build system message with current state context
      const hasContent = currentState.title || currentState.content || currentState.description;
      const selectedTagNames = currentState.tagIds
        .map(id => availableTags.find(t => t.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const selectedCategoryName = availableCategories.find(c => c.id === currentState.categoryId)?.name;
      
      const stateContext = hasContent ? `

CURRENT PROMPT STATE:
- Title: ${currentState.title || "(not set)"}
- Description: ${currentState.description || "(not set)"}
- Content (FULL - DO NOT SHORTEN):
${currentState.content || "(not set)"}
- Type: ${currentState.type}
- Tags: ${selectedTagNames || "(none)"}
- Category: ${selectedCategoryName || "(none)"}
- Private: ${currentState.isPrivate}

CRITICAL: When editing content, you MUST preserve the FULL content above. Do NOT shorten, summarize, or truncate it. Only make the specific changes the user requested while keeping everything else exactly the same.` : "";

      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT + availableContext + stateContext },
      ];

      for (const msg of messages) {
        if (msg.role === "user") {
          openaiMessages.push({ role: "user", content: msg.content });
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            openaiMessages.push({
              role: "assistant",
              content: msg.content || null,
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              })),
            });

            if (msg.toolResults) {
              for (const tr of msg.toolResults) {
                openaiMessages.push({
                  role: "tool",
                  tool_call_id: tr.id,
                  content: JSON.stringify(tr.result),
                });
              }
            }
          } else {
            openaiMessages.push({ role: "assistant", content: msg.content });
          }
        }
      }

      // Agentic loop with streaming
      let state = { ...currentState };
      let loopCount = 0;
      const maxLoops = 10;
      const allToolCalls: Array<{ id: string; name: string; arguments: string; result: unknown }> = [];

      while (loopCount < maxLoops && !request.signal.aborted) {
        loopCount++;

        // Use streaming for the final response
        const response = await openai.chat.completions.create({
          model: GENERATIVE_MODEL,
          messages: openaiMessages,
          tools: PROMPT_BUILDER_TOOLS,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }, { signal: request.signal });

        let fullContent = "";
        const toolCallsAccumulator: Map<number, { id: string; name: string; arguments: string }> = new Map();

        for await (const chunk of response) {
          if (request.signal.aborted) throw new Error("Request aborted");
          const delta = chunk.choices[0]?.delta;

          // Stream text content
          if (delta?.content) {
            fullContent += delta.content;
            await send({ type: "text", content: delta.content });
          }

          // Accumulate tool calls - handle streaming chunks properly
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              const existing = toolCallsAccumulator.get(idx);
              
              if (existing) {
                // Append to existing tool call
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              } else {
                // Create new tool call entry
                toolCallsAccumulator.set(idx, {
                  id: tc.id || "",
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "",
                });
              }
            }
          }
        }

        // Filter for valid tool calls (must have id and name)
        const toolCalls = Array.from(toolCallsAccumulator.values()).filter(tc => tc.id && tc.name);

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          await send({ type: "state", state: toCheckpointState(state) });
          await send({ type: "done" });
          await writer.write(encoder.encode("data: [DONE]\n\n"));
          await close();
          return;
        }

        // Process tool calls
        const toolResults: Array<{ id: string; name: string; result: unknown }> = [];
        let toolExecutionFailed = false;

        for (const toolCall of toolCalls) {
          if (request.signal.aborted) {
            await close();
            return;
          }

          let result: unknown;
          let nextState: PromptBuilderState;
          try {
            const args = JSON.parse(toolCall.arguments);
            const execution = await executeToolCall(
              toolCall.name,
              args,
              state,
              availableTags,
              availableCategories,
              request.signal
            );
            result = execution.result;
            nextState = execution.newState;
          } catch (e) {
            if (request.signal.aborted) {
              await close();
              return;
            }
            console.error(`Prompt builder tool ${toolCall.name} failed:`, e);
            const failedToolCall = {
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments,
              result: { success: false, error: "Tool execution failed" },
            };
            allToolCalls.push(failedToolCall);
            await send({
              type: "tool_error",
              toolCall: failedToolCall,
              state: toCheckpointState(state),
            });
            toolExecutionFailed = true;
            break;
          }

          if (request.signal.aborted) {
            await close();
            return;
          }

          if (toolCall.name === "set_type") {
            const changesStructuredConfiguration =
              (state.type === "STRUCTURED") !== (nextState.type === "STRUCTURED") ||
              state.structuredFormat !== nextState.structuredFormat;
            if (changesStructuredConfiguration) {
              if (!pendingStructuredConfiguration) {
                committedContentConfiguration = {
                  content: state.content,
                  type: state.type,
                  structuredFormat: state.structuredFormat,
                };
              }
              pendingStructuredConfiguration = true;
            }
          }

          state = nextState;
          if (toolCall.name === "set_content") {
            committedContentConfiguration = {
              content: state.content,
              type: state.type,
              structuredFormat: state.structuredFormat,
            };
            pendingStructuredConfiguration = false;
          }
          const toolCallResult = {
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
            result,
          };

          toolResults.push({ id: toolCall.id, name: toolCall.name, result });
          allToolCalls.push(toolCallResult);

          // Stream each successful result as a recoverable state checkpoint.
          await send({ type: "tool_call", toolCall: toolCallResult, state: toCheckpointState(state) });
        }

        if (request.signal.aborted) {
          await close();
          return;
        }

        if (toolExecutionFailed) {
          await send({ type: "state", state: toCheckpointState(state) });
          await send({ type: "done" });
          await writer.write(encoder.encode("data: [DONE]\n\n"));
          await close();
          return;
        }

        // Add assistant message with tool calls to conversation
        openaiMessages.push({
          role: "assistant",
          content: fullContent || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        });

        // Add tool results
        for (const tr of toolResults) {
          openaiMessages.push({
            role: "tool",
            tool_call_id: tr.id,
            content: JSON.stringify(tr.result),
          });
        }
      }

      if (request.signal.aborted) {
        await close();
        return;
      }

      // Max loops reached
      await send({ type: "text", content: "I've made several changes. Let me know if you need anything else!" });
      await send({ type: "state", state: toCheckpointState(state) });
      await send({ type: "done" });
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      await close();
    } catch (error) {
      if (request.signal.aborted) {
        await close();
        return;
      }
      console.error("Prompt builder chat error:", error);
      try {
        await send({ type: "error", error: "Failed to process request" });
      } catch {
        // Error reporting can also fail after the client disconnects.
      }
      await close();
    }
  })().catch(async (error) => {
    // Keep unexpected failures from escaping the detached stream task.
    console.error("Prompt builder stream task error:", error);
    await close();
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
