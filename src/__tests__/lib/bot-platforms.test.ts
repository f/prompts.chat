import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { botToJson, botToMarkdown, getBotInstallOptions, getInstallPrompt, toBotView, type BotView } from "@/lib/bots";
import {
  BOT_PLATFORMS,
  BOT_PLATFORM_INFO,
  botPlatformsSchema,
  normalizeBotPlatforms,
  platformFromParam,
} from "@/lib/bots/schema";

vi.mock("@/lib/db", () => ({ db: {} }));

const BASE = "https://prompts.chat";
const ROOT = process.cwd();

function bot(overrides: Record<string, unknown> = {}): BotView {
  return toBotView({
    id: "b1",
    slug: "digest",
    title: "Digest",
    description: null,
    content: "Summarize things",
    botPlatform: null,
    botPlatforms: ["AUTOGPT"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    botConfig: {
      routines: [{ name: "Daily", type: "schedule", trigger: "0 7 * * *", triggerLabel: "", prompt: "Send the digest." }],
      skills: [{ name: "arxiv", description: "", source: "official/research/arxiv" }],
      connectors: [],
    },
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

describe("bot platforms", () => {
  it("match the BotPlatform enum in the Prisma schema", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const values = schema.match(/enum BotPlatform \{([^}]*)\}/)![1].trim().split(/\s+/);
    expect(values).toEqual([...BOT_PLATFORMS]);
  });

  it("each have a migration that adds them to the database enum", () => {
    const dir = join(ROOT, "prisma/migrations");
    const sql = readdirSync(dir)
      .filter((name) => existsSync(join(dir, name, "migration.sql")))
      .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
      .join("\n");
    expect(sql).toContain(`ALTER TYPE "BotPlatform" ADD VALUE 'AUTOGPT';`);
  });

  it("include AutoGPT with a /bots filter param", () => {
    expect(BOT_PLATFORM_INFO.AUTOGPT).toEqual({ name: "AutoGPT", shortName: "AutoGPT", param: "autogpt" });
    expect(platformFromParam("autogpt")).toBe("AUTOGPT");
  });

  it("keep AutoGPT in the shared platform order", () => {
    expect(normalizeBotPlatforms(["AUTOGPT", "GROK_BOT", "AUTOGPT"])).toEqual(["GROK_BOT", "AUTOGPT"]);
    expect(botPlatformsSchema.parse(["AUTOGPT", "HERMES"])).toEqual(["HERMES", "AUTOGPT"]);
    expect(botPlatformsSchema.safeParse([...BOT_PLATFORMS]).success).toBe(true);
  });

  it("have light and dark logos", () => {
    for (const file of ["autogpt.svg", "autogpt-dark.svg"]) {
      expect(readFileSync(join(ROOT, "public/bots", file), "utf8")).toContain("<svg");
    }
  });
});

describe("AutoGPT install", () => {
  it("asks Otto to set the bot up as an Expert", () => {
    expect(getInstallPrompt(bot(), "AUTOGPT", BASE)).toBe(
      `Go to ${BASE}/bots/b1_digest.md and create the "Digest" bot as an Expert on AutoGPT exactly as described there: adopt its instructions as your standing instructions, install its skills, ask me to connect the required connectors, and set up each routine with the given schedule or trigger. Confirm each step when done.`
    );
  });

  it("offers only the install prompt: no template link and no CLI command", () => {
    const [option] = getBotInstallOptions(bot({ installUrl: "https://x.ai/bot/b1" }), BASE);
    expect(option).toMatchObject({ platform: "AUTOGPT", platformName: "AutoGPT", installUrl: null, command: null });
  });

  it("is listed in the markdown and JSON exports without CLI setup commands", () => {
    const markdown = botToMarkdown(bot({ botPlatforms: ["HERMES", "AUTOGPT"] }), BASE);
    expect(markdown).toContain("platforms: [HERMES, AUTOGPT]");
    expect(markdown).toContain("- AutoGPT");
    expect(markdown).toContain("Equivalent Hermes Agent CLI commands");
    expect(markdown).not.toContain("Equivalent AutoGPT");

    const json = botToJson(bot(), BASE);
    expect(json.platformNames).toEqual(["AutoGPT"]);
    expect(json.install).toEqual([
      expect.objectContaining({ platform: "AUTOGPT", installUrl: null, command: null }),
    ]);
  });
});

describe("AutoGPT translations", () => {
  const keys = ["autogptPromptHint", "openAutogpt", "installAllAutogptPromptHint"];
  const dir = join(ROOT, "messages");

  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    it(`${file} has the AutoGPT install strings`, () => {
      const messages = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const key of keys) expect(messages.bots[key], key).toMatch(/AutoGPT/);
      expect(messages.bots.description).toContain("AutoGPT");
    });
  }
});
