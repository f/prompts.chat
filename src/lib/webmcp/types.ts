import type { CallToolResult, GetPromptResult, ReadResourceResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult, GetPromptResult, ReadResourceResult };

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * One tool, in the shape shared by both registration paths: the webmcp.dev widget and the
 * browser's document.modelContext. Arguments arrive as plain JSON.
 */
export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  annotations?: Pick<ToolAnnotations, "title" | "readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint">;
  execute: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface WebMcpPromptArgument {
  name: string;
  description: string;
  required: boolean;
}

/** An MCP prompt; only the widget can offer prompts, document.modelContext has tools only */
export interface WebMcpPrompt {
  name: string;
  description: string;
  arguments: WebMcpPromptArgument[];
  get: (args: Record<string, string | undefined>) => Promise<GetPromptResult>;
}

/** An MCP resource or resource template; only the widget can offer resources */
export interface WebMcpResource {
  name: string;
  description: string;
  mimeType: string;
  uri?: string;
  uriTemplate?: string;
  read: (uri: string) => Promise<ReadResourceResult>;
}

/**
 * Everything the definitions need from the page, passed in so they stay free of React and of
 * globals and can be tested without a browser.
 */
export interface WebMcpEnv {
  fetch: typeof fetch;
  /** The current URL; read on every call, since the page navigates without reloading */
  location: () => URL;
  document: () => Document;
  /** Client-side navigation to a same-origin path; resolves once the URL has changed or after a timeout */
  navigate: (path: string) => Promise<void>;
  /** Re-renders server components after a write, so the page shows the new state */
  refresh: () => void;
  /** Stores the locale preference and reloads the page */
  setLocale: (locale: string) => void;
  locales: readonly string[];
}
