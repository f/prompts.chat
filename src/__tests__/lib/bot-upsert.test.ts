import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt, promptCreateSchema, promptUpdateSchema } from "@/lib/prompt-write";
import { diffOwnBot, findOwnBot, upsertOwnBot, type OwnBotInput } from "@/lib/bots/upsert";
import { toBotView } from "@/lib/bots";

vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prompt-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prompt-write")>();
  return { ...actual, createPrompt: vi.fn(), updatePrompt: vi.fn() };
});

const user = { id: "user-1", role: "USER" };

function botRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "bot-1",
    slug: "inbox-triage",
    title: "Inbox Triage",
    description: "Sorts my inbox",
    content: "Triage my inbox every morning.",
    botPlatform: "OPENCLAW",
    botPlatforms: ["OPENCLAW", "HERMES"],
    botIcon: "inbox",
    botColor: "sky",
    installUrl: null,
    botConfig: {
      routines: [{ name: "Morning", type: "schedule", trigger: "0 8 * * *", triggerLabel: "Every day at 08:00", prompt: "Triage the inbox." }],
      skills: [],
      connectors: ["Gmail"],
    },
    isPrivate: true,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: { username: "alice", name: "Alice", avatar: null, verified: false },
    _count: { votes: 0 },
    category: { id: "cat-1", name: "Productivity", slug: "productivity", parent: null },
    tags: [{ tag: { id: "tag-1", name: "email", slug: "email", color: "#000" } }],
    ...overrides,
  };
}

/** Input that describes botRecord() exactly */
function sameInput(overrides: Partial<OwnBotInput> = {}): OwnBotInput {
  return {
    title: "Inbox Triage",
    description: "Sorts my inbox",
    content: "Triage my inbox every morning.",
    botPlatforms: ["HERMES", "OPENCLAW"],
    botIcon: "inbox",
    botColor: "sky",
    routines: [{ name: "Morning", type: "schedule", trigger: "0 8 * * *", triggerLabel: "Every day at 08:00", prompt: "Triage the inbox." }],
    connectors: ["Gmail"],
    categoryId: "cat-1",
    tagIds: ["tag-1"],
    isPrivate: true,
    ...overrides,
  };
}

describe("findOwnBot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only looks at the caller's live bots", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    await findOwnBot("user-1", { id: "bot-9" });

    expect(db.prompt.findFirst).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.prompt.findFirst).mock.calls[0][0]?.where).toEqual({
      authorId: "user-1",
      type: "BOT",
      deletedAt: null,
      id: "bot-9",
    });
  });

  it("does not fall back to slug or title when an id is given", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    expect(await findOwnBot("user-1", { id: "bot-9", slug: "inbox-triage", title: "Inbox Triage" })).toBeNull();
    expect(db.prompt.findFirst).toHaveBeenCalledTimes(1);
  });

  it("matches by slug, then by case-insensitive title", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(botRecord() as never);

    const bot = await findOwnBot("user-1", { slug: "old-slug", title: " inbox triage " });

    expect(bot?.id).toBe("bot-1");
    const calls = vi.mocked(db.prompt.findFirst).mock.calls;
    expect(calls[0][0]?.where).toMatchObject({ authorId: "user-1", slug: "old-slug" });
    expect(calls[1][0]?.where).toMatchObject({ authorId: "user-1", title: { equals: "inbox triage", mode: "insensitive" } });
  });
});

describe("diffOwnBot", () => {
  const existing = toBotView(botRecord() as never);

  it("is empty when the input matches the stored bot", () => {
    expect(diffOwnBot(existing, sameInput())).toEqual({});
  });

  it("keeps stored values for omitted optional fields", () => {
    expect(diffOwnBot(existing, { title: "Inbox Triage", content: "Triage my inbox every morning.", botPlatforms: ["OPENCLAW", "HERMES"] })).toEqual({});
  });

  it("returns only changed fields", () => {
    const patch = diffOwnBot(existing, sameInput({ content: "New instructions", botPlatforms: ["GROK_BOT"], botIcon: null }));
    expect(patch).toEqual({ content: "New instructions", botPlatforms: ["GROK_BOT"], botIcon: null });
    expect(promptUpdateSchema.safeParse(patch).success).toBe(true);
  });

  it("merges a partial config with the stored one", () => {
    const patch = diffOwnBot(existing, { ...sameInput(), routines: undefined, connectors: ["Gmail", "Slack"] });
    expect(patch).toEqual({ botConfig: { routines: existing.config.routines, skills: [], connectors: ["Gmail", "Slack"] } });
  });

  it("ignores whitespace the schema would trim from the config", () => {
    expect(diffOwnBot(existing, sameInput({ connectors: [" Gmail "] }))).toEqual({});
  });

  it("detects tag and category changes", () => {
    expect(diffOwnBot(existing, sameInput({ tagIds: ["tag-2"], categoryId: null }))).toEqual({ tagIds: ["tag-2"], categoryId: null });
  });
});

describe("upsertOwnBot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a bot through createPrompt with a valid BOT body", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(createPrompt).mockResolvedValue({ ok: true, data: { id: "bot-new" } } as never);
    vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(botRecord({ id: "bot-new" }) as never);

    const result = await upsertOwnBot(user, { title: "Inbox Triage", content: "Triage.", botPlatforms: ["OPENCLAW"] }, { defaultPrivate: true });

    expect(result).toMatchObject({ ok: true, data: { action: "created", changedFields: [], bot: { id: "bot-new" } } });
    const body = vi.mocked(createPrompt).mock.calls[0][1];
    expect(vi.mocked(createPrompt).mock.calls[0][0]).toBe(user);
    expect(body).toMatchObject({
      type: "BOT",
      title: "Inbox Triage",
      content: "Triage.",
      botPlatforms: ["OPENCLAW"],
      botConfig: { routines: [], skills: [], connectors: [] },
      tagIds: [],
      isPrivate: true,
    });
    expect(promptCreateSchema.safeParse(body).success).toBe(true);
    expect(updatePrompt).not.toHaveBeenCalled();
  });

  it("lets an explicit isPrivate override the default", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(createPrompt).mockResolvedValue({ ok: true, data: { id: "bot-new" } } as never);
    vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(botRecord({ id: "bot-new" }) as never);

    await upsertOwnBot(user, { title: "A", content: "B", botPlatforms: ["DUET"], isPrivate: false }, { defaultPrivate: true });

    expect(vi.mocked(createPrompt).mock.calls[0][1]).toMatchObject({ isPrivate: false });
  });

  it("writes nothing when the stored bot already matches", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);

    const result = await upsertOwnBot(user, sameInput());

    expect(result).toMatchObject({ ok: true, data: { action: "unchanged", changedFields: [], bot: { id: "bot-1" } } });
    expect(createPrompt).not.toHaveBeenCalled();
    expect(updatePrompt).not.toHaveBeenCalled();
  });

  it("updates only the changed fields through updatePrompt", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
    vi.mocked(updatePrompt).mockResolvedValue({ ok: true, data: { id: "bot-1" } } as never);
    vi.mocked(db.prompt.findUniqueOrThrow).mockResolvedValue(botRecord({ content: "New" }) as never);

    const result = await upsertOwnBot(user, sameInput({ content: "New" }));

    expect(updatePrompt).toHaveBeenCalledWith(user, "bot-1", { content: "New" });
    expect(result).toMatchObject({ ok: true, data: { action: "updated", changedFields: ["content"], bot: { instructions: "New" } } });
    expect(createPrompt).not.toHaveBeenCalled();
  });

  it("does not change privacy on update unless asked", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);

    const result = await upsertOwnBot(user, sameInput({ isPrivate: undefined }), { defaultPrivate: false });

    expect(result).toMatchObject({ ok: true, data: { action: "unchanged" } });
  });

  it("returns 404 for an id that is not one of the caller's bots", async () => {
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);

    const result = await upsertOwnBot(user, sameInput({ id: "someone-elses-bot" }));

    expect(result).toEqual({ ok: false, status: 404, body: { error: "not_found", message: "Bot not found or you don't own it" } });
    expect(createPrompt).not.toHaveBeenCalled();
    expect(updatePrompt).not.toHaveBeenCalled();
  });

  it("passes create errors through unchanged", async () => {
    const failure = { ok: false as const, status: 429, body: { error: "rate_limit", message: "Please wait 30 seconds before creating another prompt" } };
    vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
    vi.mocked(createPrompt).mockResolvedValue(failure);

    expect(await upsertOwnBot(user, sameInput())).toBe(failure);
    expect(db.prompt.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("passes update validation errors through unchanged", async () => {
    const failure = { ok: false as const, status: 400, body: { error: "validation_error", message: "Invalid input", details: [] } };
    vi.mocked(db.prompt.findFirst).mockResolvedValue(botRecord() as never);
    vi.mocked(updatePrompt).mockResolvedValue(failure);

    expect(await upsertOwnBot(user, sameInput({ installUrl: "http://insecure.example" }))).toBe(failure);
  });
});
