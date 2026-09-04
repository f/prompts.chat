/**
 * Regression test: a single POST /api/mcp must not take the whole site down.
 *
 * `@hono/node-server`'s `getRequestListener()` permanently replaces
 * `globalThis.Request` / `globalThis.Response` unless it is passed
 * `overrideGlobalObjects: false`:
 *
 *     if (options.overrideGlobalObjects !== false && global.Request !== Request) {
 *       Object.defineProperty(global, "Request", { value: Request })
 *       Object.defineProperty(global, "Response", { value: Response })
 *     }
 *
 * The MCP SDK's Node `StreamableHTTPServerTransport` calls it with no options —
 * both in its constructor and in every `handleRequest`. On a long-lived process
 * (`next start`, Docker, Cloud Run, Fly, a VPS) the first MCP request therefore
 * swaps the global `Response` for the lifetime of the process.
 *
 * `NextResponse` subclasses the *original* `Response` at module load, so
 * afterwards `response instanceof Response` is false in
 * `next/dist/esm/server/web/adapter.js` and EVERY request matching the
 * `src/proxy.ts` matcher dies with
 * `TypeError: Expected an instance of Response to be returned`.
 *
 * Serverless deployments are unaffected: middleware runs in a separate isolate
 * there, so the Node-global mutation cannot cross realms.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    tag: { findUnique: vi.fn(), create: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  mcpGeneralLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpToolCallLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpWriteToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  mcpAiToolLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
}));

vi.mock("@/../prompts.config", () => ({
  default: { features: { mcp: true } },
}));

vi.mock("@/lib/api-key", () => ({
  isValidApiKeyFormat: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/skill-files", () => ({
  parseSkillFiles: vi.fn(),
  serializeSkillFiles: vi.fn(),
  sanitizeFilename: vi.fn(),
  DEFAULT_SKILL_FILE: "SKILL.md",
}));

/** Minimal NextApiResponse shims over a real Node ServerResponse. */
function decorate(res: http.ServerResponse) {
  const r = res as http.ServerResponse & Record<string, unknown>;
  r.status = (code: number) => {
    res.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    if (!res.headersSent) res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return r;
  };
  return r;
}

describe("/api/mcp must not leak @hono/node-server's global Request/Response swap", () => {
  let server: http.Server;
  let url: string;

  beforeEach(async () => {
    const { default: handler } = await import("@/pages/api/mcp");
    server = http.createServer((req, res) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void handler(req as any, decorate(res) as any);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("leaves globalThis.Response identical after a real MCP initialize request", async () => {
    const OriginalResponse = globalThis.Response;
    const OriginalRequest = globalThis.Request;

    // Subclass exactly the way NextResponse does, before any MCP traffic.
    class NextResponseLike extends Response {}
    const sentinel = new NextResponseLike(null, { status: 204 });
    expect(sentinel instanceof globalThis.Response).toBe(true);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "regression-test", version: "1.0.0" },
        },
      }),
    });
    await res.text(); // drain so the request fully completes

    expect(globalThis.Response).toBe(OriginalResponse);
    expect(globalThis.Request).toBe(OriginalRequest);

    // The actual production symptom: Next's middleware adapter runs this check
    // on every request, and threw `Expected an instance of Response to be
    // returned` site-wide once the global had been swapped.
    expect(sentinel instanceof globalThis.Response).toBe(true);
  });
});
