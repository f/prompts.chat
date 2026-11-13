import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROMPT_STATE_EVENT } from "@/lib/prompt-state";
import { createPrompts } from "@/lib/webmcp/prompts";
import { createResources, CURRENT_ITEM_RESOURCE_URI, PAGE_RESOURCE_URI } from "@/lib/webmcp/resources";
import { McpRequestError, mcpRequest, toolData, type ServerTool } from "@/lib/webmcp/server-client";
import { createTools, mirrorServerTools, pageTools, PROXIED_SERVER_TOOLS } from "@/lib/webmcp/tools";
import type { CallToolResult, WebMcpEnv, WebMcpTool } from "@/lib/webmcp/types";

const ORIGIN = "https://prompts.chat";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function ok(data: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
}

interface FakeSite {
  env: WebMcpEnv;
  fetch: ReturnType<typeof vi.fn>;
  rpc: { method: string; params?: Record<string, unknown> }[];
  /** Results of tools/call by tool name */
  tools: Record<string, (args: Record<string, unknown>) => CallToolResult>;
  /** Other endpoints by "METHOD /path" */
  routes: Record<string, (init: RequestInit) => Response>;
  serverTools: ServerTool[];
  setPath: (path: string) => void;
}

function serverTool(name: string, readOnly = true): ServerTool {
  return {
    name,
    title: name.replace(/_/g, " "),
    description: `Server ${name}`,
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], $schema: "http://json-schema.org/draft-07/schema#" },
    annotations: { readOnlyHint: readOnly },
  };
}

function fakeSite(path = "/"): FakeSite {
  let url = new URL(path, ORIGIN);
  const site: FakeSite = {
    rpc: [],
    tools: {},
    routes: {},
    serverTools: [...PROXIED_SERVER_TOOLS.map((name) => serverTool(name)), serverTool("save_prompt", false), serverTool("improve_prompt", false)],
    setPath: (p) => {
      url = new URL(p, ORIGIN);
    },
    fetch: vi.fn(),
    env: undefined as unknown as WebMcpEnv,
  };
  site.fetch.mockImplementation(async (input: string, init: RequestInit = {}) => {
    if (input === "/api/mcp") {
      const body = JSON.parse(String(init.body));
      site.rpc.push({ method: body.method, params: body.params });
      switch (body.method) {
        case "tools/list":
          return json({ jsonrpc: "2.0", id: body.id, result: { tools: site.serverTools } });
        case "tools/call": {
          const handler = site.tools[body.params.name];
          if (!handler) return json({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: `Tool ${body.params.name} not found` } });
          return json({ jsonrpc: "2.0", id: body.id, result: handler(body.params.arguments) });
        }
        case "prompts/get":
          return json({ jsonrpc: "2.0", id: body.id, result: { messages: [{ role: "user", content: { type: "text", text: `${body.params.name}:${JSON.stringify(body.params.arguments)}` } }] } });
        case "resources/read":
          return json({ jsonrpc: "2.0", id: body.id, result: { contents: [{ uri: body.params.uri, mimeType: "text/markdown", text: "# From server" }] } });
      }
    }
    const route = site.routes[`${init.method ?? "GET"} ${input}`];
    return route ? route(init) : json({ error: "not_found" }, 404);
  });
  site.env = {
    fetch: site.fetch as unknown as typeof fetch,
    location: () => url,
    document: () => document,
    navigate: vi.fn(async (p: string) => site.setPath(p)),
    refresh: vi.fn(),
    setLocale: vi.fn(),
    locales: ["en", "de", "ar"],
  };
  return site;
}

function find(tools: WebMcpTool[], name: string): WebMcpTool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`No tool ${name}`);
  return tool;
}

async function run(site: FakeSite, name: string, args: Record<string, unknown> = {}) {
  const result = await find(pageTools(site.env), name).execute(args);
  return { result, data: toolData(result) ?? {} };
}

describe("mcpRequest", () => {
  it("posts JSON-RPC to /api/mcp and returns the result", async () => {
    const site = fakeSite();
    const result = await mcpRequest<{ tools: ServerTool[] }>(site.env, "tools/list");
    expect(result.tools).toHaveLength(PROXIED_SERVER_TOOLS.length + 2);
    const [, init] = site.fetch.mock.calls[0];
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" } });
    expect(JSON.parse(init.body)).toMatchObject({ jsonrpc: "2.0", method: "tools/list" });
  });

  it("throws JSON-RPC and HTTP errors", async () => {
    const site = fakeSite();
    site.fetch.mockResolvedValueOnce(json({ jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded" } }, 429));
    await expect(mcpRequest(site.env, "tools/list")).rejects.toMatchObject({ message: "Rate limit exceeded", status: 429 });
    site.fetch.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    await expect(mcpRequest(site.env, "tools/list")).rejects.toBeInstanceOf(McpRequestError);
  });
});

describe("mirrorServerTools", () => {
  it("offers only the allowlisted read-only server tools, with their schemas", () => {
    const site = fakeSite();
    const tools = mirrorServerTools(site.env, site.serverTools);
    expect(tools.map((t) => t.name)).toEqual([...PROXIED_SERVER_TOOLS]);
    const search = find(tools, "search_prompts");
    expect(search.inputSchema).toMatchObject({ type: "object", properties: { query: { type: "string" } }, required: ["query"] });
    expect(search.description).toMatch(/^Server search_prompts Through WebMCP/);
    expect(search.annotations).toMatchObject({ readOnlyHint: true });
  });

  it("drops an allowlisted tool the server no longer marks read-only", () => {
    const site = fakeSite();
    expect(mirrorServerTools(site.env, [serverTool("get_prompt", false)])).toEqual([]);
  });

  it("forwards calls to the server tool", async () => {
    const site = fakeSite();
    site.tools.search_prompts = (args) => ok({ echoed: args });
    const result = await find(mirrorServerTools(site.env, site.serverTools), "search_prompts").execute({ query: "poem" });
    expect(toolData(result)).toEqual({ echoed: { query: "poem" } });
  });

  it("returns a tool error when the server call fails", async () => {
    const site = fakeSite();
    const result = await find(mirrorServerTools(site.env, site.serverTools), "get_bot").execute({ id: "x" });
    expect(result.isError).toBe(true);
    expect(toolData(result)).toMatchObject({ error: "Tool get_bot not found" });
  });
});

describe("createTools", () => {
  it("combines page tools and server tools", async () => {
    const site = fakeSite();
    const names = (await createTools(site.env)).map((t) => t.name);
    expect(names).toEqual([
      "get_current_page",
      "get_current_item",
      "fill_prompt_variables",
      "navigate",
      "show_search_results",
      "change_language",
      "get_signed_in_user",
      "upvote_prompt",
      "save_prompt_to_collection",
      ...PROXIED_SERVER_TOOLS,
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps the page tools when /api/mcp is unavailable", async () => {
    const site = fakeSite();
    site.fetch.mockResolvedValueOnce(json({ error: "MCP is not enabled" }, 404));
    const tools = await createTools(site.env);
    expect(tools).toHaveLength(pageTools(site.env).length);
  });

  it("stops waiting for a stalled /api/mcp and cancels the request", async () => {
    const site = fakeSite();
    let signal: AbortSignal | undefined;
    site.fetch.mockImplementationOnce(
      (_input: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          signal = init.signal ?? undefined;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
    );
    const tools = await createTools(site.env, 20);
    expect(tools).toHaveLength(pageTools(site.env).length);
    expect(signal?.aborted).toBe(true);
  });

  it("describes every tool with an object schema and annotations", async () => {
    for (const tool of await createTools(fakeSite().env)) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.annotations?.readOnlyHint).toBeTypeOf("boolean");
    }
  });
});

describe("page tools", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "Poems | prompts.chat";
    document.documentElement.lang = "fr";
    document.body.innerHTML = "<main><h1>Poems</h1><p>Hello</p></main>";
  });

  it("get_current_page reads the open page", async () => {
    const site = fakeSite("/tags/poetry");
    const { data } = await run(site, "get_current_page", { maxLength: 1000 });
    expect(data).toMatchObject({ title: "Poems | prompts.chat", locale: "fr", route: { kind: "tag", slug: "poetry" }, text: "# Poems\n\nHello" });
  });

  describe("get_current_item", () => {
    it.each([
      ["/bots/bot1_helper", "get_bot", { id: "bot1" }],
      ["/bots/teams/crew", "get_team", { slug: "crew" }],
      ["/classifiers/ticket-router", "get_classifier", { slug: "ticket-router" }],
      ["/categories/coding", "search_prompts", { query: "", category: "coding" }],
      ["/tags/python", "search_prompts", { query: "", tag: "python" }],
    ])("on %s calls %s", async (path, tool, args) => {
      const site = fakeSite(path);
      site.tools[tool] = (received) => ok({ tool, received });
      expect((await run(site, "get_current_item")).data).toEqual({ tool, received: args });
    });

    it("returns a prompt", async () => {
      const site = fakeSite("/prompts/p1_poem");
      site.tools.get_prompt = () => ok({ id: "p1", type: "TEXT" });
      expect((await run(site, "get_current_item")).data).toEqual({ id: "p1", type: "TEXT" });
    });

    it("returns every file of a skill", async () => {
      const site = fakeSite("/prompts/s1_pdf");
      site.tools.get_prompt = () => ok({ id: "s1", type: "SKILL" });
      site.tools.get_skill = (args) => ok({ skill: args.id, files: [] });
      expect((await run(site, "get_current_item")).data).toEqual({ skill: "s1", files: [] });
    });

    it("explains when the page shows no item", async () => {
      const { result, data } = await run(fakeSite("/about"), "get_current_item");
      expect(result.isError).toBe(true);
      expect(data).toMatchObject({ code: "not_on_item_page", route: { kind: "other", section: "about" } });
    });
  });

  describe("fill_prompt_variables", () => {
    it("fills the prompt on the current page", async () => {
      const site = fakeSite("/prompts/p1_poem");
      site.tools.get_prompt = (args) => ok({ received: args });
      expect((await run(site, "fill_prompt_variables", { variables: { topic: "sea", lines: 4 } })).data).toEqual({
        received: { id: "p1", variables: { topic: "sea", lines: "4" } },
      });
    });

    it("accepts an explicit id and JSON-encoded variables", async () => {
      const site = fakeSite("/");
      site.tools.get_prompt = (args) => ok({ received: args });
      expect((await run(site, "fill_prompt_variables", { id: "p9", variables: '{"topic":"sky"}' })).data).toEqual({
        received: { id: "p9", variables: { topic: "sky" } },
      });
    });

    it("needs an id off prompt pages", async () => {
      expect((await run(fakeSite("/"), "fill_prompt_variables", { variables: {} })).data).toMatchObject({ code: "missing_id" });
    });

    it("rejects variables that are not an object", async () => {
      const { result } = await run(fakeSite("/prompts/p1"), "fill_prompt_variables", { variables: ["a"] });
      expect(result.isError).toBe(true);
    });
  });

  describe("navigate", () => {
    it("opens a same-origin page and reports where it landed", async () => {
      const site = fakeSite("/");
      const { data } = await run(site, "navigate", { path: "https://prompts.chat/bots/teams/crew" });
      expect(site.env.navigate).toHaveBeenCalledWith("/bots/teams/crew");
      expect(data).toMatchObject({ navigatedTo: "/bots/teams/crew", route: { kind: "team", slug: "crew" } });
    });

    it("refuses other sites", async () => {
      const site = fakeSite("/");
      const { data } = await run(site, "navigate", { path: "https://evil.example/" });
      expect(data).toMatchObject({ code: "invalid_path" });
      expect(site.env.navigate).not.toHaveBeenCalled();
    });

    it("reports an error when the page did not open in time", async () => {
      const site = fakeSite("/tags/x");
      vi.mocked(site.env.navigate).mockResolvedValue(undefined);
      const { result, data } = await run(site, "navigate", { path: "/bots" });
      expect(result.isError).toBe(true);
      expect(data).toMatchObject({ code: "navigation_incomplete", requested: "/bots", currentPath: "/tags/x" });

      const search = await run(site, "show_search_results", { query: "x" });
      expect(search.data).toMatchObject({ code: "navigation_incomplete", requested: "/prompts?q=x" });
    });
  });

  it("show_search_results opens a listing with the query", async () => {
    const site = fakeSite("/");
    await run(site, "show_search_results", { query: "code review", section: "skills" });
    expect(site.env.navigate).toHaveBeenCalledWith("/skills?q=code+review");
    await run(site, "show_search_results", { query: "x", section: "nope" });
    expect(site.env.navigate).toHaveBeenLastCalledWith("/prompts?q=x");
  });

  describe("change_language", () => {
    it("switches to a configured locale", async () => {
      const site = fakeSite("/");
      const { data } = await run(site, "change_language", { locale: "ar" });
      expect(site.env.setLocale).toHaveBeenCalledWith("ar");
      expect(data).toEqual({ locale: "ar", previous: "fr", reloading: true });
    });

    it("lists the locales in its schema and refuses others", async () => {
      const site = fakeSite("/");
      expect(find(pageTools(site.env), "change_language").inputSchema.properties.locale).toMatchObject({ enum: ["en", "de", "ar"] });
      expect((await run(site, "change_language", { locale: "xx" })).data).toMatchObject({ code: "invalid_locale" });
      expect(site.env.setLocale).not.toHaveBeenCalled();
    });
  });

  describe("get_signed_in_user", () => {
    it("reports the signed-in user without other session fields", async () => {
      const site = fakeSite("/");
      site.routes["GET /api/auth/session"] = () => json({ user: { username: "alice", name: "Alice", email: "a@example.com" }, expires: "x" });
      expect((await run(site, "get_signed_in_user")).data).toEqual({ signedIn: true, username: "alice", name: "Alice", profile: "/@alice" });
    });

    it("reports a signed-out visitor", async () => {
      const site = fakeSite("/");
      site.routes["GET /api/auth/session"] = () => json(null);
      expect((await run(site, "get_signed_in_user")).data).toEqual({ signedIn: false });
    });
  });

  describe("upvote_prompt", () => {
    it("upvotes the item on the page through the vote endpoint and refreshes", async () => {
      const site = fakeSite("/bots/b1_helper");
      site.routes["POST /api/prompts/b1/vote"] = () => json({ voted: true, voteCount: 3 });
      expect((await run(site, "upvote_prompt")).data).toEqual({ id: "b1", upvoted: true, voteCount: 3 });
      expect(site.env.refresh).toHaveBeenCalled();
    });

    it("removes an upvote and tells the page's buttons", async () => {
      const site = fakeSite("/");
      const changes: unknown[] = [];
      const listener = (event: Event) => changes.push((event as CustomEvent).detail);
      document.addEventListener(PROMPT_STATE_EVENT, listener);
      site.routes["DELETE /api/prompts/p1/vote"] = () => json({ voted: false, voteCount: 2 });
      expect((await run(site, "upvote_prompt", { id: "p1", upvote: false })).data).toEqual({ id: "p1", upvoted: false, voteCount: 2 });
      document.removeEventListener(PROMPT_STATE_EVENT, listener);
      expect(changes).toEqual([{ promptId: "p1", voted: false, voteCount: 2 }]);
    });

    it("resolves a classifier page to its prompt id", async () => {
      const site = fakeSite("/classifiers/ticket-router");
      site.tools.get_classifier = () => ok({ id: "c1" });
      site.routes["POST /api/prompts/c1/vote"] = () => json({ voted: true, voteCount: 1 });
      expect((await run(site, "upvote_prompt")).data).toMatchObject({ id: "c1", upvoted: true });
    });

    it("treats an existing upvote as done", async () => {
      const site = fakeSite("/prompts/p1");
      site.routes["POST /api/prompts/p1/vote"] = () => json({ error: "already_voted", message: "x" }, 400);
      expect((await run(site, "upvote_prompt")).data).toEqual({ id: "p1", upvoted: true, alreadyUpvoted: true });
    });

    it("asks the user to sign in", async () => {
      const site = fakeSite("/prompts/p1");
      site.routes["POST /api/prompts/p1/vote"] = () => json({ error: "unauthorized" }, 401);
      const { result, data } = await run(site, "upvote_prompt");
      expect(result.isError).toBe(true);
      expect(data).toMatchObject({ code: "unauthorized" });
      expect(site.env.refresh).not.toHaveBeenCalled();
    });

    it("passes on the endpoint's permission errors", async () => {
      const site = fakeSite("/prompts/p1");
      site.routes["POST /api/prompts/p1/vote"] = () => json({ error: "not_found", message: "Prompt not found" }, 404);
      expect((await run(site, "upvote_prompt")).data).toMatchObject({ code: "not_found", error: "Prompt not found" });
    });
  });

  describe("save_prompt_to_collection", () => {
    it("adds the prompt on the page", async () => {
      const site = fakeSite("/prompts/p1_poem");
      site.routes["POST /api/collection"] = (init) => json({ added: true, body: JSON.parse(String(init.body)) });
      expect((await run(site, "save_prompt_to_collection")).data).toEqual({ id: "p1", saved: true });
      expect(site.fetch).toHaveBeenCalledWith("/api/collection", expect.objectContaining({ body: JSON.stringify({ promptId: "p1" }) }));
      expect(site.env.refresh).toHaveBeenCalled();
    });

    it("removes a prompt and tells the page's buttons", async () => {
      const site = fakeSite("/");
      const changes: unknown[] = [];
      const listener = (event: Event) => changes.push((event as CustomEvent).detail);
      document.addEventListener(PROMPT_STATE_EVENT, listener);
      site.routes["DELETE /api/collection?promptId=p2"] = () => json({ removed: true });
      expect((await run(site, "save_prompt_to_collection", { id: "p2", save: false })).data).toEqual({ id: "p2", saved: false });
      document.removeEventListener(PROMPT_STATE_EVENT, listener);
      expect(changes).toEqual([{ promptId: "p2", inCollection: false }]);
    });

    it("treats an existing entry as saved and requires sign-in", async () => {
      const site = fakeSite("/prompts/p1");
      site.routes["POST /api/collection"] = () => json({ error: "Already in collection" }, 400);
      expect((await run(site, "save_prompt_to_collection")).data).toEqual({ id: "p1", saved: true, alreadySaved: true });
      site.routes["POST /api/collection"] = () => json({ error: "Unauthorized" }, 401);
      expect((await run(site, "save_prompt_to_collection")).data).toMatchObject({ code: "unauthorized" });
    });
  });
});

describe("MCP prompts", () => {
  const get = (site: FakeSite, name: string) => createPrompts(site.env).find((p) => p.name === name)!;

  it("use_prompt gets the server prompt with parsed variables", async () => {
    const site = fakeSite("/");
    const result = await get(site, "use_prompt").get({ prompt: "write-a-poem", variables: '{"topic":"sea","n":3}' });
    expect(result.messages[0].content).toEqual({ type: "text", text: 'write-a-poem:{"topic":"sea","n":"3"}' });
  });

  it("use_prompt rejects malformed variables", async () => {
    await expect(get(fakeSite("/"), "use_prompt").get({ prompt: "x", variables: "{oops" })).rejects.toThrow(/JSON object/);
    await expect(get(fakeSite("/"), "use_prompt").get({ prompt: "x", variables: "[1]" })).rejects.toThrow(/JSON object/);
    await expect(get(fakeSite("/"), "use_prompt").get({})).rejects.toThrow(/slug or id/);
  });

  it("use_current_prompt fills the prompt on the page and names missing variables", async () => {
    const site = fakeSite("/prompts/p1_poem");
    site.tools.get_prompt = (args) => ok({ title: "Poem", content: `About ${(args.variables as Record<string, string>).topic}`, missingVariables: ["style"] });
    const result = await get(site, "use_current_prompt").get({ variables: '{"topic":"sea"}' });
    expect(result).toEqual({ description: "Poem (missing: style)", messages: [{ role: "user", content: { type: "text", text: "About sea" } }] });
  });

  it("use_current_prompt fails off prompt pages", async () => {
    await expect(get(fakeSite("/tags/x"), "use_current_prompt").get({})).rejects.toThrow(/does not show a prompt/);
  });

  it("find_prompt writes instructions that use the registered tools", async () => {
    const result = await get(fakeSite("/"), "find_prompt").get({ task: "review my essay" });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain("review my essay");
    for (const tool of ["search_prompts", "get_prompt", "fill_prompt_variables"]) expect(text).toContain(tool);
  });
});

describe("MCP resources", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "Home";
    document.body.innerHTML = "<main><p>Welcome</p></main>";
  });

  const resource = (site: FakeSite, name: string) => createResources(site.env).find((r) => r.name === name)!;

  it("reads the current page as Markdown", async () => {
    const site = fakeSite("/");
    const { contents } = await resource(site, "current-page").read(PAGE_RESOURCE_URI);
    expect(contents[0]).toMatchObject({ uri: PAGE_RESOURCE_URI, mimeType: "text/markdown" });
    expect((contents[0] as { text: string }).text).toContain("Welcome");
  });

  it("reads the current item as JSON, or fails off item pages", async () => {
    const site = fakeSite("/bots/b1");
    site.tools.get_bot = () => ok({ id: "b1" });
    const { contents } = await resource(site, "current-item").read(CURRENT_ITEM_RESOURCE_URI);
    expect(JSON.parse((contents[0] as { text: string }).text)).toEqual({ id: "b1" });

    site.setPath("/about");
    await expect(resource(site, "current-item").read(CURRENT_ITEM_RESOURCE_URI)).rejects.toThrow(/does not show a single/);
  });

  it("proxies prompts-chat:// templates to the server", async () => {
    const site = fakeSite("/");
    const skills = resource(site, "skills");
    expect(skills.uriTemplate).toBe("prompts-chat://skills/{id}");
    await skills.read("prompts-chat://skills/s1/files/SKILL.md");
    expect(site.rpc.at(-1)).toEqual({ method: "resources/read", params: { uri: "prompts-chat://skills/s1/files/SKILL.md" } });
  });
});
