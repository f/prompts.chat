import { parseRoute, snapshotPage, toSameOriginPath, type PageRoute } from "./page";
import { callServerTool, listServerTools, toolData, type ServerTool } from "./server-client";
import type { CallToolResult, JsonSchemaObject, WebMcpEnv, WebMcpTool } from "./types";

/**
 * Read-only tools of the site's MCP server (src/lib/mcp/tools) that the page offers as well.
 * Their names, descriptions and schemas come from the server's tools/list, so both stay in sync;
 * calls go to /api/mcp, which holds the search and visibility logic.
 */
export const PROXIED_SERVER_TOOLS = [
  "search_prompts",
  "get_prompt",
  "search_skills",
  "get_skill",
  "search_bots",
  "get_bot",
  "list_teams",
  "get_team",
  "search_classifiers",
  "get_classifier",
  "list_categories",
  "list_tags",
] as const;

const ANONYMOUS_NOTE = " Through WebMCP the site's data tools run without your API key, so they return public content.";

export function result(data: Record<string, unknown>): CallToolResult {
  const text = JSON.stringify(data);
  return { content: [{ type: "text", text }], structuredContent: JSON.parse(text) };
}

export function errorResult(code: string, message: string, details: Record<string, unknown> = {}): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: message, code, ...details }) }], isError: true };
}

/** Turns thrown errors into tool errors, so an agent gets a message it can act on */
function guarded(execute: WebMcpTool["execute"], failureMessage: string): WebMcpTool["execute"] {
  return async (args) => {
    try {
      return await execute(args ?? {});
    } catch (error) {
      return errorResult("failed", error instanceof Error && error.message ? error.message : failureMessage);
    }
  };
}

function schema(properties: Record<string, unknown>, required: string[] = []): JsonSchemaObject {
  return { type: "object", properties, ...(required.length > 0 && { required }), additionalProperties: false };
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function variablesArg(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (!value.trim()) return undefined;
    return variablesArg(JSON.parse(value));
  }
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("`variables` must be an object of name → value");
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, String(v)]));
}

export function mirrorServerTools(env: WebMcpEnv, serverTools: ServerTool[]): WebMcpTool[] {
  const allowed = new Set<string>(PROXIED_SERVER_TOOLS);
  return serverTools
    .filter((tool) => allowed.has(tool.name) && tool.annotations?.readOnlyHint === true)
    .map((tool) => ({
      name: tool.name,
      description: `${tool.description ?? tool.title ?? tool.name}${ANONYMOUS_NOTE}`,
      inputSchema: { ...tool.inputSchema, type: "object", properties: tool.inputSchema.properties ?? {} },
      annotations: { title: tool.title, readOnlyHint: true, openWorldHint: false },
      execute: guarded((args) => callServerTool(env, tool.name, args), `Failed to call ${tool.name}`),
    }));
}

/** The prompt id behind the current page: prompt, skill and bot pages carry it, classifier pages are looked up */
export async function currentPromptId(env: WebMcpEnv, route: PageRoute = parseRoute(env.location())): Promise<string | null> {
  if (route.kind === "prompt" || route.kind === "bot") return route.id;
  if (route.kind === "classifier") {
    const data = toolData(await callServerTool(env, "get_classifier", { slug: route.slug }));
    return typeof data?.id === "string" ? data.id : null;
  }
  return null;
}

/** The full item the current page shows, from the matching server tool */
export async function getCurrentItem(env: WebMcpEnv): Promise<CallToolResult> {
  const route = parseRoute(env.location());
  switch (route.kind) {
    case "prompt": {
      const prompt = await callServerTool(env, "get_prompt", { id: route.id });
      if (toolData(prompt)?.type === "SKILL") return callServerTool(env, "get_skill", { id: route.id });
      return prompt;
    }
    case "bot":
      return callServerTool(env, "get_bot", { id: route.id });
    case "team":
      return callServerTool(env, "get_team", { slug: route.slug });
    case "classifier":
      return callServerTool(env, "get_classifier", { slug: route.slug });
    case "category":
      return callServerTool(env, "search_prompts", { query: "", category: route.slug });
    case "tag":
      return callServerTool(env, "search_prompts", { query: "", tag: route.slug });
    default:
      return errorResult(
        "not_on_item_page",
        "The current page does not show a single prompt, skill, bot, team, classifier, category or tag. Use get_current_page to read it, or navigate to an item first.",
        { route }
      );
  }
}

const SEARCH_SECTIONS = ["prompts", "skills", "bots", "classifiers"] as const;

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    return {};
  }
}

const SIGN_IN_MESSAGE = "Sign in to prompts.chat in this browser first; this tool acts as the signed-in user.";

/** Tools that read or act on the open page, so they run in the browser */
export function pageTools(env: WebMcpEnv): WebMcpTool[] {
  async function promptIdArg(args: Record<string, unknown>): Promise<string | CallToolResult> {
    const id = stringArg(args, "id") ?? (await currentPromptId(env));
    if (!id) return errorResult("missing_id", "Pass `id`, or call this on a prompt, skill, bot or classifier page.");
    return id;
  }

  return [
    {
      name: "get_current_page",
      description:
        "Read the page open in the user's browser on prompts.chat: URL, title, locale and text direction, what kind of page it is (route), " +
        "its headings, the links in its main content and its text as Markdown. Use it to see what the user is looking at.",
      inputSchema: schema({
        maxLength: { type: "integer", minimum: 500, maximum: 50000, default: 8000, description: "Maximum characters of page text to return" },
      }),
      annotations: { title: "Get Current Page", readOnlyHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const maxLength = typeof args.maxLength === "number" ? Math.min(Math.max(args.maxLength, 500), 50000) : 8000;
        return result({ ...snapshotPage(env.document(), env.location(), maxLength) });
      }, "Failed to read the page"),
    },
    {
      name: "get_current_item",
      description:
        "Get the full prompt, skill, bot, bot team or classifier shown on the current page (or the prompts listed on a category or tag page), " +
        "with the same data as get_prompt, get_skill, get_bot, get_team or get_classifier.",
      inputSchema: schema({}),
      annotations: { title: "Get Current Item", readOnlyHint: true, openWorldHint: false },
      execute: guarded(() => getCurrentItem(env), "Failed to get the current item"),
    },
    {
      name: "fill_prompt_variables",
      description:
        "Fill in the ${variable} placeholders of a prompt template and return the ready-to-use prompt. " +
        "Uses the prompt on the current page unless `id` is given. `missingVariables` lists required values still missing; ask the user for them.",
      inputSchema: schema(
        {
          id: { type: "string", description: "Prompt id; defaults to the prompt on the current page" },
          variables: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Values by variable name, e.g. {\"language\": \"French\"}",
          },
        },
        ["variables"]
      ),
      annotations: { title: "Fill Prompt Variables", readOnlyHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const id = await promptIdArg(args);
        if (typeof id !== "string") return id;
        return callServerTool(env, "get_prompt", { id, variables: variablesArg(args.variables) ?? {} });
      }, "Failed to fill the prompt"),
    },
    {
      name: "navigate",
      description:
        "Open a page of prompts.chat in the user's browser, e.g. /prompts, /prompts/{id}, /skills, /bots, /bots/teams, /classifiers, /categories, /tags/{slug}, /@{username}, /workflows or /book. " +
        "Takes a path or a full prompts.chat URL (links from other tools work); other sites are refused. Returns the page after navigating.",
      inputSchema: schema({ path: { type: "string", description: "Path such as /prompts?q=python, or a prompts.chat URL" } }, ["path"]),
      annotations: { title: "Navigate", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const target = stringArg(args, "path");
        const path = target ? toSameOriginPath(target, env.location().origin) : null;
        if (!path) return errorResult("invalid_path", "Pass a path on this site, such as /prompts or /bots/teams.");
        await env.navigate(path);
        const url = env.location();
        return result({ navigatedTo: `${url.pathname}${url.search}`, title: env.document().title, route: parseRoute(url) });
      }, "Failed to navigate"),
    },
    {
      name: "show_search_results",
      description:
        "Show search results to the user by opening the search page of a section of prompts.chat with a query. " +
        "To get results as data instead, use search_prompts, search_skills, search_bots or search_classifiers.",
      inputSchema: schema(
        {
          query: { type: "string", description: "Search text" },
          section: { type: "string", enum: [...SEARCH_SECTIONS], default: "prompts", description: "Which listing to search" },
        },
        ["query"]
      ),
      annotations: { title: "Show Search Results", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const query = stringArg(args, "query");
        if (!query) return errorResult("invalid_query", "Pass a search query.");
        const section = SEARCH_SECTIONS.find((s) => s === args.section) ?? "prompts";
        const path = `/${section}?${new URLSearchParams({ q: query })}`;
        await env.navigate(path);
        return result({ navigatedTo: path, title: env.document().title });
      }, "Failed to open the search"),
    },
    {
      name: "change_language",
      description: `Switch the language of the prompts.chat interface for this browser and reload the page. Available locales: ${env.locales.join(", ")}. User-written prompts keep their own language.`,
      inputSchema: schema({ locale: { type: "string", enum: [...env.locales], description: "Locale code" } }, ["locale"]),
      annotations: { title: "Change Language", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const locale = stringArg(args, "locale");
        if (!locale || !env.locales.includes(locale)) {
          return errorResult("invalid_locale", `Unsupported locale. Use one of: ${env.locales.join(", ")}`);
        }
        const previous = env.document().documentElement.lang || null;
        env.setLocale(locale);
        return result({ locale, previous, reloading: true });
      }, "Failed to change the language"),
    },
    {
      name: "get_signed_in_user",
      description:
        "Whether the user is signed in to prompts.chat in this browser, and as whom (username and display name). The upvote and collection tools need a signed-in user.",
      inputSchema: schema({}),
      annotations: { title: "Get Signed-in User", readOnlyHint: true, openWorldHint: false },
      execute: guarded(async () => {
        const session = await readJson(await env.fetch("/api/auth/session", { headers: { Accept: "application/json" } }));
        const user = session.user as { username?: string; name?: string | null } | undefined;
        if (!user?.username) return result({ signedIn: false });
        return result({ signedIn: true, username: user.username, name: user.name ?? null, profile: `/@${user.username}` });
      }, "Failed to read the session"),
    },
    {
      name: "upvote_prompt",
      description:
        "Upvote, or with upvote=false remove your upvote from, a prompt, skill, bot or classifier as the signed-in user. " +
        "Uses the item on the current page unless `id` is given. Same permission checks as the upvote button.",
      inputSchema: schema({
        id: { type: "string", description: "Prompt id; defaults to the item on the current page" },
        upvote: { type: "boolean", default: true, description: "false removes the upvote" },
      }),
      annotations: { title: "Upvote Prompt", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const id = await promptIdArg(args);
        if (typeof id !== "string") return id;
        const upvote = args.upvote !== false;
        const response = await env.fetch(`/api/prompts/${encodeURIComponent(id)}/vote`, { method: upvote ? "POST" : "DELETE" });
        const body = await readJson(response);
        if (response.status === 401) return errorResult("unauthorized", SIGN_IN_MESSAGE);
        if (response.status === 400 && body.error === "already_voted") return result({ id, upvoted: true, alreadyUpvoted: true });
        if (!response.ok) return errorResult(String(body.error ?? "failed"), String(body.message ?? `Vote failed (${response.status})`));
        env.refresh();
        return result({ id, upvoted: body.voted === true, voteCount: body.voteCount });
      }, "Failed to vote"),
    },
    {
      name: "save_prompt_to_collection",
      description:
        "Add a prompt to, or with save=false remove it from, the signed-in user's collection (/collection). " +
        "Uses the item on the current page unless `id` is given. Same permission checks as the collection button.",
      inputSchema: schema({
        id: { type: "string", description: "Prompt id; defaults to the item on the current page" },
        save: { type: "boolean", default: true, description: "false removes it from the collection" },
      }),
      annotations: { title: "Save Prompt to Collection", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: guarded(async (args) => {
        const id = await promptIdArg(args);
        if (typeof id !== "string") return id;
        const save = args.save !== false;
        const response = save
          ? await env.fetch("/api/collection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ promptId: id }),
            })
          : await env.fetch(`/api/collection?${new URLSearchParams({ promptId: id })}`, { method: "DELETE" });
        const body = await readJson(response);
        if (response.status === 401) return errorResult("unauthorized", SIGN_IN_MESSAGE);
        if (save && response.status === 400 && body.error === "Already in collection") return result({ id, saved: true, alreadySaved: true });
        if (!response.ok) return errorResult("failed", String(body.error ?? `Request failed (${response.status})`));
        env.refresh();
        return result({ id, saved: save });
      }, "Failed to update the collection"),
    },
  ];
}

/**
 * Every tool the page offers: the page tools, plus the server's read tools when /api/mcp answers
 * (it is off when features.mcp is disabled, and the page tools still work without it)
 */
export async function createTools(env: WebMcpEnv): Promise<WebMcpTool[]> {
  let serverTools: WebMcpTool[] = [];
  try {
    serverTools = mirrorServerTools(env, await listServerTools(env));
  } catch {
    // Page tools only
  }
  return [...pageTools(env), ...serverTools];
}
