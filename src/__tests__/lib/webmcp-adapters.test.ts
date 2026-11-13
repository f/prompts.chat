import { describe, it, expect, vi, beforeEach } from "vitest";
import { getModelContext, registerWithModelContext, registerWithWidget, type ModelContext, type WebMcpWidget } from "@/lib/webmcp/adapters";
import { waitForPath, waitUntil } from "@/lib/webmcp";
import {
  clearForeignConnection,
  connectionTokenServer,
  enhanceWidget,
  isLocalBridgeUrl,
  loadWidgetScript,
  restrictToLocalBridge,
  WEBMCP_WIDGET_SRC,
  WEBMCP_WIDGET_VERSION,
  WIDGET_SESSION_KEY,
} from "@/lib/webmcp/widget";
import type { WebMcpPrompt, WebMcpResource, WebMcpTool } from "@/lib/webmcp/types";

function tool(name: string): WebMcpTool {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: vi.fn(async (args) => ({ content: [{ type: "text" as const, text: JSON.stringify({ name, args }) }] })),
  };
}

describe("registerWithWidget", () => {
  it("registers tools, prompts and resources with the widget's API", async () => {
    const widget = { registerTool: vi.fn(), registerPrompt: vi.fn(), registerResource: vi.fn() } satisfies WebMcpWidget;
    const prompt: WebMcpPrompt = {
      name: "use_prompt",
      description: "Use",
      arguments: [{ name: "prompt", description: "Slug", required: true }],
      get: vi.fn(async () => ({ messages: [] })),
    };
    const resource: WebMcpResource = {
      name: "prompts",
      description: "Prompt",
      uriTemplate: "prompts-chat://prompts/{id}",
      mimeType: "text/markdown",
      read: vi.fn(async (uri) => ({ contents: [{ uri, text: "x" }] })),
    };
    const search = tool("search_prompts");

    registerWithWidget(widget, { tools: [search], prompts: [prompt], resources: [resource] });

    expect(widget.registerTool).toHaveBeenCalledWith("search_prompts", "Tool search_prompts", search.inputSchema, expect.any(Function));
    expect(widget.registerPrompt).toHaveBeenCalledWith("use_prompt", "Use", prompt.arguments, expect.any(Function));
    expect(widget.registerResource).toHaveBeenCalledWith(
      "prompts",
      "Prompt",
      { uri: undefined, uriTemplate: "prompts-chat://prompts/{id}", mimeType: "text/markdown" },
      expect.any(Function)
    );

    await widget.registerTool.mock.calls[0][3](undefined);
    expect(search.execute).toHaveBeenCalledWith({});
    await widget.registerPrompt.mock.calls[0][3]({ prompt: "x" });
    expect(prompt.get).toHaveBeenCalledWith({ prompt: "x" });
    await widget.registerResource.mock.calls[0][3]("prompts-chat://prompts/1");
    expect(resource.read).toHaveBeenCalledWith("prompts-chat://prompts/1");
  });
});

describe("getModelContext", () => {
  const context = (): ModelContext => ({ registerTool: vi.fn() });

  it("prefers document.modelContext, then navigator.modelContext", () => {
    const fromDocument = context();
    const fromNavigator = context();
    expect(getModelContext({ document: { modelContext: fromDocument }, navigator: { modelContext: fromNavigator } })).toBe(fromDocument);
    expect(getModelContext({ document: {}, navigator: { modelContext: fromNavigator } })).toBe(fromNavigator);
  });

  it("is null when the browser has no WebMCP", () => {
    expect(getModelContext({ document: {}, navigator: {} })).toBeNull();
    expect(getModelContext({ document: { modelContext: {} } })).toBeNull();
  });
});

describe("registerWithModelContext", () => {
  it("registers every tool with a shared abort signal and runs them", async () => {
    const registerTool = vi.fn<ModelContext["registerTool"]>(async () => undefined);
    const tools = [tool("a"), tool("b")];
    const { registered, failed, unregister } = await registerWithModelContext({ registerTool }, tools);

    expect(registered.sort()).toEqual(["a", "b"]);
    expect(failed).toEqual([]);
    const [definition, options] = registerTool.mock.calls[0];
    expect(definition).toMatchObject({ name: "a", description: "Tool a", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } });
    await definition.execute({ x: 1 });
    expect(tools[0].execute).toHaveBeenCalledWith({ x: 1 });

    const signal = options!.signal!;
    expect(registerTool.mock.calls[1][1]!.signal).toBe(signal);
    expect(signal.aborted).toBe(false);
    unregister();
    expect(signal.aborted).toBe(true);
  });

  it("keeps going when one registration is refused", async () => {
    const registerTool = vi.fn<ModelContext["registerTool"]>(async (definition) => {
      if (definition.name === "b") throw new DOMException("Not allowed", "NotAllowedError");
    });
    const result = await registerWithModelContext({ registerTool }, [tool("a"), tool("b")]);
    expect(result).toMatchObject({ registered: ["a"], failed: ["b"] });
  });

  it("unregisters through the handles or unregisterTool of older APIs", async () => {
    const handle = { unregister: vi.fn() };
    const withHandles = await registerWithModelContext({ registerTool: vi.fn(() => handle) }, [tool("a")]);
    withHandles.unregister();
    expect(handle.unregister).toHaveBeenCalled();

    const unregisterTool = vi.fn();
    const withName = await registerWithModelContext({ registerTool: vi.fn(), unregisterTool }, [tool("a")]);
    withName.unregister();
    expect(unregisterTool).toHaveBeenCalledWith("a");
  });
});

describe("widget", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete window.WebMCP;
  });

  it("serves the vendored widget from this origin", () => {
    expect(WEBMCP_WIDGET_SRC).toBe(`/vendor/webmcp/webmcp-${WEBMCP_WIDGET_VERSION}.min.js`);
  });

  it("loads the script once and resolves to window.WebMCP", async () => {
    const first = loadWidgetScript("/w.js");
    const second = loadWidgetScript("/w.js");
    const scripts = document.head.querySelectorAll("script[data-webmcp-script]");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe("/w.js");

    class FakeWidget {}
    window.WebMCP = FakeWidget as never;
    scripts[0].dispatchEvent(new Event("load"));
    expect(await first).toBe(FakeWidget);
    expect(await second).toBe(FakeWidget);
    expect(await loadWidgetScript("/other.js")).toBe(FakeWidget);
  });

  it("translates the widget and makes its trigger an accessible button", () => {
    document.body.innerHTML = `
      <div data-webmcp-widget="true">
        <div class="webmcp-content">
          <button class="webmcp-close">×</button>
          <input class="webmcp-token-input" placeholder="Paste connection token">
          <button class="webmcp-connect-btn">Connect</button>
          <button class="webmcp-disconnect-btn">Disconnect</button>
        </div>
        <div class="webmcp-trigger"></div>
      </div>`;
    const container = enhanceWidget({ open: "KI-Agenten verbinden", tokenPlaceholder: "Token einfügen", connect: "Verbinden", disconnect: "Trennen", close: "Schließen", localOnly: "Nur lokal" });

    expect(container?.getAttribute("translate")).toBe("no");
    const trigger = document.querySelector<HTMLElement>(".webmcp-trigger")!;
    expect(trigger.getAttribute("role")).toBe("button");
    expect(trigger.getAttribute("tabindex")).toBe("0");
    expect(trigger.getAttribute("aria-label")).toBe("KI-Agenten verbinden");
    expect(document.querySelector<HTMLInputElement>(".webmcp-token-input")!.placeholder).toBe("Token einfügen");
    expect(document.querySelector(".webmcp-connect-btn")!.textContent).toBe("Verbinden");
    expect(document.querySelector(".webmcp-disconnect-btn")!.textContent).toBe("Trennen");
    expect(document.querySelector(".webmcp-close")!.getAttribute("aria-label")).toBe("Schließen");

    const click = vi.fn();
    trigger.addEventListener("click", click);
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("marks the trigger while the widget is connected", async () => {
    document.body.innerHTML = '<div data-webmcp-widget="true"><div class="webmcp-trigger"></div></div>';
    enhanceWidget({ open: "", tokenPlaceholder: "", connect: "", disconnect: "", close: "", localOnly: "" });
    const trigger = document.querySelector<HTMLElement>(".webmcp-trigger")!;
    expect(trigger.hasAttribute("data-connected")).toBe(false);

    trigger.innerHTML = "✓";
    await Promise.resolve();
    expect(trigger.hasAttribute("data-connected")).toBe(true);

    trigger.innerHTML = "";
    await Promise.resolve();
    expect(trigger.hasAttribute("data-connected")).toBe(false);
  });

  it("is a no-op without the widget", () => {
    expect(enhanceWidget({ open: "", tokenPlaceholder: "", connect: "", disconnect: "", close: "", localOnly: "" })).toBeNull();
  });
});

describe("local bridge only", () => {
  const token = (server: string) => btoa(JSON.stringify({ server, token: "abc" }));

  it.each(["ws://localhost:4797", "ws://127.0.0.1:4797", "wss://localhost:4797", "ws://[::1]:4797/"])("accepts %s", (server) => {
    expect(isLocalBridgeUrl(server)).toBe(true);
  });

  it.each([
    "wss://evil.example:4797",
    "ws://localhost.evil.example:4797",
    "ws://user:pass@localhost:4797",
    "http://localhost:4797",
    "ws://192.168.1.10:4797",
    "",
    undefined,
  ])("refuses %s", (server) => {
    expect(isLocalBridgeUrl(server)).toBe(false);
  });

  it("reads the server from a connection token", () => {
    expect(connectionTokenServer(` ${token("ws://localhost:4797")}\n`)).toBe("ws://localhost:4797");
    expect(connectionTokenServer("not a token")).toBeNull();
    expect(connectionTokenServer(btoa("{}"))).toBeNull();
  });

  it("only lets tokens for a local bridge through to the widget", async () => {
    const connect = vi.fn<(token: string) => Promise<void>>(async () => undefined);
    const widget = { connect, _updateStatus: vi.fn() };
    restrictToLocalBridge(widget, "Local only");

    await widget.connect(token("wss://evil.example:4797"));
    expect(connect).not.toHaveBeenCalled();
    expect(widget._updateStatus).toHaveBeenCalledWith("disconnected", "Local only");

    await widget.connect(token("ws://localhost:4797"));
    expect(connect).toHaveBeenCalledWith(token("ws://localhost:4797"));
  });

  it("forgets a stored connection to a remote bridge before the widget reconnects to it", () => {
    sessionStorage.setItem(WIDGET_SESSION_KEY, JSON.stringify({ server: "wss://evil.example:4797", token: "t" }));
    clearForeignConnection(sessionStorage);
    expect(sessionStorage.getItem(WIDGET_SESSION_KEY)).toBeNull();

    const local = JSON.stringify({ server: "ws://localhost:4797", token: "t" });
    sessionStorage.setItem(WIDGET_SESSION_KEY, local);
    clearForeignConnection(sessionStorage);
    expect(sessionStorage.getItem(WIDGET_SESSION_KEY)).toBe(local);
    sessionStorage.clear();
  });
});

describe("waitForPath", () => {
  it("resolves once the URL matches", async () => {
    let url = new URL("https://prompts.chat/");
    setTimeout(() => (url = new URL("https://prompts.chat/tags/x?q=1")), 20);
    expect(await waitForPath(() => url, "/tags/x?q=1", 1000, 5)).toBe(true);
  });

  it("gives up after the timeout", async () => {
    const url = new URL("https://prompts.chat/");
    expect(await waitForPath(() => url, "/never", 30, 5)).toBe(false);
  });

  it("waitUntil reports whether the condition was met in time", async () => {
    let ready = false;
    setTimeout(() => (ready = true), 10);
    expect(await waitUntil(() => ready, 1000, 5)).toBe(true);
    expect(await waitUntil(() => false, 20, 5)).toBe(false);
  });
});
