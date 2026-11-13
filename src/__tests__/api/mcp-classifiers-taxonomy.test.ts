import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "@/lib/db";
import { findClassifierBySlug, getClassifierCatalog } from "@/lib/classifiers/store";
import { createMcpServer } from "@/lib/mcp/server";
import type { McpContext } from "@/lib/mcp/context";
import { encodeCursor } from "@/lib/mcp/schemas";
import type { ClassifierRecord } from "@/lib/classifiers/types";

vi.mock("@/lib/db", () => ({
  db: {
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    tag: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/classifiers/store", () => ({
  getClassifierCatalog: vi.fn(),
  findClassifierBySlug: vi.fn(),
  listedClassifiers: (catalog: { classifiers: ClassifierRecord[] }) => catalog.classifiers.filter((c) => !c.isUnlisted),
}));

const alice = { id: "user-1", username: "alice", role: "USER", mcpPromptsPublicByDefault: false };

function classifier(slug: string, overrides: Partial<ClassifierRecord> = {}): ClassifierRecord {
  return {
    id: `prompt-${slug}`,
    slug,
    name: `Classifier ${slug}`,
    category: "support",
    summary: `Summary of ${slug}`,
    problem: "A problem",
    goal: "A goal",
    input: { fields: [{ name: "ticket", description: "The ticket text" }] },
    question: { key: "route", type: "choice", instructions: "Pick a queue", options: [{ key: "billing", description: "Billing" }] },
    outcomes: [{ id: "billing", label: "Send to billing", when: "route is billing" }],
    guidance: [],
    scenarios: [],
    betterTogether: [],
    references: [],
    tags: ["routing"],
    curated: true,
    author: { id: "user-2", name: null, username: "bob", avatar: null, verified: false },
    isPrivate: false,
    isUnlisted: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as unknown as ClassifierRecord;
}

let client: Client;

async function connect(user: McpContext["user"] = null) {
  const server = createMcpServer({ user, filters: {}, baseUrl: "https://prompts.chat", promptEnhancer: false });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  return { result, data: result.structuredContent as Record<string, unknown> };
}

describe("MCP classifier and taxonomy tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => client?.close());

  it("registers them as read-only tools", async () => {
    await connect();
    const { tools } = await client.listTools();
    for (const name of ["search_classifiers", "get_classifier", "list_categories", "list_tags"]) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.annotations?.readOnlyHint).toBe(true);
      expect(tool?.outputSchema).toBeDefined();
    }
  });

  describe("list_categories", () => {
    it("returns root categories with their children and links", async () => {
      vi.mocked(db.category.findMany).mockResolvedValue([
        { name: "Coding", slug: "coding", description: "Code", children: [{ name: "Python", slug: "python", description: null }] },
      ] as never);
      await connect();
      const { data } = await call("list_categories");

      expect(db.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { parentId: null } }));
      expect(data).toEqual({
        count: 1,
        categories: [
          {
            name: "Coding",
            slug: "coding",
            description: "Code",
            link: "https://prompts.chat/categories/coding",
            children: [{ name: "Python", slug: "python", description: null, link: "https://prompts.chat/categories/python" }],
          },
        ],
      });
    });
  });

  describe("list_tags", () => {
    it("filters by name or slug and orders by use", async () => {
      vi.mocked(db.tag.findMany).mockResolvedValue([{ name: "Python", slug: "python", color: "#000" }] as never);
      await connect();
      const { data } = await call("list_tags", { query: " py ", limit: 5 });

      expect(db.tag.findMany).toHaveBeenCalledWith({
        where: { OR: [{ name: { contains: "py", mode: "insensitive" } }, { slug: { contains: "py", mode: "insensitive" } }] },
        orderBy: [{ prompts: { _count: "desc" } }, { name: "asc" }],
        take: 5,
        select: { name: true, slug: true, color: true },
      });
      expect(data.tags).toEqual([{ name: "Python", slug: "python", color: "#000", link: "https://prompts.chat/tags/python" }]);
    });

    it("lists every tag without a query", async () => {
      vi.mocked(db.tag.findMany).mockResolvedValue([] as never);
      await connect();
      await call("list_tags");
      expect(vi.mocked(db.tag.findMany).mock.calls[0][0]).toMatchObject({ where: undefined, take: 50 });
    });
  });

  describe("search_classifiers", () => {
    beforeEach(() => {
      vi.mocked(getClassifierCatalog).mockResolvedValue({
        classifiers: [
          classifier("ticket-router"),
          classifier("refund-risk", { category: "refunds", tags: ["refunds"] } as Partial<ClassifierRecord>),
          classifier("hidden-router", { isUnlisted: true }),
        ],
        chains: [],
        sources: [],
      });
    });

    it("matches listed classifiers by keyword", async () => {
      await connect();
      const { data } = await call("search_classifiers", { query: "ticket" });
      expect(data.total).toBe(1);
      expect(data.classifiers).toEqual([
        {
          id: "prompt-ticket-router",
          slug: "ticket-router",
          name: "Classifier ticket-router",
          category: "support",
          summary: "Summary of ticket-router",
          questionType: "choice",
          outcomes: ["Send to billing"],
          tags: ["routing"],
          link: "https://prompts.chat/classifiers/ticket-router",
        },
      ]);
    });

    it("filters by category and pages with a cursor", async () => {
      await connect();
      expect((await call("search_classifiers", { category: "refunds" })).data.total).toBe(1);

      const first = await call("search_classifiers", { limit: 1 });
      expect(first.data).toMatchObject({ total: 2, count: 1, nextCursor: encodeCursor(1) });
      const second = await call("search_classifiers", { limit: 1, cursor: first.data.nextCursor });
      expect(second.data).toMatchObject({ count: 1, classifiers: [expect.objectContaining({ slug: "refund-risk" })] });
      expect(second.data.nextCursor).toBeUndefined();
    });
  });

  describe("get_classifier", () => {
    it("returns the definition and the chains that use it", async () => {
      const record = classifier("ticket-router");
      vi.mocked(findClassifierBySlug).mockResolvedValue({ record, row: { isPrivate: false, authorId: "user-2" } } as never);
      vi.mocked(getClassifierCatalog).mockResolvedValue({
        classifiers: [record],
        chains: [{ slug: "support-flow", name: "Support flow", steps: [{ classifier: "ticket-router" }] }, { slug: "other", name: "Other", steps: [] }] as never,
        sources: [],
      });
      await connect();
      const { data } = await call("get_classifier", { slug: "ticket-router" });

      expect(data).toMatchObject({ slug: "ticket-router", problem: "A problem", goal: "A goal", chains: [{ slug: "support-flow", name: "Support flow" }] });
      expect(data.definition).toContain("# Classifier ticket-router");
      expect(data.definition).toContain("- billing: Billing");
    });

    it("hides another user's private classifier", async () => {
      vi.mocked(findClassifierBySlug).mockResolvedValue({
        record: classifier("secret", { isPrivate: true }),
        row: { isPrivate: true, authorId: "user-2" },
      } as never);
      await connect(alice);
      const { result } = await call("get_classifier", { slug: "secret" });
      expect(result.isError).toBe(true);
      expect(JSON.parse((result.content as { text: string }[])[0].text)).toMatchObject({ code: "not_found" });
    });

    it("shows a private classifier to its author, without chains", async () => {
      vi.mocked(findClassifierBySlug).mockResolvedValue({
        record: classifier("mine", { isPrivate: true }),
        row: { isPrivate: true, authorId: "user-1" },
      } as never);
      await connect(alice);
      const { data } = await call("get_classifier", { slug: "mine" });
      expect(data).toMatchObject({ slug: "mine", chains: [] });
      expect(getClassifierCatalog).not.toHaveBeenCalled();
    });
  });
});
