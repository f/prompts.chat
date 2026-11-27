import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { textItems, type DiffItem } from "@/lib/list-diff";
import { classifierConfigSchema, classifierSummarySchema, parseClassifierConfig, type ClassifierConfig } from "./schema";

/**
 * The fields of a CLASSIFIER prompt that change requests and versions cover besides its title.
 * Prompt.content is derived from these fields and never edited directly. Stored as JSON in
 * ChangeRequest.originalClassifier/proposedClassifier and, with the title, in PromptVersion.classifierSnapshot.
 */
export interface ClassifierFields {
  /** The classifier summary (Prompt.description) */
  description: string;
  config: ClassifierConfig;
}

export interface ClassifierSnapshot {
  title: string;
  fields: ClassifierFields;
}

/** Body field `classifier` of POST/PATCH /api/prompts and `proposedClassifier` of change requests */
export const classifierFieldsInputSchema = z.object({
  description: classifierSummarySchema,
  config: classifierConfigSchema,
});

export function classifierFieldsFromRecord(record: { description: string | null; classifierConfig: unknown }): ClassifierFields | null {
  const config = parseClassifierConfig(record.classifierConfig);
  return config ? { description: record.description ?? "", config } : null;
}

/** Prompt columns to select for classifierFieldsFromRecord */
export const classifierFieldsSelect = {
  description: true,
  classifierSlug: true,
  classifierConfig: true,
} as const;

/** Stored classifier fields, or null when the JSON is missing or not classifier fields */
export function parseClassifierFields(value: unknown): ClassifierFields | null {
  if (!value || typeof value !== "object") return null;
  const parsed = classifierFieldsInputSchema.safeParse(value);
  if (!parsed.success) return null;
  const config = parseClassifierConfig(parsed.data.config);
  return config ? { description: parsed.data.description, config } : null;
}

/** Validated classifier JSON as a Prisma JSON value (scenario states are arbitrary JSON) */
export function classifierJson(value: ClassifierConfig | ClassifierFields | ReturnType<typeof versionClassifierSnapshot>): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** JSON stored in PromptVersion.classifierSnapshot */
export function versionClassifierSnapshot(title: string, fields: ClassifierFields) {
  return { title, ...fields };
}

export function parseVersionClassifierSnapshot(value: unknown): ClassifierSnapshot | null {
  const fields = parseClassifierFields(value);
  const title = value && typeof value === "object" ? (value as { title?: unknown }).title : undefined;
  return fields && typeof title === "string" ? { title, fields } : null;
}

export function classifierFieldsEqual(a: ClassifierFields, b: ClassifierFields): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Keys of the text projection of a classifier, in display order; labels live in "changeRequests.classifierFields" */
export const CLASSIFIER_TEXT_FIELDS = [
  "title",
  "summary",
  "category",
  "problem",
  "goal",
  "input",
  "question",
  "options",
  "outcomes",
  "scenarios",
  "guidance",
  "caveats",
  "tags",
  "references",
] as const;
export type ClassifierTextField = (typeof CLASSIFIER_TEXT_FIELDS)[number];

/** The list-like classifier fields, diffed item by item rather than as text */
export const CLASSIFIER_LIST_FIELDS = [
  "input",
  "options",
  "outcomes",
  "scenarios",
  "guidance",
  "caveats",
  "tags",
  "references",
] as const satisfies readonly ClassifierTextField[];
export type ClassifierListField = (typeof CLASSIFIER_LIST_FIELDS)[number];

function stateText(state: unknown): string {
  return typeof state === "string" ? state : JSON.stringify(state, null, 2);
}

/** Items per list-like field, matched by key (option key, outcome id, scenario id, …) */
export function classifierSnapshotItems(fields: ClassifierFields | null): Record<ClassifierListField, DiffItem[]> | null {
  if (!fields) return null;
  const { config } = fields;
  return {
    input: config.input.fields.map((f) => ({ key: f.name, text: f.name, detail: f.description })),
    options: config.question.options.map((o) => ({ key: o.key, text: o.key, detail: o.description })),
    outcomes: config.outcomes.map((o) => ({ key: o.id, text: `${o.label} (${o.tone})`, detail: o.when })),
    scenarios: config.scenarios.map((s) => ({
      key: s.id,
      text: `${s.title} → ${s.outcome}`,
      detail: [stateText(s.state), s.rationale].join("\n"),
    })),
    guidance: textItems(config.guidance),
    caveats: textItems(config.caveats ?? []),
    tags: textItems(config.tags),
    references: textItems(config.references),
  };
}

/** A classifier as plain text per field, for the same word diff as prompt content */
export function classifierSnapshotTexts(snapshot: { title: string; fields: ClassifierFields | null }): Partial<Record<ClassifierTextField, string>> {
  const { title, fields } = snapshot;
  if (!fields) return { title };
  const { config } = fields;
  return {
    title,
    summary: fields.description,
    category: config.category,
    problem: config.problem,
    goal: config.goal,
    input: [config.input.summary, ...config.input.fields.map((f) => `${f.name}: ${f.description}`)].join("\n"),
    question: `${config.question.type} · ${config.question.key}\n${config.question.instructions}`,
    options: config.question.options.map((o) => `${o.key}: ${o.description}`).join("\n"),
    outcomes: config.outcomes.map((o) => `${o.id} · ${o.label} (${o.tone}): ${o.when}`).join("\n"),
    scenarios: config.scenarios
      .map((s) => [`${s.title} → ${s.outcome}`, stateText(s.state), s.rationale].join("\n"))
      .join("\n\n"),
    guidance: config.guidance.join("\n"),
    caveats: (config.caveats ?? []).join("\n"),
    tags: config.tags.join(", "),
    references: config.references.join(", "),
  };
}
