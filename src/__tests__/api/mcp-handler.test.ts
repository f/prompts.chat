import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

// Mock all heavy dependencies before importing handler
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
  default: {
    features: { mcp: true },
  },
}));

vi.mock("@/lib/api-key", () => ({
  isValidApiKeyFormat: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/skill-files", () => ({
  parseSkillFiles: vi.fn(),
  serializeSkillFiles: vi.fn(),
  sanitizeFilename: vi.fn(),
  DEFAULT_SKILL_FILE: "main.md",
}));

function createMockReq(method: string, overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method,
    headers: {},
    url: "/api/mcp",
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as NextApiRequest;
}

function createMockRes(): NextApiResponse & {
  _status: number;
  _json: unknown;
  _headers: Record<string, string>;
  _ended: boolean;
} {
  const res = {
    _status: 200,
    _json: null,
    _headers: {} as Record<string, string>,
    _ended: false,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
    end() {
      res._ended = true;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
    getHeader(key: string) {
      return res._headers[key];
    },
    headersSent: false,
    on: vi.fn(),
  };
  return res as unknown as NextApiResponse & typeof res;
}

describe("findCategoryMatch - category resolution", () => {
  const cats = [
    { id: "1", name: "Writing & Content", slug: "writing" },
    { id: "2", name: "Code Review", slug: "code-review" },
    { id: "3", name: "Development", slug: "development" },
  ];
  let findCategoryMatch: (
    categories: typeof cats,
    input: string,
  ) => (typeof cats)[number] | null;

  beforeEach(async () => {
    const mod = await import("@/pages/api/mcp");
    findCategoryMatch = mod.findCategoryMatch;
  });

  it("matches an exact slug", () => {
    expect(findCategoryMatch(cats, "code-review")?.id).toBe("2");
  });

  it("matches a slug case-insensitively", () => {
    expect(findCategoryMatch(cats, "Code-Review")?.id).toBe("2");
  });

  it("matches by category name", () => {
    expect(findCategoryMatch(cats, "Development")?.id).toBe("3");
  });

  it("matches a name with different spacing/case via slugify", () => {
    expect(findCategoryMatch(cats, "code_review")?.id).toBe("2");
  });

  it("matches a name whose slug differs from slugify (Writing & Content -> writing)", () => {
    expect(findCategoryMatch(cats, "Writing & Content")?.id).toBe("1");
  });

  it("returns null when nothing matches", () => {
    expect(findCategoryMatch(cats, "nonexistent-category")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(findCategoryMatch(cats, "   ")).toBeNull();
  });
});

describe("buildPromptVisibilityFilter - get_prompt/get_skill visibility", () => {
  let buildPromptVisibilityFilter: (
    user: { id: string } | null | undefined,
  ) => Record<string, unknown>;

  beforeEach(async () => {
    const mod = await import("@/pages/api/mcp");
    buildPromptVisibilityFilter = mod.buildPromptVisibilityFilter;
  });

  it("lets an authenticated owner see public prompts AND their own private ones", () => {
    const filter = buildPromptVisibilityFilter({ id: "user-1" });
    expect(filter).toEqual({
      OR: [
        { isPrivate: false },
        { isPrivate: true, authorId: "user-1" },
      ],
    });
  });

  it("restricts unauthenticated callers to public prompts only", () => {
    expect(buildPromptVisibilityFilter(null)).toEqual({ isPrivate: false });
    expect(buildPromptVisibilityFilter(undefined)).toEqual({ isPrivate: false });
  });

  it("does not hard-filter isPrivate:false for an owner (regression: own private prompt was unfetchable)", () => {
    const filter = buildPromptVisibilityFilter({ id: "owner" });
    expect(filter).not.toHaveProperty("isPrivate", false);
    expect(filter.OR).toContainEqual({ isPrivate: true, authorId: "owner" });
  });
});

describe("MCP API handler - HTTP method routing", () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import to pick up mocks
    const mod = await import("@/pages/api/mcp");
    handler = mod.default;
  });

  describe("GET requests", () => {
    it("should return 405 Method Not Allowed per MCP Streamable HTTP spec", async () => {
      const req = createMockReq("GET");
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(405);
    });

    it("should return JSON-RPC error body", async () => {
      const req = createMockReq("GET");
      const res = createMockRes();

      await handler(req, res);

      expect(res._json).toEqual({
        jsonrpc: "2.0",
        error: expect.objectContaining({
          code: -32000,
          message: expect.stringContaining("Method not allowed"),
        }),
        id: null,
      });
    });

    it("should set Cache-Control: no-store to prevent caching stale 405s", async () => {
      const req = createMockReq("GET");
      const res = createMockRes();

      await handler(req, res);

      expect(res._headers["Cache-Control"]).toBe("no-store");
    });
  });

  describe("DELETE requests", () => {
    it("should return 204 No Content", async () => {
      const req = createMockReq("DELETE");
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(204);
      expect(res._ended).toBe(true);
    });
  });

  describe("unsupported methods", () => {
    it("should return 405 for PUT", async () => {
      const req = createMockReq("PUT");
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(405);
    });

    it("should return 405 for PATCH", async () => {
      const req = createMockReq("PATCH");
      const res = createMockRes();

      await handler(req, res);

      expect(res._status).toBe(405);
    });
  });

  describe("MCP disabled", () => {
    it("should return 404 when MCP feature is disabled", async () => {
      // Re-mock config with mcp disabled
      vi.doMock("@/../prompts.config", () => ({
        default: { features: { mcp: false } },
      }));

      // Re-import to get new mock
      vi.resetModules();
      const mod = await import("@/pages/api/mcp");
      const disabledHandler = mod.default;

      const req = createMockReq("GET");
      const res = createMockRes();

      await disabledHandler(req, res);

      expect(res._status).toBe(404);

      // Restore original mock
      vi.doMock("@/../prompts.config", () => ({
        default: { features: { mcp: true } },
      }));
    });
  });
});
