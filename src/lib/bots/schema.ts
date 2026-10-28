import { z } from "zod";

export const BOT_PLATFORMS = ["GROK_BOT", "OPENCLAW", "HERMES", "AUTOGPT"] as const;
export type BotPlatform = (typeof BOT_PLATFORMS)[number];

export const BOT_PLATFORM_INFO: Record<BotPlatform, { name: string; shortName: string; param: string }> = {
  GROK_BOT: { name: "Grok Bot", shortName: "Grok Bot", param: "grok" },
  OPENCLAW: { name: "OpenClaw", shortName: "OpenClaw", param: "openclaw" },
  HERMES: { name: "Hermes Agent", shortName: "Hermes", param: "hermes" },
  AUTOGPT: { name: "AutoGPT", shortName: "AutoGPT", param: "autogpt" },
};

/** AutoGPT has no import command; the install prompt is pasted into a chat with Otto, its head-of-AI agent */
export const AUTOGPT_CHAT_URL = "https://platform.agpt.co/copilot";

export function platformFromParam(param: string | undefined): BotPlatform | undefined {
  return BOT_PLATFORMS.find((platform) => BOT_PLATFORM_INFO[platform].param === param);
}

/** Dedupes and orders platforms the same way everywhere they are shown */
export function normalizeBotPlatforms(platforms: readonly BotPlatform[]): BotPlatform[] {
  return BOT_PLATFORMS.filter((platform) => platforms.includes(platform));
}

export const botPlatformsSchema = z
  .array(z.enum(BOT_PLATFORMS))
  .min(1, { message: "Select at least one platform" })
  .max(BOT_PLATFORMS.length)
  .transform(normalizeBotPlatforms);

/** Falls back to the legacy single-platform column for rows the backfill has not reached */
export function resolveBotPlatforms(record: {
  botPlatforms?: readonly BotPlatform[] | null;
  botPlatform?: BotPlatform | null;
}): BotPlatform[] {
  const platforms = normalizeBotPlatforms(record.botPlatforms ?? []);
  if (platforms.length > 0) return platforms;
  return [record.botPlatform ?? "OPENCLAW"];
}

/** Column values for a write; botPlatform mirrors the first platform until the column is dropped */
export function botPlatformsData(platforms: readonly BotPlatform[]) {
  const botPlatforms = normalizeBotPlatforms(platforms);
  return { botPlatforms, botPlatform: botPlatforms[0] ?? null };
}

/** Preset lucide icons a bot can use; keys map to components in components/bots/bot-avatar.tsx */
export const BOT_ICONS = [
  "bot",
  "sparkles",
  "rocket",
  "brain",
  "zap",
  "mail",
  "inbox",
  "message-square",
  "bell",
  "calendar",
  "clock",
  "newspaper",
  "megaphone",
  "search",
  "radar",
  "globe",
  "plane",
  "receipt",
  "wallet",
  "dollar-sign",
  "chart",
  "briefcase",
  "shopping-cart",
  "code",
  "terminal",
  "git-branch",
  "bug",
  "shield",
  "book-open",
  "graduation-cap",
  "lightbulb",
  "wrench",
  "palette",
  "camera",
  "music",
  "heart",
  "coffee",
] as const;
export type BotIconName = (typeof BOT_ICONS)[number];

/** Preset colors; each has light and dark mode styles in components/bots/bot-avatar.tsx */
export const BOT_COLORS = ["slate", "red", "orange", "amber", "lime", "emerald", "teal", "sky", "blue", "indigo", "violet", "pink"] as const;
export type BotColor = (typeof BOT_COLORS)[number];

export function isBotIconName(value: string): value is BotIconName {
  return (BOT_ICONS as readonly string[]).includes(value);
}

export function isBotColor(value: string): value is BotColor {
  return (BOT_COLORS as readonly string[]).includes(value);
}

export const botIconSchema = z.enum(BOT_ICONS);
export const botColorSchema = z.enum(BOT_COLORS);

export const botRoutineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** "schedule" runs on a timer, "event" runs when something happens */
  type: z.enum(["schedule", "event"]),
  /** Cron expression for schedules, or a plain description of the event */
  trigger: z.string().trim().min(1).max(200),
  /** Human-readable form of the trigger, e.g. "Every day at 08:00" */
  triggerLabel: z.string().trim().max(200),
  /** Task prompt the agent runs. Routines run in fresh sessions, so it should be self-contained. */
  prompt: z.string().trim().min(1).max(4000),
});

export const botSkillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  /** Platform-specific install source, e.g. a ClawHub ref, a Hermes hub id, or a SKILL.md URL */
  source: z.string().trim().max(300),
});

/** Stored in Prompt.botConfig for prompts of type BOT */
export const botConfigSchema = z.object({
  routines: z.array(botRoutineSchema).max(20),
  skills: z.array(botSkillSchema).max(20),
  connectors: z.array(z.string().trim().min(1).max(50)).max(20),
});

export type BotRoutine = z.infer<typeof botRoutineSchema>;
export type BotSkill = z.infer<typeof botSkillSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

export const EMPTY_BOT_CONFIG: BotConfig = { routines: [], skills: [], connectors: [] };

export function parseBotConfig(value: unknown): BotConfig {
  const parsed = botConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_BOT_CONFIG;
}

export const installUrlSchema = z.string().trim().url().refine((url) => url.startsWith("https://"), {
  message: "Install URL must use https",
});

export const MAX_BOT_PAIRINGS = 12;
export const BOT_PAIRING_NOTE_MAX_LENGTH = 200;

/** One "Better together with" link as sent to the create and update APIs */
export const botPairingInputSchema = z.object({
  botId: z.string().trim().min(1),
  note: z.string().trim().max(BOT_PAIRING_NOTE_MAX_LENGTH).nullish(),
});

export const botPairingsSchema = z
  .array(botPairingInputSchema)
  .max(MAX_BOT_PAIRINGS)
  .refine((pairings) => new Set(pairings.map((p) => p.botId)).size === pairings.length, {
    message: "Each bot can only be paired once",
  });

export type BotPairingInput = z.infer<typeof botPairingInputSchema>;

/** BotPairing rows are stored once per pair, ordered so that fromId < toId */
export function canonicalPair(a: string, b: string): { fromId: string; toId: string } {
  return a < b ? { fromId: a, toId: b } : { fromId: b, toId: a };
}
