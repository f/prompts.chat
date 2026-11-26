"use client";

import { useTranslations } from "next-intl";
import { PromptFilters } from "@/components/prompts/prompt-filters";
import { CLASSIFIER_CATEGORIES, type ClassifierCategoryId } from "@/lib/classifiers";

interface ClassifierFiltersProps {
  /** Listed classifiers per category */
  categoryCounts: Partial<Record<ClassifierCategoryId, number>>;
  currentFilters: { q?: string; category?: string };
}

/** The shared listing sidebar with search and the classifier categories; classifiers have no sort or tags */
export function ClassifierFilters({ categoryCounts, currentFilters }: ClassifierFiltersProps) {
  const t = useTranslations("classifiers");

  return (
    <PromptFilters
      basePath="/classifiers"
      categories={CLASSIFIER_CATEGORIES.map((id) => ({
        id,
        name: t(`categories.${id}`),
        slug: id,
        parentId: null,
        count: categoryCounts[id] ?? 0,
      }))}
      tags={[]}
      currentFilters={currentFilters}
      primaryFilter={null}
      showSort={false}
      searchPlaceholder={t("searchPlaceholder")}
    />
  );
}
