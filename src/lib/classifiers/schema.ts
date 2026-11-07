import { z } from "zod";
import { CLASSIFIER_CATEGORIES } from "./categories";
import type {
  BetterTogetherLink,
  ClassifierCategoryId,
  ClassifierDefinition,
  ClassifierInput,
  ClassifierOutcome,
  ClassifierQuestion,
  ClassifierScenario,
  ClassifierState,
} from "./types";

/**
 * Shape and size limits of a classifier's structured fields, stored in Prompt.classifierConfig.
 * The prompt's title is the classifier name and its description the summary; "Better together"
 * links live in the classifier_pairings table. Semantic rules (outcomes per option, scenario
 * outcomes, …) are checked by validateClassifierDefinition in ./index.
 */

/** Curated catalog entries are imported with fixed ids (cuid ids never contain a hyphen): `classifier-<slug>` and `chain-<slug>` */
export const CURATED_CLASSIFIER_ID_PREFIX = "classifier-";
export const CURATED_CHAIN_ID_PREFIX = "chain-";

export function curatedClassifierId(slug: string) {
  return `${CURATED_CLASSIFIER_ID_PREFIX}${slug}`;
}

export function curatedChainId(slug: string) {
  return `${CURATED_CHAIN_ID_PREFIX}${slug}`;
}

export const CLASSIFIER_LIMITS = {
  name: 80,
  summary: 300,
  longText: 600,
  inputFields: 12,
  fieldName: 60,
  shortText: 300,
  options: 20,
  optionText: 400,
  outcomes: 24,
  outcomeLabel: 60,
  guidance: 10,
  caveats: 5,
  listItem: 400,
  scenarios: 12,
  scenarioTitle: 80,
  stateChars: 4000,
  stateDepth: 6,
  references: 10,
  tags: 8,
  tag: 30,
  configBytes: 48_000,
} as const;

const L = CLASSIFIER_LIMITS;

export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (max: number) => z.string().trim().min(1).max(max);

function stateDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce<number>((max, child) => Math.max(max, stateDepth(child, depth + 1)), depth + 1);
}

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)])
);

export const classifierStateSchema = z
  .union([z.string().trim().min(1), z.record(z.string(), jsonValue)])
  .refine((state) => JSON.stringify(state).length <= L.stateChars, `State must be at most ${L.stateChars} characters`)
  .refine((state) => stateDepth(state) <= L.stateDepth, `State must be nested at most ${L.stateDepth} levels deep`)
  .refine((state) => typeof state === "string" || Object.keys(state).length > 0, "State must not be empty");

export const classifierConfigSchema = z.object({
  category: z.enum(CLASSIFIER_CATEGORIES as unknown as [ClassifierCategoryId, ...ClassifierCategoryId[]]),
  problem: text(L.longText),
  goal: text(L.longText),
  input: z.object({
    summary: text(L.shortText),
    fields: z
      .array(z.object({ name: z.string().trim().min(1).max(L.fieldName).regex(KEY_PATTERN, "Field names must be snake_case"), description: text(L.shortText) }))
      .min(1)
      .max(L.inputFields),
  }),
  question: z.object({
    key: z.string().trim().min(1).max(L.fieldName).regex(KEY_PATTERN, "Question key must be snake_case"),
    type: z.enum(["choice", "score", "noul"]),
    instructions: text(L.longText),
    options: z.array(z.object({ key: z.string().trim().min(1).max(L.fieldName), description: text(L.optionText) })).min(2).max(L.options),
  }),
  outcomes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(L.fieldName).regex(KEY_PATTERN, "Outcome ids must be snake_case"),
        label: text(L.outcomeLabel),
        when: text(L.shortText),
        tone: z.enum(["proceed", "caution", "review", "stop"]),
      })
    )
    .min(2)
    .max(L.outcomes),
  guidance: z.array(text(L.listItem)).max(L.guidance).default([]),
  caveats: z.array(text(L.listItem)).max(L.caveats).optional(),
  scenarios: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(L.fieldName).regex(SLUG_PATTERN, "Scenario ids must be kebab-case"),
        title: text(L.scenarioTitle),
        state: classifierStateSchema,
        outcome: z.string().trim().min(1).max(L.fieldName),
        rationale: text(L.listItem),
        adaptedFrom: z.string().trim().min(1).max(L.fieldName).optional(),
      })
    )
    .min(1)
    .max(L.scenarios),
  references: z.array(z.string().trim().min(1).max(L.fieldName)).max(L.references).default([]),
  tags: z.array(text(L.tag)).max(L.tags).default([]),
});

export type ClassifierConfig = z.output<typeof classifierConfigSchema>;
export type ClassifierConfigInput = z.input<typeof classifierConfigSchema>;

/** Parses stored or submitted config; null when it is missing or invalid */
export function parseClassifierConfig(value: unknown): ClassifierConfig | null {
  if (!value || typeof value !== "object") return null;
  const parsed = classifierConfigSchema.safeParse(value);
  if (!parsed.success) return null;
  return JSON.stringify(parsed.data).length <= L.configBytes ? parsed.data : null;
}

/** Prompt.title and Prompt.description limits for classifiers */
export const classifierTitleSchema = text(L.name);
export const classifierSummarySchema = text(L.summary);

/** The stored config of a definition: everything except slug, name, summary and pairings */
export function configFromDefinition(def: ClassifierDefinition): ClassifierConfig {
  return {
    category: def.category,
    problem: def.problem,
    goal: def.goal,
    input: def.input,
    question: def.question,
    outcomes: def.outcomes,
    guidance: def.guidance,
    ...(def.caveats && def.caveats.length > 0 && { caveats: def.caveats }),
    scenarios: def.scenarios,
    references: def.references,
    tags: def.tags,
  };
}

export function definitionFromConfig(
  meta: { slug: string; name: string; summary: string },
  config: ClassifierConfig,
  betterTogether: BetterTogetherLink[] = []
): ClassifierDefinition {
  return {
    slug: meta.slug,
    name: meta.name,
    summary: meta.summary,
    category: config.category,
    problem: config.problem,
    goal: config.goal,
    input: config.input as ClassifierInput,
    question: config.question as ClassifierQuestion,
    outcomes: config.outcomes as ClassifierOutcome[],
    guidance: config.guidance,
    ...(config.caveats && config.caveats.length > 0 && { caveats: config.caveats }),
    scenarios: config.scenarios.map((s) => ({ ...s, state: s.state as ClassifierState })) as ClassifierScenario[],
    betterTogether,
    references: config.references,
    tags: config.tags,
  };
}
