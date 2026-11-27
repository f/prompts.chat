import { Bot, CircleSlash, Hand, ListChecks, MoveRight, Gauge, ToggleLeft } from "lucide-react";
import type { OutcomeTone, QuestionType, ReferenceKind, TerminalKind } from "@/lib/classifiers";

export const OUTCOME_TONE_CLASSES: Record<OutcomeTone, string> = {
  proceed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  caution: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  review: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  stop: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export const OUTCOME_TONE_DOT: Record<OutcomeTone, string> = {
  proceed: "bg-emerald-500",
  caution: "bg-amber-500",
  review: "bg-sky-500",
  stop: "bg-rose-500",
};

export const QUESTION_TYPE_ICONS: Record<QuestionType, typeof ListChecks> = {
  choice: ListChecks,
  score: Gauge,
  noul: ToggleLeft,
};

export const TERMINAL_KIND_ICONS: Record<TerminalKind, typeof Bot> = {
  automated: Bot,
  human: Hand,
  stop: CircleSlash,
  handoff: MoveRight,
};

export const TERMINAL_KIND_CLASSES: Record<TerminalKind, string> = {
  automated: "border-emerald-500/30 bg-emerald-500/5",
  human: "border-sky-500/30 bg-sky-500/5",
  stop: "border-rose-500/30 bg-rose-500/5",
  handoff: "border-primary/30 bg-primary/5",
};

export const TERMINAL_KIND_TEXT: Record<TerminalKind, string> = {
  automated: "text-emerald-700 dark:text-emerald-300",
  human: "text-sky-700 dark:text-sky-300",
  stop: "text-rose-700 dark:text-rose-300",
  handoff: "text-primary",
};

/** Message keys under `classifiers.referenceKinds`. */
export const REFERENCE_KIND_KEYS: Record<ReferenceKind, string> = {
  documentation: "documentation",
  pattern: "pattern",
  cookbook: "cookbook",
  "model-card": "modelCard",
  repository: "repository",
};
