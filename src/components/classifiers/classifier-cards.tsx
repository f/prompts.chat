import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, GitBranch, Route } from "lucide-react";
import type { ClassifierChain, ClassifierDefinition, ClassifierRecord } from "@/lib/classifiers";
import { PromptAuthor } from "@/components/prompts/prompt-author";
import { UpvoteCount } from "@/components/prompts/upvote-count";
import { getClassifierUrl } from "@/lib/urls";
import { CategoryBadge, OutcomeChip, QuestionTypeBadge } from "./classifier-badges";

const MAX_OUTCOMES_SHOWN = 4;

export interface ClassifierCardData extends ClassifierDefinition, Pick<ClassifierRecord, "id" | "author"> {
  voteCount: number;
  /** Whether the signed-in viewer has upvoted it */
  voted?: boolean;
}

interface ClassifierCardProps {
  classifier: ClassifierCardData;
  chainCount: number;
}

export function ClassifierCard({ classifier, chainCount }: ClassifierCardProps) {
  const t = useTranslations("classifiers");
  const hidden = classifier.outcomes.length - MAX_OUTCOMES_SHOWN;

  return (
    <div
      className="group relative flex h-full min-w-0 flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/30"
      data-testid="classifier-card"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <QuestionTypeBadge type={classifier.question.type} />
        <CategoryBadge category={classifier.category} />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold leading-snug wrap-anywhere">
          <Link
            href={getClassifierUrl(classifier.slug)}
            className="group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {classifier.name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{classifier.summary}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {classifier.outcomes.slice(0, MAX_OUTCOMES_SHOWN).map((outcome) => (
          <OutcomeChip key={outcome.id} outcome={outcome} />
        ))}
        {hidden > 0 && (
          <span className="px-1 py-0.5 text-xs text-muted-foreground">+{hidden}</span>
        )}
      </div>
      <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
        <PromptAuthor author={classifier.author} className="relative z-10" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" aria-hidden />
            {t("usedInChainCount", { count: chainCount })}
          </span>
          <UpvoteCount count={classifier.voteCount} voted={classifier.voted} />
        </div>
      </div>
    </div>
  );
}

interface ChainCardProps {
  chain: ClassifierChain;
  classifierNames: Record<string, string>;
}

export function ChainCard({ chain, classifierNames }: ChainCardProps) {
  const t = useTranslations("classifiers");

  return (
    <Link
      href={`/classifiers/chains/${chain.slug}`}
      className="group flex h-full flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/30"
      data-testid="chain-card"
    >
      <div className="flex items-start gap-2">
        <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <h3 className="font-semibold leading-snug group-hover:underline">{chain.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{chain.summary}</p>
        </div>
      </div>
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {chain.steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
            <span className="rounded-[var(--radius)] bg-muted px-1.5 py-0.5">{classifierNames[step.classifier]}</span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
        <span>{t("stepCount", { count: chain.steps.length })}</span>
        <span>{t("endpointCount", { count: chain.terminals.length })}</span>
        <span>{t("scenarioPathCount", { count: chain.scenarios.length })}</span>
      </div>
    </Link>
  );
}
