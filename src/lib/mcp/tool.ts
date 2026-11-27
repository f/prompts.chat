import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ResourceLink, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { PromptWriteResult } from "@/lib/prompt-write";
import type { McpContext, McpUser } from "./context";

/** How a tool is rate limited: reads share the tool-call budget, writes and AI calls also have their own */
export type ToolKind = "read" | "write" | "ai";

const toolKinds = new Map<string, ToolKind | ((args: Record<string, unknown>) => ToolKind)>();

/** The kind a call is rate limited as; some tools depend on their arguments */
export function getToolKind(name: string, args: Record<string, unknown> = {}): ToolKind | undefined {
  const kind = toolKinds.get(name);
  return typeof kind === "function" ? kind(args) : kind;
}

/** Thrown from a tool handler to return a tool execution error the model can act on */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const AUTH_REQUIRED_MESSAGE = "Authentication required. Please provide an API key.";

/**
 * A successful result. The JSON is sent both as structuredContent and, for clients that predate
 * structured output, as a text block, followed by optional links to related resources.
 */
export function toolResult(data: Record<string, unknown>, links: ResourceLink[] = []): CallToolResult {
  const text = JSON.stringify(data);
  return {
    content: [{ type: "text", text }, ...links],
    structuredContent: JSON.parse(text),
  };
}

/** An error result: `{ error, code, ...details }`, where `error` is the human-readable message */
export function toolError(code: string, message: string, details: Record<string, unknown> = {}): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message, code, ...details }) }],
    isError: true,
  };
}

/** Turns a failed createPrompt/updatePrompt result into a ToolError carrying its code and details */
export function unwrapWriteResult<T>(result: PromptWriteResult<T>): T {
  if (result.ok) return result.data;
  const { error: code, message, ...details } = result.body;
  throw new ToolError(code, message, details);
}

type Shape = z.ZodRawShape;
type Args<S extends Shape> = z.output<z.ZodObject<S>>;

interface ToolDefinition<In extends Shape, Out extends Shape> {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  inputSchema: In;
  outputSchema?: Out;
  /** The kind a call is rate limited as, when it depends on the arguments; defaults to `kind` */
  rateLimitKind?: (args: Record<string, unknown>) => ToolKind;
  /** Hints beyond the ones derived from `kind` */
  annotations?: Pick<ToolAnnotations, "idempotentHint" | "destructiveHint" | "openWorldHint">;
  /** Message returned when the handler throws something other than a ToolError */
  failureMessage: string;
}

/** Registers a tool that anyone can call; `ctx.user` may be null */
export function defineTool<In extends Shape, Out extends Shape>(
  server: McpServer,
  ctx: McpContext,
  definition: ToolDefinition<In, Out> & { requiresAuth?: false },
  handler: (args: Args<In>, ctx: McpContext) => Promise<CallToolResult>
): void;
/** Registers a tool that needs an API key; the handler always gets a signed-in user */
export function defineTool<In extends Shape, Out extends Shape>(
  server: McpServer,
  ctx: McpContext,
  definition: ToolDefinition<In, Out> & { requiresAuth: true },
  handler: (args: Args<In>, ctx: McpContext & { user: McpUser }) => Promise<CallToolResult>
): void;
export function defineTool<In extends Shape, Out extends Shape>(
  server: McpServer,
  ctx: McpContext,
  definition: ToolDefinition<In, Out> & { requiresAuth?: boolean },
  handler: (args: Args<In>, ctx: McpContext & { user: McpUser }) => Promise<CallToolResult>
): void {
  const { name, title, description, kind, rateLimitKind, inputSchema, outputSchema, annotations, failureMessage, requiresAuth } = definition;
  toolKinds.set(name, rateLimitKind ?? kind);

  const callback = async (args: Args<In>): Promise<CallToolResult> => {
    if (requiresAuth && !ctx.user) return toolError("unauthorized", AUTH_REQUIRED_MESSAGE);
    try {
      return await handler(args, ctx as McpContext & { user: McpUser });
    } catch (error) {
      if (error instanceof ToolError) return toolError(error.code, error.message, error.details);
      console.error(`MCP ${name} error:`, error);
      return toolError("server_error", failureMessage);
    }
  };

  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      outputSchema,
      annotations: {
        title,
        readOnlyHint: kind === "read",
        ...(kind !== "read" && { destructiveHint: false }),
        openWorldHint: kind === "ai",
        ...annotations,
      },
    },
    callback as never
  );
}
