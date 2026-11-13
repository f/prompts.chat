import type { WebMcpWidget } from "./adapters";

/** Keep in sync with scripts/vendor-webmcp.mjs, which writes public/vendor/webmcp/webmcp-<version>.min.js */
export const WEBMCP_WIDGET_VERSION = "0.1.13";
export const WEBMCP_WIDGET_SRC = `/vendor/webmcp/webmcp-${WEBMCP_WIDGET_VERSION}.min.js`;

export interface WidgetOptions {
  color: string;
  position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  size: string;
  padding: string;
  inactivityTimeout: number;
}

type WidgetConstructor = new (options: Partial<WidgetOptions>) => WebMcpWidget;

declare global {
  interface Window {
    WebMCP?: WidgetConstructor;
  }
}

let loading: Promise<WidgetConstructor> | null = null;

/** Loads the vendored widget script once; it defines window.WebMCP */
export function loadWidgetScript(src: string = WEBMCP_WIDGET_SRC): Promise<WidgetConstructor> {
  if (window.WebMCP) return Promise.resolve(window.WebMCP);
  loading ??= new Promise<WidgetConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.webmcpScript = "";
    script.onload = () => (window.WebMCP ? resolve(window.WebMCP) : reject(new Error("WebMCP did not load")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface WidgetLabels {
  open: string;
  tokenPlaceholder: string;
  connect: string;
  disconnect: string;
  close: string;
}

/**
 * The widget builds its own DOM with English labels and a clickable <div> as its button; this
 * translates the labels and makes the trigger a keyboard-reachable button. Styling lives in
 * globals.css under [data-webmcp-widget].
 */
export function enhanceWidget(labels: WidgetLabels, root: ParentNode = document): HTMLElement | null {
  const container = root.querySelector<HTMLElement>("[data-webmcp-widget]");
  if (!container) return null;

  const trigger = container.querySelector<HTMLElement>(".webmcp-trigger");
  if (trigger) {
    trigger.setAttribute("role", "button");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("aria-label", labels.open);
    trigger.title = labels.open;
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trigger.click();
      }
    });
    // The widget marks a connection only by writing "✓" into the trigger; mirror it as an attribute for CSS
    const syncConnected = () => trigger.toggleAttribute("data-connected", (trigger.textContent ?? "").trim() !== "");
    new MutationObserver(syncConnected).observe(trigger, { childList: true, characterData: true, subtree: true });
    syncConnected();
  }
  const input = container.querySelector<HTMLInputElement>(".webmcp-token-input");
  if (input) {
    input.placeholder = labels.tokenPlaceholder;
    input.setAttribute("aria-label", labels.tokenPlaceholder);
    input.autocomplete = "off";
    input.spellcheck = false;
  }
  const connect = container.querySelector<HTMLElement>(".webmcp-connect-btn");
  if (connect) connect.textContent = labels.connect;
  const disconnect = container.querySelector<HTMLElement>(".webmcp-disconnect-btn");
  if (disconnect) disconnect.textContent = labels.disconnect;
  const close = container.querySelector<HTMLElement>(".webmcp-close");
  if (close) close.setAttribute("aria-label", labels.close);
  container.setAttribute("translate", "no");
  return container;
}
