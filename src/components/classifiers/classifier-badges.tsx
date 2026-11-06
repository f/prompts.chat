import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookCheck, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClassifierCategoryId, ClassifierOutcome, QuestionType } from "@/lib/classifiers";
import { OUTCOME_TONE_CLASSES, OUTCOME_TONE_DOT, QUESTION_TYPE_ICONS } from "./classifier-styles";

export function QuestionTypeBadge({ type, className }: { type: QuestionType; className?: string }) {
  const t = useTranslations("classifiers.questionTypes");
  const Icon = QUESTION_TYPE_ICONS[type];
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px]", className)} title={t(`${type}Description`)}>
      <Icon />
      {t(type)}
    </Badge>
  );
}

export function CategoryBadge({ category, linked = false }: { category: ClassifierCategoryId; linked?: boolean }) {
  const t = useTranslations("classifiers.categories");
  if (linked) {
    return (
      <Badge variant="secondary" asChild>
        <Link href={`/classifiers?category=${category}`} className="hover:bg-secondary/70">
          {t(category)}
        </Link>
      </Badge>
    );
  }
  return <Badge variant="secondary">{t(category)}</Badge>;
}

interface OutcomeChipProps {
  outcome: Pick<ClassifierOutcome, "label" | "tone">;
  emphasized?: boolean;
  muted?: boolean;
  className?: string;
}

export function OutcomeChip({ outcome, emphasized = false, muted = false, className }: OutcomeChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        OUTCOME_TONE_CLASSES[outcome.tone],
        emphasized && "ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
        muted && "opacity-50",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", OUTCOME_TONE_DOT[outcome.tone])} aria-hidden />
      {outcome.label}
    </span>
  );
}

export function IllustrativeBadge({ className }: { className?: string }) {
  const t = useTranslations("classifiers");
  return (
    <Badge
      variant="outline"
      className={cn("border-amber-500/40 text-amber-700 dark:text-amber-300", className)}
      title={t("illustrativeHint")}
    >
      <FlaskConical />
      {t("illustrative")}
    </Badge>
  );
}

export function SourcedBadge({ className }: { className?: string }) {
  const t = useTranslations("classifiers");
  return (
    <Badge variant="outline" className={cn("border-emerald-500/40 text-emerald-700 dark:text-emerald-300", className)}>
      <BookCheck />
      {t("sourced")}
    </Badge>
  );
}
