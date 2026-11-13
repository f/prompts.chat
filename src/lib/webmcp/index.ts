import { getModelContext, registerWithModelContext, registerWithWidget, type WebMcpWidget } from "./adapters";
import { createPrompts } from "./prompts";
import { createResources } from "./resources";
import { createTools } from "./tools";
import type { WebMcpEnv } from "./types";
import {
  clearForeignConnection,
  enhanceWidget,
  loadWidgetScript,
  restrictToLocalBridge,
  type ConnectableWidget,
  type WidgetLabels,
} from "./widget";

export type { WebMcpEnv } from "./types";
export type { WidgetLabels } from "./widget";

export interface StartOptions {
  /** Widget color; the site's primary color */
  color: string;
  labels: WidgetLabels;
}

/** Resolves to true once `condition` holds, or to false after `timeout` ms */
export async function waitUntil(condition: () => boolean, timeout: number, interval = 50): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return true;
}

/** Resolves once the URL shows `path`, or after `timeout` ms, so tools can report the page they opened */
export async function waitForPath(getUrl: () => URL, path: string, timeout = 5000, interval = 50): Promise<boolean> {
  const target = new URL(path, getUrl().origin);
  const matches = await waitUntil(
    () => {
      const url = getUrl();
      return url.pathname === target.pathname && url.search === target.search;
    },
    timeout,
    interval
  );
  if (matches) await new Promise((resolve) => setTimeout(resolve, 150));
  return matches;
}

let started: Promise<void> | null = null;

/**
 * Registers the same tools with the browser's model context (when the browser has one) and with
 * the webmcp.dev widget, which also offers prompts and resources. Runs once per page load; the
 * tools read the current route on each call, so they keep working across client navigations.
 */
export function startWebMcp(env: WebMcpEnv, options: StartOptions): Promise<void> {
  started ??= (async () => {
    const tools = await createTools(env);

    const modelContext = getModelContext({ document, navigator });
    if (modelContext) await registerWithModelContext(modelContext, tools);

    const WebMCP = await loadWidgetScript();
    if (document.querySelector("[data-webmcp-widget]")) return;
    // The constructor reconnects to a stored connection before restrictToLocalBridge can wrap connect()
    clearForeignConnection(sessionStorage);
    const widget = new WebMCP({
      color: options.color,
      position: "bottom-left",
      size: "40px",
      padding: "16px",
      // Disconnects after this long without user input; agent tool calls do not count as activity
      inactivityTimeout: 30 * 60 * 1000,
    });
    restrictToLocalBridge(widget as WebMcpWidget & ConnectableWidget, options.labels.localOnly);
    enhanceWidget(options.labels);
    registerWithWidget(widget, { tools, prompts: createPrompts(env), resources: createResources(env) });
  })().catch((error) => {
    started = null;
    throw error;
  });
  return started;
}
