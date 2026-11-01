import { z } from "zod";
import {
  BOT_PLATFORM_INFO,
  EMPTY_BOT_CONFIG,
  botColorSchema,
  botComputerRequirementsSchema,
  botConfigSchema,
  botIconSchema,
  botPlatformsData,
  botPlatformsSchema,
  installUrlSchema,
  isBotColor,
  isBotIconName,
  normalizeComputerRequirements,
  parseBotConfig,
  resolveBotPlatforms,
  type BotColor,
  type BotComputerRequirement,
  type BotConfig,
  type BotIconName,
  type BotPlatform,
} from "./schema";
import { textItems, type DiffItem } from "@/lib/list-diff";

/**
 * The fields of a BOT prompt that change requests and versions cover besides its title and
 * instructions (Prompt.content). Stored as JSON in ChangeRequest.originalBot/proposedBot and,
 * with the title, in PromptVersion.botSnapshot.
 */
export interface BotFields {
  description: string | null;
  platforms: BotPlatform[];
  icon: BotIconName | null;
  color: BotColor | null;
  computerRequirements: BotComputerRequirement[];
  installUrl: string | null;
  config: BotConfig;
}

/** A whole bot at one point in time: what a change request proposes and a version records */
export interface BotSnapshot {
  title: string;
  instructions: string;
  fields: BotFields;
}

/** Body field `proposedBot` of POST /api/prompts/[id]/changes for bots */
export const botFieldsInputSchema = z.object({
  description: z.string().trim().max(500).nullish(),
  platforms: botPlatformsSchema,
  icon: botIconSchema.nullish().or(z.literal("")),
  color: botColorSchema.nullish().or(z.literal("")),
  computerRequirements: botComputerRequirementsSchema.default([]),
  installUrl: installUrlSchema.nullish().or(z.literal("")),
  config: botConfigSchema.default(EMPTY_BOT_CONFIG),
});

export function botFieldsFromInput(input: z.output<typeof botFieldsInputSchema>): BotFields {
  return {
    description: input.description || null,
    platforms: input.platforms,
    icon: input.icon || null,
    color: input.color || null,
    computerRequirements: normalizeComputerRequirements(input.computerRequirements),
    installUrl: input.installUrl || null,
    config: input.config,
  };
}

/** The bot fields of a prompt row */
export function botFieldsFromRecord(record: {
  description: string | null;
  botPlatform?: BotPlatform | null;
  botPlatforms?: readonly BotPlatform[] | null;
  botIcon: string | null;
  botColor: string | null;
  computerRequirements: readonly unknown[] | null;
  installUrl: string | null;
  botConfig: unknown;
}): BotFields {
  return {
    description: record.description || null,
    platforms: resolveBotPlatforms(record),
    icon: record.botIcon && isBotIconName(record.botIcon) ? record.botIcon : null,
    color: record.botColor && isBotColor(record.botColor) ? record.botColor : null,
    computerRequirements: normalizeComputerRequirements(record.computerRequirements),
    installUrl: record.installUrl || null,
    config: parseBotConfig(record.botConfig),
  };
}

/** Prompt columns to select for botFieldsFromRecord */
export const botFieldsSelect = {
  description: true,
  botPlatform: true,
  botPlatforms: true,
  botIcon: true,
  botColor: true,
  computerRequirements: true,
  installUrl: true,
  botConfig: true,
} as const;

/** Stored bot fields, or null when the JSON is missing or not bot fields */
export function parseBotFields(value: unknown): BotFields | null {
  if (!value || typeof value !== "object") return null;
  const parsed = botFieldsInputSchema.safeParse(value);
  return parsed.success ? botFieldsFromInput(parsed.data) : null;
}

/** Prompt update data that applies the bot fields */
export function botFieldsUpdateData(fields: BotFields) {
  return {
    description: fields.description,
    ...botPlatformsData(fields.platforms),
    botIcon: fields.icon,
    botColor: fields.color,
    computerRequirements: fields.computerRequirements,
    installUrl: fields.installUrl,
    botConfig: fields.config,
  };
}

/** JSON stored in PromptVersion.botSnapshot: the title plus the bot fields (instructions are in content) */
export function versionBotSnapshot(title: string, fields: BotFields) {
  return { title, ...fields };
}

/** The title and bot fields of PromptVersion.botSnapshot, or null for versions saved before bots had snapshots */
export function parseVersionBotSnapshot(value: unknown): { title: string; fields: BotFields } | null {
  const fields = parseBotFields(value);
  const title = value && typeof value === "object" ? (value as { title?: unknown }).title : undefined;
  return fields && typeof title === "string" ? { title, fields } : null;
}

export function botFieldsEqual(a: BotFields, b: BotFields): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function botSnapshotsEqual(a: BotSnapshot, b: BotSnapshot): boolean {
  return a.title === b.title && a.instructions === b.instructions && botFieldsEqual(a.fields, b.fields);
}

/** Keys of the text projection of a bot, in display order; labels live in "changeRequests.botFields" messages */
export const BOT_TEXT_FIELDS = [
  "title",
  "description",
  "platforms",
  "computers",
  "appearance",
  "installUrl",
  "instructions",
  "routines",
  "skills",
  "connectors",
] as const;
export type BotTextField = (typeof BOT_TEXT_FIELDS)[number];

function routineText(routine: BotConfig["routines"][number]): string {
  return [
    `${routine.name} (${routine.type})`,
    `${routine.type === "schedule" ? "Schedule" : "Trigger"}: ${routine.trigger}${routine.triggerLabel ? ` (${routine.triggerLabel})` : ""}`,
    routine.prompt,
  ].join("\n");
}

function skillText(skill: BotConfig["skills"][number]): string {
  return [`${skill.name}${skill.description ? `: ${skill.description}` : ""}`, ...(skill.source ? [skill.source] : [])].join("\n");
}

function routinesText(config: BotConfig): string {
  return config.routines.map(routineText).join("\n\n");
}

function skillsText(config: BotConfig): string {
  return config.skills.map(skillText).join("\n\n");
}

/** The list-like bot fields, diffed item by item rather than as text */
export const BOT_LIST_FIELDS = ["platforms", "computers", "routines", "skills", "connectors"] as const satisfies readonly BotTextField[];
export type BotListField = (typeof BOT_LIST_FIELDS)[number];

/**
 * The list-like fields of a bot as items, so a diff shows only the platforms, computers,
 * routines, skills and connectors that were added or removed. Routines and skills are matched
 * by name, so editing one shows as a change of that item. Null without bot fields.
 */
export function botSnapshotItems(
  fields: BotFields | null,
  computerLabel: (requirement: BotComputerRequirement) => string = (requirement) => requirement
): Record<BotListField, DiffItem[]> | null {
  if (!fields) return null;
  return {
    platforms: fields.platforms.map((platform) => ({ key: platform, text: BOT_PLATFORM_INFO[platform].name })),
    computers: fields.computerRequirements.map((requirement) => ({ key: requirement, text: computerLabel(requirement) })),
    routines: fields.config.routines.map((routine) => ({ key: routine.name, text: routineText(routine) })),
    skills: fields.config.skills.map((skill) => ({ key: skill.name, text: skillText(skill) })),
    connectors: textItems(fields.config.connectors),
  };
}

/**
 * A bot as plain text per field, so every field can be shown in the same word diff as prompt
 * content. Without bot fields (older change requests and versions) only title and instructions are set.
 */
export function botSnapshotTexts(snapshot: { title: string; instructions: string; fields: BotFields | null }): Partial<Record<BotTextField, string>> {
  const { title, instructions, fields } = snapshot;
  if (!fields) return { title, instructions };
  return {
    title,
    description: fields.description ?? "",
    platforms: fields.platforms.map((platform) => BOT_PLATFORM_INFO[platform].name).join(", "),
    computers: fields.computerRequirements.join(", "),
    appearance: [fields.icon, fields.color].filter(Boolean).join(", "),
    installUrl: fields.installUrl ?? "",
    instructions,
    routines: routinesText(fields.config),
    skills: skillsText(fields.config),
    connectors: fields.config.connectors.join(", "),
  };
}

/** Fields whose text differs; fields missing on either side (older records) are skipped */
export function changedBotTextFields(
  original: Partial<Record<BotTextField, string>>,
  modified: Partial<Record<BotTextField, string>>
): BotTextField[] {
  return BOT_TEXT_FIELDS.filter(
    (field) => original[field] !== undefined && modified[field] !== undefined && original[field] !== modified[field]
  );
}
