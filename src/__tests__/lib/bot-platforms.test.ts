import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { botToJson, botToMarkdown, getBotInstallOptions, getInstallPrompt, toBotView, type BotView } from "@/lib/bots";
import {
  BOT_PLATFORMS,
  BOT_PLATFORM_CHAT_INSTALL,
  BOT_PLATFORM_INFO,
  botPlatformsSchema,
  isChatInstallPlatform,
  normalizeBotPlatforms,
  platformFromParam,
} from "@/lib/bots/schema";
import { platformTabColumns, platformTabSpans } from "@/components/bots/bot-platform-tabs";

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
    for (const platform of BOT_PLATFORMS.filter((p) => !["GROK_BOT", "OPENCLAW", "HERMES"].includes(p))) {
      expect(sql).toContain(`ALTER TYPE "BotPlatform" ADD VALUE '${platform}';`);
    }
  });

  it("add Dots, Duet and Muse in an ADD VALUE-only migration", () => {
    const sql = readFileSync(
      join(ROOT, "prisma/migrations/20261028200000_add_dots_duet_muse_bot_platforms/migration.sql"),
      "utf8"
    );
    const statements = sql
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("--"))
      .map((line) => line.trim());
    expect(statements).toEqual([
      `ALTER TYPE "BotPlatform" ADD VALUE 'DOTS';`,
      `ALTER TYPE "BotPlatform" ADD VALUE 'DUET';`,
      `ALTER TYPE "BotPlatform" ADD VALUE 'MUSE';`,
    ]);
  });

  it("include AutoGPT with a /bots filter param", () => {
    expect(BOT_PLATFORM_INFO.AUTOGPT).toEqual({ name: "AutoGPT", shortName: "AutoGPT", param: "autogpt" });
    expect(platformFromParam("autogpt")).toBe("AUTOGPT");
  });

  it("include Dots, Duet and Muse with full names for tooltips and /bots filter params", () => {
    expect(BOT_PLATFORM_INFO.DOTS).toEqual({ name: "OpenAI Dots", shortName: "Dots", param: "dots" });
    expect(BOT_PLATFORM_INFO.DUET).toEqual({ name: "Claude Duet", shortName: "Duet", param: "duet" });
    expect(BOT_PLATFORM_INFO.MUSE).toEqual({ name: "Meta Muse", shortName: "Muse", param: "muse" });
    expect(platformFromParam("dots")).toBe("DOTS");
    expect(platformFromParam("duet")).toBe("DUET");
    expect(platformFromParam("muse")).toBe("MUSE");
  });

  it("have short tab labels no wider than the one the tab grid is sized for", () => {
    // bot-platform-tabs.tsx sizes its container-query columns for "OpenClaw", the widest label
    expect(BOT_PLATFORMS.map((platform) => BOT_PLATFORM_INFO[platform].shortName)).toEqual([
      "Grok",
      "OpenClaw",
      "Hermes",
      "AutoGPT",
      "Dots",
      "Duet",
      "Muse",
    ]);
  });

  it("keep AutoGPT, Dots, Duet and Muse in the shared platform order", () => {
    expect(normalizeBotPlatforms(["AUTOGPT", "GROK_BOT", "AUTOGPT"])).toEqual(["GROK_BOT", "AUTOGPT"]);
    expect(botPlatformsSchema.parse(["AUTOGPT", "HERMES"])).toEqual(["HERMES", "AUTOGPT"]);
    expect(normalizeBotPlatforms(["MUSE", "DOTS", "OPENCLAW", "DUET", "DOTS"])).toEqual(["OPENCLAW", "DOTS", "DUET", "MUSE"]);
    expect(botPlatformsSchema.safeParse([...BOT_PLATFORMS]).success).toBe(true);
  });

  it("have light and dark logos", () => {
    for (const name of ["autogpt", "dots", "duet", "muse"]) {
      for (const file of [`${name}.svg`, `${name}-dark.svg`]) {
        const svg = readFileSync(join(ROOT, "public/bots", file), "utf8");
        expect(svg, file).toContain("<svg");
        expect(svg, file).toMatch(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) \1"/);
      }
    }
  });
});

describe("platform tabs", () => {
  // Tab list widths measured in the browser: the bundle dialog and page card on a 320px phone, the
  // desktop sidebar, the page card on a 375px phone, the bundle dialog on desktop, and the 768px page
  const CONTAINERS = [238, 262, 286, 317, 462, 686];
  /** The widest short label, "OpenClaw", with its icon and padding */
  const MIN_TAB_WIDTH = 110;
  const TABS_LIST_PADDING = 6;
  const GAP = 4;

  function breakpoint(width: number) {
    if (width >= 512) return "lg";
    if (width >= 384) return "sm";
    if (width >= 232) return "two";
    return "base";
  }

  for (let count = 1; count <= BOT_PLATFORMS.length; count++) {
    it(`fill every row of the 12-column grid with ${count} platform${count === 1 ? "" : "s"}`, () => {
      for (const bp of ["base", "two", "sm", "lg"] as const) {
        const spans = Array.from({ length: count }, (_, index) => platformTabSpans(count, index)[bp]);
        let row = 0;
        for (const span of spans) {
          expect(Number.isInteger(span)).toBe(true);
          row += span;
          expect(row).toBeLessThanOrEqual(12);
          if (row === 12) row = 0;
        }
        expect(row, `${count} tabs at ${bp}`).toBe(0);
      }
    });

    it(`never squeeze ${count} platform${count === 1 ? "" : "s"} below the widest label`, () => {
      for (const width of CONTAINERS) {
        const bp = breakpoint(width);
        const columns = platformTabColumns(count)[bp];
        const inner = width - TABS_LIST_PADDING;
        for (let index = 0; index < count; index++) {
          const span = platformTabSpans(count, index)[bp];
          const tab = (inner - (columns - 1) * GAP) * (span / 12);
          expect(tab, `${count} tabs in ${width}px`).toBeGreaterThanOrEqual(MIN_TAB_WIDTH);
        }
      }
    });
  }

  it("keep the layouts from #1319 for two to four platforms", () => {
    expect(platformTabColumns(2)).toEqual({ base: 1, two: 2, sm: 2, lg: 2 });
    expect(platformTabColumns(3)).toEqual({ base: 1, two: 2, sm: 3, lg: 3 });
    expect(platformTabColumns(4)).toEqual({ base: 1, two: 2, sm: 2, lg: 4 });
    expect(platformTabSpans(3, 2)).toEqual({ base: 12, two: 12, sm: 4, lg: 4 });
  });

  it("lay out seven platforms as 2+2+2+1 in the sidebar, 3+3+1 in the dialog and 4+3 when wide", () => {
    const spans = Array.from({ length: 7 }, (_, index) => platformTabSpans(7, index));
    expect(spans.map((s) => s.two)).toEqual([6, 6, 6, 6, 6, 6, 12]);
    expect(spans.map((s) => s.sm)).toEqual([4, 4, 4, 4, 4, 4, 12]);
    expect(spans.map((s) => s.lg)).toEqual([3, 3, 3, 3, 4, 4, 4]);
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

describe("Dots, Duet and Muse install", () => {
  it.each([
    ["DOTS", "OpenAI Dots", "https://chatgpt.com/dots"],
    ["DUET", "Claude Duet", "https://claude.ai"],
    ["MUSE", "Meta Muse", "https://muse.ai"],
  ] as const)("%s offers the install prompt and a link to the chat, with no template link or CLI command", (platform, name, url) => {
    const [option] = getBotInstallOptions(bot({ botPlatforms: [platform], installUrl: "https://x.ai/bot/b1" }), BASE);
    expect(option).toMatchObject({ platform, platformName: name, installUrl: null, command: null });
    expect(option.installPrompt).toBe(
      `Go to ${BASE}/bots/b1_digest.md and create the "Digest" bot on ${name} exactly as described there: adopt its instructions as your standing instructions, install its skills, ask me to connect the required connectors, and set up each routine with the given schedule or trigger. Confirm each step when done.`
    );
    expect(isChatInstallPlatform(platform)).toBe(true);
    expect(BOT_PLATFORM_CHAT_INSTALL[platform as keyof typeof BOT_PLATFORM_CHAT_INSTALL].url).toBe(url);
  });

  it("only chat-installed platforms get a chat link", () => {
    expect(BOT_PLATFORMS.filter(isChatInstallPlatform)).toEqual(["AUTOGPT", "DOTS", "DUET", "MUSE"]);
  });

  it("are listed in the markdown and JSON exports without CLI setup commands", () => {
    const markdown = botToMarkdown(bot({ botPlatforms: ["MUSE", "HERMES", "DUET", "DOTS"] }), BASE);
    expect(markdown).toContain("platforms: [HERMES, DOTS, DUET, MUSE]");
    expect(markdown).toContain("- OpenAI Dots\n- Claude Duet\n- Meta Muse");
    expect(markdown).not.toMatch(/Equivalent (OpenAI Dots|Claude Duet|Meta Muse)/);

    const json = botToJson(bot({ botPlatforms: ["DOTS", "DUET", "MUSE"] }), BASE);
    expect(json.platformNames).toEqual(["OpenAI Dots", "Claude Duet", "Meta Muse"]);
  });
});

describe("chat install translations", () => {
  const dir = join(ROOT, "messages");
  const brands: Record<string, RegExp> = { AUTOGPT: /AutoGPT/, DOTS: /Dots|ChatGPT/, DUET: /Claude Duet/, MUSE: /Muse/ };

  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    it(`${file} has the install strings for every chat-installed platform`, () => {
      const messages = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const [platform, { hint, bundleHint, open }] of Object.entries(BOT_PLATFORM_CHAT_INSTALL)) {
        for (const key of [hint, bundleHint, open]) expect(messages.bots[key], key).toMatch(brands[platform]);
      }
      for (const name of ["AutoGPT", "OpenAI Dots", "Claude Duet", "Meta Muse"]) {
        expect(messages.bots.description).toContain(name);
        expect(messages.seo.bots.description).toContain(name);
      }
    });
  }
});
