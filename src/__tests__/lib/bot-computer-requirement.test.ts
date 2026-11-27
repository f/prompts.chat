import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  botToJson,
  botToMarkdown,
  computerListMark,
  computerListNotes,
  computerFilterWhere,
  getInstallPrompt,
  toBotView,
  type BotView,
} from "@/lib/bots";
import { getBundleInstallPrompt } from "@/lib/bots/pairings";
import { diffOwnBot } from "@/lib/bots/upsert";
import {
  BOT_COMPUTER_REQUIREMENTS,
  botComputerRequirementSchema,
  computerFilterFromParam,
  computerRequirementText,
  isBotComputerRequirement,
  normalizeComputerRequirements,
} from "@/lib/bots/schema";
import { promptCreateSchema, promptUpdateSchema } from "@/lib/prompt-write";

vi.mock("@/lib/db", () => ({ db: {} }));

const BASE = "https://prompts.chat";

function bot(overrides: Record<string, unknown> = {}): BotView {
  return toBotView({
    id: "b1",
    slug: "browser-agent",
    title: "Browser Agent",
    description: null,
    content: "Browse for me",
    botPlatform: null,
    botPlatforms: ["MUSE"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    computerRequirements: [],
    botConfig: { routines: [], skills: [], connectors: [] },
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
  } as never);
}

describe("bot computer requirements", () => {
  it("matches the BotComputerRequirement enum and list column in the Prisma schema", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const values = schema
      .match(/enum BotComputerRequirement \{([^}]*)\}/)![1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
    // NONE stays in the database enum but is never stored or accepted
    expect(values).toEqual(["NONE", ...BOT_COMPUTER_REQUIREMENTS]);
    expect(BOT_COMPUTER_REQUIREMENTS).not.toContain("NONE");
    expect(schema).toMatch(/computerRequirements\s+BotComputerRequirement\[\]\s+@default\(\[\]\)/);
    expect(schema).not.toMatch(/computerRequirement\s+BotComputerRequirement\b/);
  });

  it("moves to the list column with an additive migration, a backfill, then a cleanup", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261031020000_bot_computer_requirements_list/migration.sql"),
      "utf8"
    );
    const add = sql.indexOf(`ADD COLUMN "computerRequirements" "BotComputerRequirement"[] NOT NULL DEFAULT '{}'`);
    const backfill = sql.indexOf(`SET "computerRequirements" = ARRAY["computerRequirement"]`);
    const drop = sql.indexOf(`DROP COLUMN "computerRequirement";`);
    expect(add).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(add);
    expect(sql).toContain(`WHERE "computerRequirement" <> 'NONE'`);
    expect(drop).toBeGreaterThan(backfill);
    expect(sql).not.toMatch(/DROP TYPE|ALTER TYPE/);
  });

  it("parses list filters case-insensitively and rejects unknown values", () => {
    expect(computerFilterFromParam("cloud")).toBe("CLOUD");
    expect(computerFilterFromParam(" Local ")).toBe("LOCAL");
    expect(computerFilterFromParam("none")).toBe("NONE");
    expect(computerFilterFromParam("desktop")).toBeUndefined();
    expect(computerFilterFromParam(null)).toBeUndefined();
    expect(isBotComputerRequirement("CLOUD")).toBe(true);
    expect(isBotComputerRequirement("NONE")).toBe(false);
    expect(isBotComputerRequirement("cloud")).toBe(false);
    expect(botComputerRequirementSchema.safeParse("REMOTE").success).toBe(false);
  });

  it("filters bots that need a computer, alone or with the other, or that need none", () => {
    expect(computerFilterWhere(undefined)).toEqual({});
    expect(computerFilterWhere("CLOUD")).toEqual({ computerRequirements: { has: "CLOUD" } });
    expect(computerFilterWhere("LOCAL")).toEqual({ computerRequirements: { has: "LOCAL" } });
    expect(computerFilterWhere("NONE")).toEqual({ computerRequirements: { isEmpty: true } });
  });

  it("normalizes lists: known values only, no duplicates, cloud first", () => {
    expect(normalizeComputerRequirements(["LOCAL", "CLOUD", "LOCAL"])).toEqual(["CLOUD", "LOCAL"]);
    expect(normalizeComputerRequirements(["NONE", "LOCAL"])).toEqual(["LOCAL"]);
    expect(normalizeComputerRequirements(null)).toEqual([]);
    expect(bot({ computerRequirements: ["LOCAL", "CLOUD"] }).computerRequirements).toEqual(["CLOUD", "LOCAL"]);
    expect(bot({ computerRequirements: ["NONE"] }).computerRequirements).toEqual([]);
  });

  it("is an optional list when writing a prompt and only accepts known values", () => {
    const base = { title: "B", content: "c", type: "BOT", botPlatforms: ["MUSE"], tagIds: [], isPrivate: false };
    expect(promptCreateSchema.safeParse(base).success).toBe(true);
    const both = promptCreateSchema.safeParse({ ...base, computerRequirements: ["LOCAL", "CLOUD", "CLOUD"] });
    expect(both.success && both.data.computerRequirements).toEqual(["CLOUD", "LOCAL"]);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirements: [] }).success).toBe(true);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirements: ["local"] }).success).toBe(false);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirements: ["NONE"] }).success).toBe(false);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirements: "CLOUD" }).success).toBe(false);
    expect(promptUpdateSchema.safeParse({ computerRequirements: ["CLOUD"] }).success).toBe(true);
  });

  it("describes the computers for install prompts and bot files, and nothing when none are needed", () => {
    expect(computerRequirementText([])).toBeNull();
    expect(computerRequirementText(["CLOUD"], "user")).toMatch(/needs a cloud computer.*ask me to connect one/);
    expect(computerRequirementText(["LOCAL"], "user")).toMatch(/access to my own computer/);
    expect(computerRequirementText(["LOCAL"])).toMatch(/the user's computer/);
    const both = computerRequirementText(["CLOUD", "LOCAL"], "user");
    expect(both).toMatch(/^This bot needs two computers: a cloud computer/);
    expect(both).toMatch(/access to my own computer/);
    expect(computerRequirementText(["CLOUD", "LOCAL"])).toMatch(/two computers.*cloud computer.*the user's computer/);
  });

  it("leads the install prompt with what the bot needs", () => {
    expect(getInstallPrompt(bot(), "MUSE", BASE)).toMatch(/^Go to /);
    const prompt = getInstallPrompt(bot({ computerRequirements: ["CLOUD"] }), "MUSE", BASE);
    expect(prompt).toMatch(/^This bot needs a cloud computer/);
    expect(prompt).toContain(`Go to ${BASE}/bots/b1_browser-agent.md`);
    expect(getInstallPrompt(bot({ computerRequirements: ["CLOUD", "LOCAL"] }), "MUSE", BASE)).toMatch(/^This bot needs two computers/);
  });

  it("is part of the bot JSON and markdown", () => {
    const local = bot({ computerRequirements: ["LOCAL"] });
    expect(botToJson(local, BASE)).toMatchObject({ computerRequirements: ["LOCAL"] });
    expect(botToJson(bot(), BASE)).toMatchObject({ computerRequirements: [] });
    expect(botToJson(bot(), BASE)).not.toHaveProperty("computerRequirement");
    const markdown = botToMarkdown(local, BASE);
    expect(markdown).toContain("computers: [LOCAL]");
    expect(markdown).toContain("## Computer\n\nThis bot needs the user's computer");
    expect(botToMarkdown(bot({ computerRequirements: ["CLOUD", "LOCAL"] }), BASE)).toContain("computers: [CLOUD, LOCAL]");
    expect(botToMarkdown(bot(), BASE)).toContain("computers: []");
    expect(botToMarkdown(bot(), BASE)).not.toContain("## Computer");
  });

  it("marks bots in a bundle install prompt and explains only the marks used", () => {
    expect(computerListMark([])).toBe("");
    expect(computerListMark(["LOCAL", "CLOUD"])).toBe(" [needs a cloud computer, needs my computer]");
    expect(computerListNotes([bot()])).toEqual([]);
    const prompt = getBundleInstallPrompt(
      [bot(), bot({ id: "b2", slug: "desk", title: "Desk", computerRequirements: ["CLOUD"] })],
      "MUSE",
      BASE
    );
    expect(prompt).toContain(`2. "Desk" [needs a cloud computer]: ${BASE}/bots/b2_desk.md`);
    expect(prompt).toContain(`1. "Browser Agent": `);
    expect(prompt).toContain("Bots that need a cloud computer");
    expect(prompt).not.toContain("Bots that need my computer");

    const both = getBundleInstallPrompt(
      [bot({ computerRequirements: ["CLOUD", "LOCAL"] }), bot({ id: "b2", slug: "desk", title: "Desk" })],
      "MUSE",
      BASE
    );
    expect(both).toContain(`1. "Browser Agent" [needs a cloud computer, needs my computer]: `);
    expect(both).toContain(`2. "Desk": `);
    expect(both).toContain("Bots that need a cloud computer");
    expect(both).toContain("Bots that need my computer");
  });

  it("is diffed on update as a set and kept when omitted", () => {
    const existing = bot({ computerRequirements: ["CLOUD"] });
    const input = { title: existing.title, content: existing.instructions, botPlatforms: existing.platforms };
    expect(diffOwnBot(existing, input)).toEqual({});
    expect(diffOwnBot(existing, { ...input, computerRequirements: ["CLOUD"] })).toEqual({});
    expect(diffOwnBot(existing, { ...input, computerRequirements: ["LOCAL"] })).toEqual({ computerRequirements: ["LOCAL"] });
    expect(diffOwnBot(existing, { ...input, computerRequirements: [] })).toEqual({ computerRequirements: [] });
    const both = bot({ computerRequirements: ["CLOUD", "LOCAL"] });
    expect(diffOwnBot(both, { ...input, computerRequirements: ["LOCAL", "CLOUD"] })).toEqual({});
  });
});
