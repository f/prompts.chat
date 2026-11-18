import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parsePromptsCsv } from "@/lib/csv/parse-prompts";

/**
 * Real integration tests for the prompt-builder chat POST handler.
 *
 * Only the external boundaries are mocked (OpenAI SDK, auth, config, semantic
 * search). The route's own logic — mode resolution, model/temperature/token
 * selection, search grounding, and SSE streaming — runs for real. If the mode
 * wiring is reverted or broken, these tests fail.
 */

const hoisted = vi.hoisted(() => ({
  createSpy: vi.fn(),
  semanticSearchSpy: vi.fn(),
  authSpy: vi.fn(),
  getConfigSpy: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: hoisted.createSpy } };
    constructor() {}
  },
}));
vi.mock("@/lib/auth", () => ({ auth: hoisted.authSpy }));
vi.mock("@/lib/config", () => ({ getConfig: hoisted.getConfigSpy }));
vi.mock("@/lib/ai/embeddings", () => ({ semanticSearch: hoisted.semanticSearchSpy }));

import { POST } from "./route";

function fakeStream(contentChunks: string[]) {
  return (async function* () {
    for (const c of contentChunks) {
      yield { choices: [{ delta: { content: c } }] };
    }
  })();
}

async function readSSE(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  const events: Array<Record<string, unknown>> = [];
  for (const line of buffer.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    events.push(JSON.parse(payload));
  }
  return events;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/prompt-builder/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseState = {
  title: "",
  description: "",
  content: "",
  type: "TEXT",
  tagIds: [] as string[],
  categoryId: null,
  isPrivate: false,
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    messages: [{ role: "user", content: "write a prompt for a travel guide" }],
    currentState: baseState,
    availableTags: [],
    availableCategories: [],
    ...overrides,
  };
}

let userCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.OPENAI_PRO_MODEL;
  delete process.env.OPENAI_GENERATIVE_MODEL;
  // Unique user each test so the in-memory rate limiter never trips.
  hoisted.authSpy.mockResolvedValue({ user: { id: `user-${userCounter++}` } });
  hoisted.getConfigSpy.mockResolvedValue({ features: { aiGeneration: true, aiSearch: true } });
  hoisted.semanticSearchSpy.mockResolvedValue([]);
  // Default: model answers with plain text and no tool calls.
  hoisted.createSpy.mockImplementation(async () => fakeStream(["Here ", "you go."]));
});

describe("route auth & config gates (real handler)", () => {
  it("rejects unauthenticated requests", async () => {
    hoisted.authSpy.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(body()) as never);
    expect(res.status).toBe(401);
  });

  it("rejects when AI generation feature is disabled", async () => {
    hoisted.getConfigSpy.mockResolvedValueOnce({ features: { aiGeneration: false } });
    const res = await POST(makeRequest(body()) as never);
    expect(res.status).toBe(403);
  });

  it("rejects when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await POST(makeRequest(body()) as never);
    expect(res.status).toBe(500);
  });
});

describe("mode wiring reaches the OpenAI call (real handler)", () => {
  it("search mode uses the fast model / small budget", async () => {
    const res = await POST(makeRequest(body({ mode: "search" })) as never);
    await readSSE(res);
    expect(hoisted.createSpy).toHaveBeenCalled();
    const args = hoisted.createSpy.mock.calls[0][0];
    expect(args.model).toBe("gpt-4o-mini");
    expect(args.temperature).toBe(0.7);
    expect(args.max_tokens).toBe(2000);
  });

  it("pro mode spends extra compute (stronger model, bigger budget)", async () => {
    const res = await POST(makeRequest(body({ mode: "pro" })) as never);
    await readSSE(res);
    const args = hoisted.createSpy.mock.calls[0][0];
    expect(args.model).toBe("gpt-4o");
    expect(args.temperature).toBe(0.5);
    expect(args.max_tokens).toBe(4000);
  });

  it("bad / missing mode falls back to search (never 500s on bad mode)", async () => {
    const res = await POST(makeRequest(body({ mode: "ultra-turbo" })) as never);
    await readSSE(res);
    const args = hoisted.createSpy.mock.calls[0][0];
    expect(args.model).toBe("gpt-4o-mini");
  });

  it("honors per-mode model env override", async () => {
    process.env.OPENAI_PRO_MODEL = "o3-custom";
    const res = await POST(makeRequest(body({ mode: "pro" })) as never);
    await readSSE(res);
    expect(hoisted.createSpy.mock.calls[0][0].model).toBe("o3-custom");
  });
});

describe("search grounding (real handler)", () => {
  it("queries semantic search with the latest user message and injects sources", async () => {
    hoisted.semanticSearchSpy.mockResolvedValueOnce([
      { title: "Travel Guide", content: "Act as a travel guide for a city.", similarity: 0.9 },
    ]);
    const res = await POST(
      makeRequest(body({ mode: "pro", messages: [{ role: "user", content: "make me a travel guide prompt" }] })) as never
    );
    await readSSE(res);

    // Pro mode retrieves 12 sources for the actual user query.
    expect(hoisted.semanticSearchSpy).toHaveBeenCalledWith("make me a travel guide prompt", 12);

    // The retrieved source is grounded into the system message, cite-able.
    const systemMessage = (hoisted.createSpy.mock.calls[0][0].messages as Array<{ role: string; content: string }>)[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("RELEVANT PROMPTS");
    expect(systemMessage.content).toContain("[1] Travel Guide");
  });

  it("survives a failing search backend without crashing the chat", async () => {
    hoisted.semanticSearchSpy.mockRejectedValueOnce(new Error("vector db down"));
    const res = await POST(makeRequest(body({ mode: "search" })) as never);
    const events = await readSSE(res);
    expect(hoisted.createSpy).toHaveBeenCalled(); // chat still proceeds
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});

describe("streaming + real prompt data (real handler)", () => {
  it("forwards streamed model text as SSE text events", async () => {
    hoisted.createSpy.mockImplementationOnce(async () => fakeStream(["Hello ", "world"]));
    const res = await POST(makeRequest(body()) as never);
    const events = await readSSE(res);
    const text = events
      .filter((e) => e.type === "text")
      .map((e) => e.content)
      .join("");
    expect(text).toBe("Hello world");
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  it("passes the user's prompt content through verbatim", async () => {
    const tricky = 'Reply with {curly}, "quotes", commas, and\nnewlines — keep it EXACT.';
    const res = await POST(makeRequest(body({ messages: [{ role: "user", content: tricky }] })) as never);
    await readSSE(res);
    const sent = (hoisted.createSpy.mock.calls[0][0].messages as Array<{ role: string; content: string }>).find(
      (m) => m.role === "user"
    );
    expect(sent?.content).toBe(tricky);
  });

  it("handles a sample of real prompts.csv TEXT prompts end-to-end", async () => {
    const csvPath = path.resolve(process.cwd(), "prompts.csv");
    expect(fs.existsSync(csvPath)).toBe(true);
    const rows = parsePromptsCsv(fs.readFileSync(csvPath, "utf8")).filter(
      (r) => r.type.toUpperCase() === "TEXT" && r.prompt.trim()
    );
    expect(rows.length).toBeGreaterThan(50);

    // Pick diverse real prompts: shortest, longest, and ones with quotes/braces.
    const byLen = [...rows].sort((a, b) => a.prompt.length - b.prompt.length);
    const samples = [
      byLen[0],
      byLen[byLen.length - 1],
      rows.find((r) => r.prompt.includes('"')) ?? rows[0],
      rows.find((r) => r.prompt.includes("{")) ?? rows[0],
    ];

    for (const row of samples) {
      hoisted.createSpy.mockImplementationOnce(async () => fakeStream(["ok"]));
      const res = await POST(
        makeRequest(body({ mode: "pro", messages: [{ role: "user", content: row.prompt }] })) as never
      );
      const events = await readSSE(res);
      // Route never throws on real data; the user prompt reaches OpenAI intact.
      expect(events.some((e) => e.type === "done")).toBe(true);
      const sent = (hoisted.createSpy.mock.calls.at(-1)![0].messages as Array<{ role: string; content: string }>).find(
        (m) => m.role === "user"
      );
      expect(sent?.content).toBe(row.prompt);
    }
  });
});
