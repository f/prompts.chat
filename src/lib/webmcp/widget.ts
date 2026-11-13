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
    const fail = (message: string) => {
      loading = null;
      script.remove();
      reject(new Error(message));
    };
    script.onload = () => (window.WebMCP ? resolve(window.WebMCP) : fail("WebMCP did not load"));
    script.onerror = () => fail(`Failed to load ${src}`);
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
  /** Shown when a token names a bridge that is not on this computer */
  localOnly: string;
}

/** The widget's sessionStorage entry for the current connection, which it reconnects to on load */
export const WIDGET_SESSION_KEY = "webmcp_token";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether a bridge URL points at this computer; the bridge only ever listens on localhost */
export function isLocalBridgeUrl(server: unknown): boolean {
  if (typeof server !== "string") return false;
  try {
    const url = new URL(server);
    return (url.protocol === "ws:" || url.protocol === "wss:") && LOOPBACK_HOSTS.has(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** The bridge URL inside a connection token (base64 JSON `{ server, token }`), or null */
export function connectionTokenServer(token: unknown): string | null {
  if (typeof token !== "string") return null;
  try {
    const data: unknown = JSON.parse(atob(token.trim()));
    return data && typeof data === "object" && typeof (data as { server?: unknown }).server === "string"
      ? (data as { server: string }).server
      : null;
  } catch {
    return null;
  }
}

/** Drops a stored connection to a bridge that is not local, so the widget cannot reconnect to it on load */
export function clearForeignConnection(storage: Pick<Storage, "getItem" | "removeItem">): void {
  const stored = storage.getItem(WIDGET_SESSION_KEY);
  if (!stored) return;
  try {
    if (isLocalBridgeUrl((JSON.parse(stored) as { server?: unknown }).server)) return;
  } catch {
    // unreadable: the widget would discard it too
  }
  storage.removeItem(WIDGET_SESSION_KEY);
}

/** The widget's connection methods (connect is public; _updateStatus only shows a status line) */
export interface ConnectableWidget {
  connect(token: string): unknown;
  _updateStatus?(status: string, message: string): void;
}

/**
 * Lets the widget connect only to a bridge on this computer. The token names the WebSocket server
 * to connect to, and whoever is connected can call every tool, including the signed-in user's
 * upvotes and collection, so a token for a remote server (say, one a stranger asked the user to
 * paste) must not be accepted.
 */
export function restrictToLocalBridge(widget: ConnectableWidget, message: string): void {
  const connect = widget.connect.bind(widget);
  widget.connect = (token: string) => {
    if (!isLocalBridgeUrl(connectionTokenServer(token))) {
      widget._updateStatus?.("disconnected", message);
      return Promise.resolve();
    }
    return connect(token);
  };
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
