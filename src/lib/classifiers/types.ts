/**
 * Types for the classifier catalog: reusable decision classifiers and the
 * chains that combine them. The question shape mirrors the System One API
 * (`POST /v1/systemone`) documented by TypeSafe, which Kev also implements.
 */

export type ClassifierCategoryId =
  | "support"
  | "refunds"
  | "commerce"
  | "logistics"
  | "moderation"
  | "agents"
  | "grounding"
  | "security"
  | "incidents"
  | "engineering"
  | "documents"
  | "research"
  | "education";

/** System One question types used in the catalog (image-only `box` is omitted). */
export type QuestionType = "choice" | "score" | "noul";

/** JSON-compatible state, as accepted by the System One `state` field. */
export type ClassifierState = string | { [key: string]: ClassifierStateValue };
export type ClassifierStateValue =
  | string
  | number
  | boolean
  | null
  | ClassifierStateValue[]
  | { [key: string]: ClassifierStateValue };

/**
 * One entry of a question's criteria.
 * - choice: `key` is the option name sent in `criteria`
 * - score: `key` is the level index ("0", "1", ...) in rubric order
 * - noul: `key` is "true" or "false"
 */
export interface QuestionOption {
  key: string;
  description: string;
}

export interface ClassifierQuestion {
  /** Name of the question in the request; answers come back under this key. */
  key: string;
  type: QuestionType;
  instructions: string;
  options: QuestionOption[];
}

/** How an outcome should be handled, used for consistent visual treatment. */
export type OutcomeTone = "proceed" | "caution" | "review" | "stop";

/**
 * A decision the application acts on. Outcomes are derived in code from the
 * model's answer (choice, score or probability) and its confidence.
 */
export interface ClassifierOutcome {
  id: string;
  label: string;
  /** The rule your code applies to the answer to reach this outcome. */
  when: string;
  tone: OutcomeTone;
}

export interface InputField {
  name: string;
  description: string;
}

export interface ClassifierInput {
  summary: string;
  fields: InputField[];
}

/** A predefined example. The outcome is illustrative, never a recorded model output. */
export interface ClassifierScenario {
  id: string;
  title: string;
  state: ClassifierState;
  outcome: string;
  rationale: string;
  /** Set when the example text is adapted from a sourced reference. */
  adaptedFrom?: ReferenceId;
}

export interface BetterTogetherLink {
  slug: string;
  reason: string;
}

export interface ClassifierDefinition {
  slug: string;
  name: string;
  category: ClassifierCategoryId;
  summary: string;
  problem: string;
  goal: string;
  input: ClassifierInput;
  question: ClassifierQuestion;
  outcomes: ClassifierOutcome[];
  guidance: string[];
  /** Limits a reader must not miss, shown prominently. */
  caveats?: string[];
  scenarios: ClassifierScenario[];
  betterTogether: BetterTogetherLink[];
  references: ReferenceId[];
  tags: string[];
}

export type ReferenceKind = "documentation" | "pattern" | "cookbook" | "model-card" | "repository";

export interface SourceReference {
  title: string;
  url: string;
  publisher: string;
  kind: ReferenceKind;
  /** What the source actually shows, in our words. */
  note: string;
}

/** Id of a row in the classifier_sources table, e.g. "typesafe-system-one". */
export type ReferenceId = string;

export interface ClassifierSource extends SourceReference {
  id: ReferenceId;
}

/** Where a step's input comes from: the chain's initial input or an earlier step. */
export interface ChainInputRef {
  from: "input" | string;
  value: string;
}

export interface ChainBranch {
  /** Outcome ids of the step's classifier that follow this branch. */
  outcomes: string[];
  /** Id of the next step or of a terminal. */
  to: string;
  note?: string;
}

export interface ChainStep {
  id: string;
  classifier: string;
  purpose: string;
  receives: ChainInputRef[];
  branches: ChainBranch[];
}

export type TerminalKind = "automated" | "human" | "stop" | "handoff";

export interface ChainTerminal {
  id: string;
  label: string;
  description: string;
  kind: TerminalKind;
  /** For handoff terminals: the chain that continues the work. */
  handoffChain?: string;
}

export interface ChainPathStep {
  step: string;
  outcome: string;
  note: string;
}

/** A predefined walk through the chain. Outcomes are illustrative. */
export interface ChainScenario {
  id: string;
  title: string;
  summary: string;
  input: ClassifierState;
  path: ChainPathStep[];
  terminal: string;
}

export interface ClassifierChain {
  slug: string;
  name: string;
  category: ClassifierCategoryId;
  summary: string;
  goal: string;
  input: ClassifierInput;
  entry: string;
  steps: ChainStep[];
  terminals: ChainTerminal[];
  scenarios: ChainScenario[];
  notes: string[];
  references: ReferenceId[];
}

export interface ClassifierAuthor {
  id: string;
  name: string | null;
  username: string;
  avatar: string | null;
  verified: boolean;
}

/** A classifier as stored: a prompt of type CLASSIFIER with its definition and shared prompt fields. */
export interface ClassifierRecord extends ClassifierDefinition {
  /** Prompt id, used by the shared prompt APIs (votes, comments, change requests, versions) */
  id: string;
  /** Curated catalog entries have fixed ids; everything else was added by a member */
  curated: boolean;
  author: ClassifierAuthor;
  isPrivate: boolean;
  isUnlisted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
