import type { WebMcpPrompt, WebMcpResource, WebMcpTool } from "./types";

/** The public API of the webmcp.dev widget (public/vendor/webmcp) */
export interface WebMcpWidget {
  registerTool(name: string, description: string, schema: object, execute: (args: Record<string, unknown>) => unknown): void;
  registerPrompt(
    name: string,
    description: string,
    args: { name: string; description: string; required: boolean }[],
    execute: (args: Record<string, string | undefined>) => unknown
  ): void;
  registerResource(
    name: string,
    description: string,
    options: { uri?: string; uriTemplate?: string; mimeType?: string },
    provide: (uri: string) => unknown
  ): void;
}

export function registerWithWidget(
  widget: WebMcpWidget,
  { tools, prompts, resources }: { tools: WebMcpTool[]; prompts: WebMcpPrompt[]; resources: WebMcpResource[] }
): void {
  for (const tool of tools) {
    widget.registerTool(tool.name, tool.description, tool.inputSchema, (args) => tool.execute(args ?? {}));
  }
  for (const prompt of prompts) {
    widget.registerPrompt(prompt.name, prompt.description, prompt.arguments, (args) => prompt.get(args ?? {}));
  }
  for (const resource of resources) {
    const { uri, uriTemplate, mimeType } = resource;
    widget.registerResource(resource.name, resource.description, { uri, uriTemplate, mimeType }, (requested) => resource.read(requested));
  }
}

/**
 * The browser's WebMCP API from the W3C Web Machine Learning CG draft: document.modelContext, or
 * navigator.modelContext in earlier previews and polyfills. Only tool registration is used.
 */
export interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations?: object;
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal }
  ): unknown;
  unregisterTool?(name: string): unknown;
}

export function getModelContext(scope: { document?: unknown; navigator?: unknown }): ModelContext | null {
  for (const owner of [scope.document, scope.navigator]) {
    const context = (owner as { modelContext?: ModelContext } | undefined)?.modelContext;
    if (context && typeof context.registerTool === "function") return context;
  }
  return null;
}

/**
 * Registers every tool with the browser's model context. Returns a cleanup that unregisters them:
 * by aborting the signal (current draft), else through the handle or unregisterTool of older APIs.
 */
export async function registerWithModelContext(
  modelContext: ModelContext,
  tools: WebMcpTool[]
): Promise<{ registered: string[]; failed: string[]; unregister: () => void }> {
  const controller = new AbortController();
  const handles: unknown[] = [];
  const registered: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    tools.map(async (tool) => {
      try {
        const handle = await modelContext.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations && { annotations: tool.annotations }),
            execute: (args) => tool.execute(args ?? {}),
          },
          { signal: controller.signal }
        );
        handles.push(handle);
        registered.push(tool.name);
      } catch {
        failed.push(tool.name);
      }
    })
  );

  return {
    registered,
    failed,
    unregister: () => {
      controller.abort();
      for (const handle of handles) {
        const unregister = (handle as { unregister?: () => void } | undefined)?.unregister;
        if (typeof unregister === "function") unregister.call(handle);
      }
      if (handles.every((handle) => handle === undefined) && modelContext.unregisterTool) {
        for (const name of registered) {
          try {
            modelContext.unregisterTool(name);
          } catch {
            // Already gone
          }
        }
      }
    },
  };
}
