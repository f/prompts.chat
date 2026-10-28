import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { toBotView, type BotView } from "@/lib/bots";
import { botPairingsSchema, MAX_BOT_PAIRINGS } from "@/lib/bots/schema";
import {
  BotPairingError,
  buildPairingRows,
  canonicalPair,
  getBotPairings,
  getBundleInstallOptions,
  getBundleInstallPrompt,
  pairedBotIds,
} from "@/lib/bots/pairings";

vi.mock("@/lib/db", () => ({
  db: {
    botPairing: { findMany: vi.fn() },
    prompt: { findMany: vi.fn() },
  },
}));

const BASE = "https://prompts.chat";

function botRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `${id}-slug`,
    title: `Bot ${id}`,
    description: null,
    content: "Do things",
    botPlatform: null,
    botPlatforms: ["HERMES"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    botConfig: null,
    isPrivate: false,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "u1",
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    author: { username: "alice", name: null, avatar: null, verified: false },
    _count: { votes: 0 },
    category: null,
    tags: [],
    ...overrides,
  };
}

function bot(id: string, overrides: Record<string, unknown> = {}): BotView {
  return toBotView(botRecord(id, overrides) as never);
}

describe("canonicalPair", () => {
  it("orders the two ids so each pair has one stored form", () => {
    expect(canonicalPair("b", "a")).toEqual({ fromId: "a", toId: "b" });
    expect(canonicalPair("a", "b")).toEqual({ fromId: "a", toId: "b" });
  });
});

describe("buildPairingRows", () => {
  it("stores links in canonical order with empty notes as null", () => {
    expect(buildPairingRows("m", [{ botId: "z", note: "Shares the inbox" }, { botId: "a", note: "" }])).toEqual([
      { fromId: "m", toId: "z", note: "Shares the inbox" },
      { fromId: "a", toId: "m", note: null },
    ]);
  });

  it("drops repeated targets", () => {
    expect(buildPairingRows("m", [{ botId: "a" }, { botId: "a", note: "again" }])).toHaveLength(1);
  });

  it("rejects pairing a bot with itself", () => {
    expect(() => buildPairingRows("m", [{ botId: "m" }])).toThrow(BotPairingError);
  });
});

describe("pairedBotIds", () => {
  it("returns the other side of each link in either direction", () => {
    const rows = [
      { fromId: "a", toId: "m", note: "one" },
      { fromId: "m", toId: "z", note: null },
      { fromId: "x", toId: "y", note: null },
    ];
    expect(pairedBotIds(rows, "m")).toEqual([
      { botId: "a", note: "one" },
      { botId: "z", note: null },
    ]);
  });
});

describe("botPairingsSchema", () => {
  it("accepts notes up to 200 characters", () => {
    expect(botPairingsSchema.safeParse([{ botId: "a", note: "x".repeat(200) }]).success).toBe(true);
    expect(botPairingsSchema.safeParse([{ botId: "a", note: "x".repeat(201) }]).success).toBe(false);
  });

  it("rejects duplicate bots and too many links", () => {
    expect(botPairingsSchema.safeParse([{ botId: "a" }, { botId: "a" }]).success).toBe(false);
    const many = Array.from({ length: MAX_BOT_PAIRINGS + 1 }, (_, i) => ({ botId: `b${i}` }));
    expect(botPairingsSchema.safeParse(many).success).toBe(false);
  });
});

describe("getBotPairings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns linked bots from both directions, oldest link first, skipping ones not found", async () => {
    vi.mocked(db.botPairing.findMany).mockResolvedValue([
      { fromId: "a", toId: "m", note: "first" },
      { fromId: "m", toId: "z", note: null },
      { fromId: "m", toId: "hidden", note: null },
    ] as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([botRecord("z"), botRecord("a")] as never);

    const pairings = await getBotPairings("m");

    expect(pairings.map(({ bot: paired, note }) => [paired.id, note])).toEqual([
      ["a", "first"],
      ["z", null],
    ]);
    expect(db.botPairing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ fromId: "m" }, { toId: "m" }] }, orderBy: { createdAt: "asc" } })
    );
    expect(db.prompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "BOT", isPrivate: false, isUnlisted: false, deletedAt: null }),
      })
    );
  });

  it("includes private and unlisted bots for the edit form", async () => {
    vi.mocked(db.botPairing.findMany).mockResolvedValue([{ fromId: "a", toId: "m", note: null }] as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([] as never);

    await getBotPairings("m", { includeHidden: true });

    const where = vi.mocked(db.prompt.findMany).mock.calls[0][0]!.where;
    expect(where).toEqual({ type: "BOT", deletedAt: null, id: { in: ["a"] } });
  });

  it("skips the bot query when there are no links", async () => {
    vi.mocked(db.botPairing.findMany).mockResolvedValue([] as never);
    expect(await getBotPairings("m")).toEqual([]);
    expect(db.prompt.findMany).not.toHaveBeenCalled();
  });
});

describe("getBundleInstallPrompt", () => {
  it("lists every bot's markdown URL", () => {
    const prompt = getBundleInstallPrompt([bot("a"), bot("b")], "HERMES", BASE);
    expect(prompt).toContain("Set up these 2 bots on Hermes Agent");
    expect(prompt).toContain(`1. "Bot a": ${BASE}/bots/a_a-slug.md`);
    expect(prompt).toContain(`2. "Bot b": ${BASE}/bots/b_b-slug.md`);
  });

  it("falls back to the single-bot install prompt for a set of one", () => {
    expect(getBundleInstallPrompt([bot("a")], "HERMES", BASE)).toContain('create the "Bot a" bot on Hermes Agent');
  });
});

describe("getBundleInstallOptions", () => {
  it("builds one option per platform of the bot with only the bots that support it", () => {
    const main = bot("m", { botPlatforms: ["GROK_BOT", "HERMES"], installUrl: "https://x.ai/bot/m" });
    const grokOnly = bot("g", { botPlatforms: ["GROK_BOT"], installUrl: "https://x.ai/bot/g" });
    const hermesOnly = bot("h", { botPlatforms: ["HERMES"] });

    const [grok, hermes] = getBundleInstallOptions(main, [grokOnly, hermesOnly], BASE);

    expect(grok.platform).toBe("GROK_BOT");
    expect(grok.bots.map((b) => [b.id, b.installUrl])).toEqual([
      ["m", "https://x.ai/bot/m"],
      ["g", "https://x.ai/bot/g"],
    ]);
    expect(grok.skipped).toEqual(["Bot h"]);
    expect(grok.command).toBeNull();

    expect(hermes.bots.map((b) => b.id)).toEqual(["m", "h"]);
    expect(hermes.bots.every((b) => b.installUrl === null)).toBe(true);
    expect(hermes.skipped).toEqual(["Bot g"]);
    expect(hermes.command).toBe(
      `hermes skills install ${BASE}/bots/m_m-slug/SKILL.md\nhermes skills install ${BASE}/bots/h_h-slug/SKILL.md`
    );
  });

  it("installs AutoGPT bots as Experts through one prompt, with no command or template links", () => {
    const main = bot("m", { botPlatforms: ["HERMES", "AUTOGPT"] });
    const autogptOnly = bot("a", { botPlatforms: ["AUTOGPT"], installUrl: "https://x.ai/bot/a" });
    const hermesOnly = bot("h", { botPlatforms: ["HERMES"] });

    const [, autogpt] = getBundleInstallOptions(main, [autogptOnly, hermesOnly], BASE);

    expect(autogpt.platform).toBe("AUTOGPT");
    expect(autogpt.bots.map((b) => [b.id, b.installUrl])).toEqual([
      ["m", null],
      ["a", null],
    ]);
    expect(autogpt.skipped).toEqual(["Bot h"]);
    expect(autogpt.command).toBeNull();
    expect(autogpt.installPrompt).toContain("Set up these 2 bots as Experts on AutoGPT.");
    expect(autogpt.installPrompt).toContain(`2. "Bot a": ${BASE}/bots/a_a-slug.md`);
  });

  it("installs Dots, Duet and Muse bots through one prompt each, with no command or template links", () => {
    const main = bot("m", { botPlatforms: ["DOTS", "DUET", "MUSE"] });
    const dotsOnly = bot("d", { botPlatforms: ["DOTS"], installUrl: "https://x.ai/bot/d" });
    const duetAndMuse = bot("u", { botPlatforms: ["DUET", "MUSE"] });

    const [dots, duet, muse] = getBundleInstallOptions(main, [dotsOnly, duetAndMuse], BASE);

    expect([dots.platform, duet.platform, muse.platform]).toEqual(["DOTS", "DUET", "MUSE"]);
    expect(dots.bots.map((b) => [b.id, b.installUrl])).toEqual([
      ["m", null],
      ["d", null],
    ]);
    expect(dots.skipped).toEqual(["Bot u"]);
    expect(duet.skipped).toEqual(["Bot d"]);
    expect([dots.command, duet.command, muse.command]).toEqual([null, null, null]);
    expect(dots.installPrompt).toContain("Set up these 2 bots on OpenAI Dots.");
    expect(duet.installPrompt).toContain("Set up these 2 bots on Claude Duet.");
    expect(muse.installPrompt).toContain(`2. "Bot u": ${BASE}/bots/u_u-slug.md`);
  });
});
