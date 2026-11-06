import { CLASSIFIERS } from "./data/classifiers";
import { CHAINS } from "./data/chains";
import { REFERENCES } from "./references";
import type {
  ClassifierCategoryId,
  ClassifierChain,
  ClassifierDefinition,
  ClassifierState,
  ChainStep,
  ChainTerminal,
} from "./types";

export * from "./types";
export { REFERENCES, getReference } from "./references";

export const CLASSIFIER_CATEGORIES: ClassifierCategoryId[] = [
  "support",
  "refunds",
  "moderation",
  "agents",
  "grounding",
  "security",
];

/** Limits from the System One API reference. */
export const MAX_CHOICE_OPTIONS = 255;
export const MAX_SCORE_LEVELS = 10;

export const JEV_MODEL = "jev-latest";
export const KEV_MODEL = "kev-latest";
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** Default address of a local Kev server, from the Kev model card. */
export const KEV_LOCAL_ENDPOINT = "http://127.0.0.1:8008/v1/systemone";

export function getClassifiers(): ClassifierDefinition[] {
  return CLASSIFIERS;
}

export function getClassifier(slug: string): ClassifierDefinition | undefined {
  return CLASSIFIERS.find((c) => c.slug === slug);
}

export function getChains(): ClassifierChain[] {
  return CHAINS;
}

export function getChain(slug: string): ClassifierChain | undefined {
  return CHAINS.find((c) => c.slug === slug);
}

export function getChainsForClassifier(slug: string): ClassifierChain[] {
  return CHAINS.filter((chain) => chain.steps.some((step) => step.classifier === slug));
}

/** Chains in which both classifiers take part. */
export function getSharedChains(a: string, b: string): ClassifierChain[] {
  return CHAINS.filter(
    (chain) =>
      chain.steps.some((s) => s.classifier === a) && chain.steps.some((s) => s.classifier === b)
  );
}

export function getChainNode(
  chain: ClassifierChain,
  id: string
): { type: "step"; step: ChainStep } | { type: "terminal"; terminal: ChainTerminal } | undefined {
  const step = chain.steps.find((s) => s.id === id);
  if (step) return { type: "step", step };
  const terminal = chain.terminals.find((t) => t.id === id);
  if (terminal) return { type: "terminal", terminal };
  return undefined;
}

export function getOutcome(classifier: ClassifierDefinition, outcomeId: string) {
  return classifier.outcomes.find((o) => o.id === outcomeId);
}

/** The criteria value sent for a question, shaped per question type. */
function buildCriteria(classifier: ClassifierDefinition) {
  const { type, options } = classifier.question;
  if (type === "score") {
    return options.map((o) => o.description);
  }
  return Object.fromEntries(options.map((o) => [o.key, o.description]));
}

const PLACEHOLDER_STATE_PREFIX = "<";

function placeholderState(classifier: ClassifierDefinition): ClassifierState {
  return Object.fromEntries(
    classifier.input.fields.map((f) => [f.name, `${PLACEHOLDER_STATE_PREFIX}${f.name}>`])
  );
}

/**
 * Build a `POST /v1/systemone` request body for a classifier. The same body
 * works against TypeSafe's hosted Jev and a self-hosted Kev server.
 */
export function buildSystemOneRequest(
  classifier: ClassifierDefinition,
  options: { model?: string; state?: ClassifierState } = {}
) {
  const { key, type, instructions } = classifier.question;
  return {
    model: options.model ?? JEV_MODEL,
    state: options.state ?? placeholderState(classifier),
    questions: {
      [key]: {
        type,
        instructions,
        criteria: buildCriteria(classifier),
      },
    },
  };
}

/** Plain-text definition for copying into docs, tickets or prompts. */
export function formatClassifierDefinition(classifier: ClassifierDefinition): string {
  const { question } = classifier;
  const lines = [
    `# ${classifier.name}`,
    "",
    classifier.summary,
    "",
    `Question (${question.type}, key "${question.key}"):`,
    question.instructions,
    "",
    question.type === "score" ? "Levels:" : "Options:",
    ...question.options.map((o) => `- ${o.key}: ${o.description}`),
    "",
    "Outcomes:",
    ...classifier.outcomes.map((o) => `- ${o.label} (${o.id}): ${o.when}`),
    "",
    "Input:",
    ...classifier.input.fields.map((f) => `- ${f.name}: ${f.description}`),
  ];
  if (classifier.caveats?.length) {
    lines.push("", "Caveats:", ...classifier.caveats.map((c) => `- ${c}`));
  }
  return lines.join("\n");
}

export function formatClassifierOutcomes(classifier: ClassifierDefinition): string {
  return classifier.outcomes.map((o) => `${o.id}: ${o.label} — ${o.when}`).join("\n");
}

export interface CatalogFilter {
  query?: string;
  category?: ClassifierCategoryId | null;
}

function matchesQuery(haystack: string[], query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.join(" ").toLowerCase();
  return terms.every((term) => text.includes(term));
}

export function filterClassifiers(
  classifiers: ClassifierDefinition[],
  { query = "", category = null }: CatalogFilter
): ClassifierDefinition[] {
  return classifiers.filter((c) => {
    if (category && c.category !== category) return false;
    if (!query.trim()) return true;
    return matchesQuery(
      [
        c.name,
        c.summary,
        c.problem,
        c.question.instructions,
        c.question.type,
        ...c.tags,
        ...c.outcomes.map((o) => o.label),
      ],
      query
    );
  });
}

export function filterChains(
  chains: ClassifierChain[],
  classifiers: ClassifierDefinition[],
  { query = "", category = null }: CatalogFilter
): ClassifierChain[] {
  return chains.filter((chain) => {
    const stepClassifiers = chain.steps
      .map((s) => classifiers.find((c) => c.slug === s.classifier))
      .filter((c): c is ClassifierDefinition => Boolean(c));
    if (category && chain.category !== category && !stepClassifiers.some((c) => c.category === category)) {
      return false;
    }
    if (!query.trim()) return true;
    return matchesQuery([chain.name, chain.summary, chain.goal, ...stepClassifiers.map((c) => c.name)], query);
  });
}

export interface ScenarioHighlight {
  steps: Set<string>;
  /** Keys of the form `${stepId}->${targetId}`. */
  edges: Set<string>;
  terminal: string;
  outcomes: Map<string, string>;
}

export function getScenarioHighlight(chain: ClassifierChain, scenarioId: string): ScenarioHighlight | undefined {
  const scenario = chain.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return undefined;
  const steps = new Set<string>();
  const edges = new Set<string>();
  const outcomes = new Map<string, string>();
  for (const { step, outcome } of scenario.path) {
    steps.add(step);
    outcomes.set(step, outcome);
    const branch = chain.steps.find((s) => s.id === step)?.branches.find((b) => b.outcomes.includes(outcome));
    if (branch) edges.add(`${step}->${branch.to}`);
  }
  return { steps, edges, terminal: scenario.terminal, outcomes };
}

/** Step ids that can reach `targetId` through branches. */
function getAncestors(chain: ClassifierChain, targetId: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [targetId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const step of chain.steps) {
      if (!ancestors.has(step.id) && step.branches.some((b) => b.to === current)) {
        ancestors.add(step.id);
        queue.push(step.id);
      }
    }
  }
  return ancestors;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_SLUGS = new Set(["chains"]);

/**
 * Checks the catalog's internal consistency: unique slugs, valid question
 * shapes, real cross-links, and chains whose branches and scenario paths
 * line up with the classifiers they use. Returns a list of problems.
 */
export function validateCatalog(
  classifiers: ClassifierDefinition[] = CLASSIFIERS,
  chains: ClassifierChain[] = CHAINS
): string[] {
  const errors: string[] = [];
  const bySlug = new Map<string, ClassifierDefinition>();

  for (const c of classifiers) {
    const at = `classifier "${c.slug}"`;
    if (bySlug.has(c.slug)) errors.push(`${at}: duplicate slug`);
    bySlug.set(c.slug, c);
    if (!SLUG_PATTERN.test(c.slug)) errors.push(`${at}: slug must be kebab-case`);
    if (RESERVED_SLUGS.has(c.slug)) errors.push(`${at}: slug is reserved`);
    if (!CLASSIFIER_CATEGORIES.includes(c.category)) errors.push(`${at}: unknown category`);
    if (!KEY_PATTERN.test(c.question.key)) errors.push(`${at}: question key must be snake_case`);

    const optionKeys = c.question.options.map((o) => o.key);
    if (new Set(optionKeys).size !== optionKeys.length) errors.push(`${at}: duplicate option keys`);
    if (c.question.type === "noul" && optionKeys.join(",") !== "true,false") {
      errors.push(`${at}: noul options must be "true" then "false"`);
    }
    if (c.question.type === "score") {
      if (optionKeys.some((k, i) => k !== String(i))) errors.push(`${at}: score levels must be keyed 0..n in order`);
      if (optionKeys.length > MAX_SCORE_LEVELS) errors.push(`${at}: too many score levels`);
    }
    if (c.question.type === "choice") {
      if (optionKeys.length < 2 || optionKeys.length > MAX_CHOICE_OPTIONS) errors.push(`${at}: invalid number of choice options`);
      if (optionKeys.some((k) => !KEY_PATTERN.test(k))) errors.push(`${at}: choice option keys must be snake_case`);
    }

    const outcomeIds = c.outcomes.map((o) => o.id);
    if (outcomeIds.length < 2) errors.push(`${at}: needs at least two outcomes`);
    if (new Set(outcomeIds).size !== outcomeIds.length) errors.push(`${at}: duplicate outcome ids`);
    if (!c.outcomes.some((o) => o.tone === "review" || o.tone === "caution")) {
      errors.push(`${at}: needs an outcome for uncertain or borderline answers`);
    }
    if (c.question.type === "choice") {
      for (const key of optionKeys) {
        if (!outcomeIds.includes(key)) errors.push(`${at}: choice option "${key}" has no matching outcome`);
      }
    }

    if (c.scenarios.length < 2) errors.push(`${at}: needs at least two scenarios`);
    const scenarioIds = c.scenarios.map((s) => s.id);
    if (new Set(scenarioIds).size !== scenarioIds.length) errors.push(`${at}: duplicate scenario ids`);
    for (const s of c.scenarios) {
      if (!outcomeIds.includes(s.outcome)) errors.push(`${at}: scenario "${s.id}" uses unknown outcome "${s.outcome}"`);
      if (s.adaptedFrom && !REFERENCES[s.adaptedFrom]) errors.push(`${at}: scenario "${s.id}" cites unknown reference`);
    }

    for (const ref of c.references) {
      if (!REFERENCES[ref]) errors.push(`${at}: unknown reference "${ref}"`);
    }
  }

  for (const c of classifiers) {
    const at = `classifier "${c.slug}"`;
    if (c.betterTogether.length === 0) errors.push(`${at}: needs at least one "better together" link`);
    const linked = new Set<string>();
    for (const link of c.betterTogether) {
      if (link.slug === c.slug) errors.push(`${at}: links to itself`);
      if (!bySlug.has(link.slug)) errors.push(`${at}: links to unknown classifier "${link.slug}"`);
      if (linked.has(link.slug)) errors.push(`${at}: links to "${link.slug}" twice`);
      linked.add(link.slug);
      if (!link.reason.trim()) errors.push(`${at}: link to "${link.slug}" needs a reason`);
    }
  }

  const chainSlugs = new Set<string>();
  for (const chain of chains) {
    const at = `chain "${chain.slug}"`;
    if (chainSlugs.has(chain.slug)) errors.push(`${at}: duplicate slug`);
    chainSlugs.add(chain.slug);
  }

  for (const chain of chains) {
    const at = `chain "${chain.slug}"`;
    if (!SLUG_PATTERN.test(chain.slug)) errors.push(`${at}: slug must be kebab-case`);
    const stepIds = chain.steps.map((s) => s.id);
    const terminalIds = chain.terminals.map((t) => t.id);
    const nodeIds = [...stepIds, ...terminalIds];
    if (new Set(nodeIds).size !== nodeIds.length) errors.push(`${at}: step and terminal ids must be unique`);
    if (!stepIds.includes(chain.entry)) errors.push(`${at}: entry "${chain.entry}" is not a step`);
    if (chain.steps.length < 2) errors.push(`${at}: needs at least two steps`);

    for (const step of chain.steps) {
      const stepAt = `${at} step "${step.id}"`;
      const classifier = bySlug.get(step.classifier);
      if (!classifier) {
        errors.push(`${stepAt}: unknown classifier "${step.classifier}"`);
        continue;
      }
      const covered = step.branches.flatMap((b) => b.outcomes);
      for (const outcome of covered) {
        if (!classifier.outcomes.some((o) => o.id === outcome)) errors.push(`${stepAt}: unknown outcome "${outcome}"`);
      }
      if (new Set(covered).size !== covered.length) errors.push(`${stepAt}: an outcome is used by more than one branch`);
      for (const o of classifier.outcomes) {
        if (!covered.includes(o.id)) errors.push(`${stepAt}: outcome "${o.id}" has no branch`);
      }
      for (const branch of step.branches) {
        if (!nodeIds.includes(branch.to)) errors.push(`${stepAt}: branch leads to unknown node "${branch.to}"`);
        if (branch.to === step.id) errors.push(`${stepAt}: branch loops to itself`);
      }
      const ancestors = getAncestors(chain, step.id);
      for (const input of step.receives) {
        if (input.from !== "input" && !ancestors.has(input.from)) {
          errors.push(`${stepAt}: receives from "${input.from}", which never runs before it`);
        }
      }
    }

    // Every node must be reachable from the entry, and the graph must be acyclic.
    const reachable = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        errors.push(`${at}: cycle through "${id}"`);
        return;
      }
      if (reachable.has(id)) return;
      visiting.add(id);
      reachable.add(id);
      for (const b of chain.steps.find((s) => s.id === id)?.branches ?? []) visit(b.to);
      visiting.delete(id);
    };
    visit(chain.entry);
    for (const id of nodeIds) {
      if (!reachable.has(id)) errors.push(`${at}: "${id}" is unreachable from the entry`);
    }

    for (const terminal of chain.terminals) {
      if (terminal.kind === "handoff") {
        if (!terminal.handoffChain || !chainSlugs.has(terminal.handoffChain)) {
          errors.push(`${at} terminal "${terminal.id}": handoff needs a known chain`);
        } else if (terminal.handoffChain === chain.slug) {
          errors.push(`${at} terminal "${terminal.id}": cannot hand off to itself`);
        }
      } else if (terminal.handoffChain) {
        errors.push(`${at} terminal "${terminal.id}": only handoff terminals may name a chain`);
      }
    }

    if (chain.scenarios.length < 2) errors.push(`${at}: needs at least two scenarios`);
    const reachedTerminals = new Set<string>();
    for (const scenario of chain.scenarios) {
      const scAt = `${at} scenario "${scenario.id}"`;
      if (scenario.path.length === 0) {
        errors.push(`${scAt}: path is empty`);
        continue;
      }
      if (scenario.path[0].step !== chain.entry) errors.push(`${scAt}: must start at the entry step`);
      let next: string | undefined = scenario.path[0].step;
      for (const { step, outcome } of scenario.path) {
        if (step !== next) {
          errors.push(`${scAt}: expected step "${next}" but found "${step}"`);
          break;
        }
        const branch = chain.steps.find((s) => s.id === step)?.branches.find((b) => b.outcomes.includes(outcome));
        if (!branch) {
          errors.push(`${scAt}: outcome "${outcome}" has no branch at step "${step}"`);
          next = undefined;
          break;
        }
        next = branch.to;
      }
      if (next !== undefined && next !== scenario.terminal) {
        errors.push(`${scAt}: path ends at "${next}" but the scenario names "${scenario.terminal}"`);
      }
      if (!terminalIds.includes(scenario.terminal)) errors.push(`${scAt}: unknown terminal "${scenario.terminal}"`);
      reachedTerminals.add(scenario.terminal);
    }
    if (reachedTerminals.size < 2) errors.push(`${at}: scenarios should cover more than one outcome path`);

    for (const ref of chain.references) {
      if (!REFERENCES[ref]) errors.push(`${at}: unknown reference "${ref}"`);
    }
  }

  return errors;
}
