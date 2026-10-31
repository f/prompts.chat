import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  botToJson,
  botToMarkdown,
  computerListMark,
  computerListNotes,
  getInstallPrompt,
  toBotView,
  type BotView,
} from "@/lib/bots";
import { getBundleInstallPrompt } from "@/lib/bots/pairings";
import { diffOwnBot } from "@/lib/bots/upsert";
import {
  BOT_COMPUTER_REQUIREMENTS,
  botComputerRequirementSchema,
  computerRequirementFromParam,
  computerRequirementText,
  isBotComputerRequirement,
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
    computerRequirement: "NONE",
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

describe("bot computer requirement", () => {
  it("matches the BotComputerRequirement enum and default in the Prisma schema", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const values = schema
      .match(/enum BotComputerRequirement \{([^}]*)\}/)![1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
    expect(values).toEqual([...BOT_COMPUTER_REQUIREMENTS]);
    expect(schema).toMatch(/computerRequirement\s+BotComputerRequirement\s+@default\(NONE\)/);
  });

  it("is added by an additive migration without a backfill", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261031010000_add_bot_computer_requirement/migration.sql"),
      "utf8"
    );
    expect(sql).toContain(`CREATE TYPE "BotComputerRequirement" AS ENUM ('NONE', 'CLOUD', 'LOCAL');`);
    expect(sql).toContain(`ADD COLUMN "computerRequirement" "BotComputerRequirement" NOT NULL DEFAULT 'NONE'`);
    expect(sql).not.toMatch(/\bUPDATE\b|\bDROP\b/i);
  });

  it("parses query params case-insensitively and rejects unknown values", () => {
    expect(computerRequirementFromParam("cloud")).toBe("CLOUD");
    expect(computerRequirementFromParam(" Local ")).toBe("LOCAL");
    expect(computerRequirementFromParam("none")).toBe("NONE");
    expect(computerRequirementFromParam("desktop")).toBeUndefined();
    expect(computerRequirementFromParam(null)).toBeUndefined();
    expect(isBotComputerRequirement("CLOUD")).toBe(true);
    expect(isBotComputerRequirement("cloud")).toBe(false);
    expect(botComputerRequirementSchema.safeParse("REMOTE").success).toBe(false);
  });

  it("is optional when writing a prompt and only accepts known values", () => {
    const base = { title: "B", content: "c", type: "BOT", botPlatforms: ["MUSE"], tagIds: [], isPrivate: false };
    expect(promptCreateSchema.safeParse(base).success).toBe(true);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirement: "LOCAL" }).success).toBe(true);
    expect(promptCreateSchema.safeParse({ ...base, computerRequirement: "local" }).success).toBe(false);
    expect(promptUpdateSchema.safeParse({ computerRequirement: "CLOUD" }).success).toBe(true);
  });

  it("describes the requirement for install prompts and bot files, and nothing for NONE", () => {
    expect(computerRequirementText("NONE")).toBeNull();
    expect(computerRequirementText("CLOUD", "user")).toMatch(/needs a cloud computer.*ask me to connect one/);
    expect(computerRequirementText("LOCAL", "user")).toMatch(/access to my own computer/);
    expect(computerRequirementText("LOCAL")).toMatch(/the user's computer/);
  });

  it("leads the install prompt with what the bot needs", () => {
    expect(getInstallPrompt(bot(), "MUSE", BASE)).toMatch(/^Go to /);
    const prompt = getInstallPrompt(bot({ computerRequirement: "CLOUD" }), "MUSE", BASE);
    expect(prompt).toMatch(/^This bot needs a cloud computer/);
    expect(prompt).toContain(`Go to ${BASE}/bots/b1_browser-agent.md`);
  });

  it("is part of the bot JSON and markdown", () => {
    const local = bot({ computerRequirement: "LOCAL" });
    expect(botToJson(local, BASE)).toMatchObject({ computerRequirement: "LOCAL" });
    const markdown = botToMarkdown(local, BASE);
    expect(markdown).toContain("computer: LOCAL");
    expect(markdown).toContain("## Computer\n\nThis bot needs the user's computer");
    expect(botToMarkdown(bot(), BASE)).not.toContain("## Computer");
  });

  it("marks bots in a bundle install prompt and explains only the marks used", () => {
    expect(computerListMark("NONE")).toBe("");
    expect(computerListNotes([bot()])).toEqual([]);
    const prompt = getBundleInstallPrompt(
      [bot(), bot({ id: "b2", slug: "desk", title: "Desk", computerRequirement: "CLOUD" })],
      "MUSE",
      BASE
    );
    expect(prompt).toContain(`2. "Desk" [needs a cloud computer]: ${BASE}/bots/b2_desk.md`);
    expect(prompt).toContain(`1. "Browser Agent": `);
    expect(prompt).toContain("Bots that need a cloud computer");
    expect(prompt).not.toContain("Bots that need my computer");
  });

  it("is diffed on update and kept when omitted", () => {
    const existing = bot({ computerRequirement: "CLOUD" });
    const input = { title: existing.title, content: existing.instructions, botPlatforms: existing.platforms };
    expect(diffOwnBot(existing, input)).toEqual({});
    expect(diffOwnBot(existing, { ...input, computerRequirement: "CLOUD" })).toEqual({});
    expect(diffOwnBot(existing, { ...input, computerRequirement: "LOCAL" })).toEqual({ computerRequirement: "LOCAL" });
  });
});
