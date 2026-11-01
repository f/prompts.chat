import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt } from "@/lib/prompt-write";
import { serializeSkillFiles } from "@/lib/skill-files";
import { createMcpServer } from "@/lib/mcp/server";
import type { McpContext } from "@/lib/mcp/context";
import { encodeCursor } from "@/lib/mcp/schemas";
import { extractVariables, fillVariables, missingVariables } from "@/lib/mcp/variables";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    tag: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn() },
    botPairing: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prompt-write", () => ({ createPrompt: vi.fn(), updatePrompt: vi.fn() }));

vi.mock("@/lib/ai/embeddings", () => ({ isAISearchEnabled: vi.fn(), semanticSearch: vi.fn() }));

const alice = { id: "user-1", username: "alice", role: "USER", mcpPromptsPublicByDefault: false };

let client: Client;

async function connect(user: McpContext["user"], filters: McpContext["filters"] = {}) {
  const server = createMcpServer({ user, filters, baseUrl: "https://prompts.chat" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
}

const skillRecord = {
  id: "skill-1",
  slug: "pdf-tools",
  title: "PDF Tools",
  content: serializeSkillFiles([
    { filename: "SKILL.md", content: "# PDF" },
    { filename: "scripts/split.py", content: "print('split')" },
  ]),
};

describe("MCP server", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => client?.close());

  describe("tool metadata", () => {
    it("derives annotations from each tool's kind", async () => {
      await connect(null);
      const { tools } = await client.listTools();
      const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

      expect(byName.search_bots.annotations).toMatchObject({ title: "Search Bots", readOnlyHint: true, openWorldHint: false });
      expect(byName.save_bot.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
      expect(byName.remove_file_from_skill.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
      expect(byName.improve_prompt.annotations).toMatchObject({ readOnlyHint: false, openWorldHint: true });
    });

    it("declares an output schema for every structured tool", async () => {
      await connect(null);
      const { tools } = await client.listTools();
      const withoutSchema = tools.filter((tool) => !tool.outputSchema).map((tool) => tool.name);
      expect(withoutSchema).toEqual(["improve_prompt"]);
    });

    it("rejects a malformed cursor as a tool error", async () => {
      await connect(null);
      const result = await client.callTool({ name: "search_prompts", arguments: { query: "x", cursor: "!!" } });
      expect(result.isError).toBe(true);
      expect(JSON.parse((result.content as { text: string }[])[0].text)).toMatchObject({ code: "invalid_cursor" });
    });
  });

  describe("get_prompt", () => {
    const record = {
      id: "p-1",
      slug: "email-writer",
      title: "Email writer",
      description: null,
      content: "Write to ${recipient} in a ${tone:friendly} tone.",
      type: "TEXT",
      structuredFormat: null,
      isPrivate: false,
      author: { username: "alice", name: null },
      category: null,
      tags: [],
    };

    it("fills variables from `variables` and reports the ones still missing", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(record as never);
      await connect(null);

      const filled = await client.callTool({ name: "get_prompt", arguments: { id: "p-1", variables: { recipient: "Bob" } } });
      expect(filled.structuredContent).toMatchObject({
        content: "Write to Bob in a friendly tone.",
        originalContent: record.content,
        variables: [{ name: "recipient" }, { name: "tone", defaultValue: "friendly" }],
      });
      expect(filled.structuredContent).not.toHaveProperty("missingVariables");

      const missing = await client.callTool({ name: "get_prompt", arguments: { id: "p-1" } });
      expect(missing.structuredContent).toMatchObject({ content: record.content, missingVariables: ["recipient"] });
      expect(missing.content).toContainEqual(expect.objectContaining({ type: "resource_link", uri: "prompts-chat://prompts/p-1" }));
    });

    it("lets owners read their own private prompts", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue({ ...record, isPrivate: true } as never);
      await connect(alice);

      const result = await client.callTool({ name: "get_prompt", arguments: { id: "p-1" } });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toEqual({
        id: "p-1",
        deletedAt: null,
        OR: [{ isPrivate: false, isUnlisted: false }, { authorId: "user-1" }],
      });
      expect(result.structuredContent).toMatchObject({ link: null });
    });
  });

  describe("search_prompts", () => {
    it("pages with an opaque cursor", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      await connect(null);

      await client.callTool({ name: "search_prompts", arguments: { query: "x", limit: 5, cursor: encodeCursor(10) } });

      expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]).toMatchObject({ skip: 10, take: 5 });
    });
  });

  describe("writes go through the web flow", () => {
    it("save_prompt stores structured prompts the way the website does", async () => {
      vi.mocked(createPrompt).mockResolvedValue({
        ok: true,
        data: {
          id: "p-2",
          slug: "config",
          title: "Config",
          description: null,
          content: "{}",
          isPrivate: true,
          type: "TEXT",
          structuredFormat: "YAML",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          tags: [],
          category: null,
        },
      } as never);
      await connect(alice);

      const result = await client.callTool({
        name: "save_prompt",
        arguments: { title: "Config", content: "{}", type: "STRUCTURED", structuredFormat: "YAML" },
      });

      expect(vi.mocked(createPrompt).mock.calls[0]).toEqual([
        alice,
        expect.objectContaining({ type: "TEXT", structuredFormat: "YAML", isPrivate: true, tagIds: [] }),
      ]);
      expect(result.structuredContent).toMatchObject({ success: true, prompt: { id: "p-2", link: null } });
    });

    it("save_prompt only uses existing tags and reports unknown ones", async () => {
      vi.mocked(db.tag.findMany).mockResolvedValue([{ id: "tag-1", name: "Coding", slug: "coding" }] as never);
      vi.mocked(createPrompt).mockResolvedValue({
        ok: true,
        data: { id: "p-3", slug: "x", title: "X", content: "x", isPrivate: true, type: "TEXT", createdAt: new Date(), tags: [], category: null },
      } as never);
      await connect(alice);

      const result = await client.callTool({ name: "save_prompt", arguments: { title: "X", content: "x", tags: ["CODING", "nonexistent"] } });

      expect(vi.mocked(createPrompt).mock.calls[0][1]).toMatchObject({ tagIds: ["tag-1"] });
      expect(db.tag.create).not.toHaveBeenCalled();
      expect(result.structuredContent).toMatchObject({ success: true, unknownTags: ["nonexistent"] });
      expect((result.structuredContent as { warning: string }).warning).toMatch(/nonexistent/);
    });

    it("save_prompt surfaces duplicate checks as tool errors", async () => {
      vi.mocked(createPrompt).mockResolvedValue({
        ok: false,
        status: 409,
        body: { error: "duplicate_prompt", message: "You already have a prompt with this title" },
      });
      await connect(alice);

      const result = await client.callTool({ name: "save_prompt", arguments: { title: "Config", content: "{}" } });

      expect(result.isError).toBe(true);
      expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual({
        error: "You already have a prompt with this title",
        code: "duplicate_prompt",
      });
    });

    it("update_skill_file saves through updatePrompt so a version is recorded", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(skillRecord as never);
      vi.mocked(updatePrompt).mockResolvedValue({ ok: true, data: {} } as never);
      await connect(alice);

      const result = await client.callTool({
        name: "update_skill_file",
        arguments: { skillId: "skill-1", filename: "scripts/split.py", content: "print('v2')" },
      });

      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toEqual({ id: "skill-1", type: "SKILL", authorId: "user-1", deletedAt: null });
      expect(updatePrompt).toHaveBeenCalledWith(alice, "skill-1", {
        content: serializeSkillFiles([
          { filename: "SKILL.md", content: "# PDF" },
          { filename: "scripts/split.py", content: "print('v2')" },
        ]),
      });
      expect(result.structuredContent).toMatchObject({ success: true, files: ["SKILL.md", "scripts/split.py"] });
    });

    it("save_skill requires SKILL.md", async () => {
      await connect(alice);
      const result = await client.callTool({
        name: "save_skill",
        arguments: { title: "T", files: [{ filename: "notes.md", content: "x" }] },
      });
      expect(result.isError).toBe(true);
      expect(createPrompt).not.toHaveBeenCalled();
    });
  });

  describe("resources", () => {
    it("advertises templates for prompts, skills, skill files and bots", async () => {
      await connect(null);
      const { resourceTemplates } = await client.listResourceTemplates();
      expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual([
        "prompts-chat://prompts/{id}",
        "prompts-chat://skills/{id}/files/{+path}",
        "prompts-chat://skills/{id}",
        "prompts-chat://bots/{id}",
      ]);
    });

    it("lists nothing for anonymous clients and the caller's own items otherwise", async () => {
      await connect(null);
      expect((await client.listResources()).resources).toEqual([]);
      await client.close();

      vi.mocked(db.prompt.findMany).mockImplementation(
        (async (args: { where?: { type?: unknown } }) => (args.where?.type === "BOT" ? [] : [{ id: "p-1", title: "Mine", description: null }])) as never
      );
      vi.mocked(db.prompt.count).mockResolvedValue(0);
      await connect(alice);
      const { resources } = await client.listResources();
      expect(resources).toContainEqual(expect.objectContaining({ uri: "prompts-chat://prompts/p-1", name: "Mine" }));
      expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]?.where).toMatchObject({ authorId: "user-1" });
    });

    it("reads a skill as one content entry per file, and a single file by path", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(skillRecord as never);
      await connect(null);

      const skill = await client.readResource({ uri: "prompts-chat://skills/skill-1" });
      expect(skill.contents).toEqual([
        { uri: "prompts-chat://skills/skill-1/files/SKILL.md", mimeType: "text/markdown", text: "# PDF" },
        { uri: "prompts-chat://skills/skill-1/files/scripts/split.py", mimeType: "text/plain", text: "print('split')" },
      ]);

      const file = await client.readResource({ uri: "prompts-chat://skills/skill-1/files/scripts/split.py" });
      expect(file.contents).toEqual([
        { uri: "prompts-chat://skills/skill-1/files/scripts/split.py", mimeType: "text/plain", text: "print('split')" },
      ]);
    });

    it("reads a prompt as Markdown and hides what the caller may not see", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValueOnce({ title: "T", description: "D", content: "C" } as never).mockResolvedValueOnce(null);
      await connect(null);

      const prompt = await client.readResource({ uri: "prompts-chat://prompts/p-1" });
      expect(prompt.contents[0]).toMatchObject({ mimeType: "text/markdown", text: "# T\n\nD\n\nC\n" });
      expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toMatchObject({ id: "p-1", OR: [{ isPrivate: false, isUnlisted: false }] });

      await expect(client.readResource({ uri: "prompts-chat://prompts/secret" })).rejects.toThrow(/not found/);
    });
  });

  describe("prompts capability", () => {
    it("lists prompts with their variables as arguments, narrowed by the URL filters", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([
        { id: "p-1", slug: "email-writer", title: "Email writer", description: null },
        { id: "p-2", slug: "plain", title: "Plain", description: null },
      ] as never);
      vi.mocked(db.$queryRaw).mockResolvedValue([
        { id: "p-1", placeholder: "recipient" },
        { id: "p-1", placeholder: "tone:friendly" },
        { id: "p-1", placeholder: "recipient" },
      ] as never);
      await connect(alice, { users: ["bob"], tags: ["email"] });

      const { prompts, nextCursor } = await client.listPrompts();

      expect(prompts).toEqual([
        {
          name: "email-writer",
          title: "Email writer",
          arguments: [
            { name: "recipient", required: true },
            { name: "tone", description: "Default: friendly", required: false },
          ],
        },
        { name: "plain", title: "Plain" },
      ]);
      expect(nextCursor).toBeUndefined();
      expect(vi.mocked(db.prompt.findMany).mock.calls[0][0]?.where).toMatchObject({
        isPrivate: false,
        type: { not: "BOT" },
        tags: { some: { tag: { slug: { in: ["email"] } } } },
        author: { username: { in: ["bob"] } },
      });
    });

    it("never loads full prompt content to build the list (#1118)", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([{ id: "p-1", slug: "a", title: "A", description: null }] as never);
      vi.mocked(db.$queryRaw).mockResolvedValue([] as never);
      await connect(null);

      await client.listPrompts();

      const { select } = vi.mocked(db.prompt.findMany).mock.calls[0][0]!;
      expect(select).not.toHaveProperty("content");
      const [sql, ...params] = vi.mocked(db.$queryRaw).mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
      expect(sql.join("?")).toMatch(/regexp_matches\(p\.content/);
      expect(sql.join("?")).not.toMatch(/SELECT[^]*\bp\.content\b[^]*FROM/);
      expect(params).toContainEqual(["p-1"]);
    });

    it("skips the placeholder query for an empty page", async () => {
      vi.mocked(db.prompt.findMany).mockResolvedValue([]);
      await connect(null);
      expect((await client.listPrompts()).prompts).toEqual([]);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("fills arguments into the prompt message", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue({
        id: "p-1",
        slug: "email-writer",
        title: "Email writer",
        description: null,
        content: "To ${recipient}, ${tone:friendly}",
      } as never);
      await connect(null);

      const result = await client.getPrompt({ name: "email-writer", arguments: { recipient: "Bob" } });

      expect(result.messages).toEqual([{ role: "user", content: { type: "text", text: "To Bob, friendly" } }]);
    });
  });
});

describe("prompt variables", () => {
  it("extracts names and defaults once each", () => {
    expect(extractVariables("${a} ${b:x y} ${a}")).toEqual([{ name: "a" }, { name: "b", defaultValue: "x y" }]);
  });

  it("fills values, falls back to defaults and leaves the rest", () => {
    expect(fillVariables("${a} ${b:def} ${c}", { a: "1" })).toBe("1 def ${c}");
    expect(fillVariables("${a}", { a: "$& $1" })).toBe("$& $1");
  });

  it("reports variables with neither a value nor a default", () => {
    expect(missingVariables("${a} ${b:def} ${c}", { a: "1" })).toEqual(["c"]);
  });
});
