"use client";

import { useTranslations } from "next-intl";
import { PromptFilters } from "@/components/prompts/prompt-filters";
import { BOT_PLATFORMS, BOT_PLATFORM_INFO } from "@/lib/bots/schema";

type PromptFiltersProps = Parameters<typeof PromptFilters>[0];

interface TeamFiltersProps {
  categories: PromptFiltersProps["categories"];
  tags: PromptFiltersProps["tags"];
  currentFilters: PromptFiltersProps["currentFilters"];
}

/** The /bots sidebar for teams: search, member platform, category and tags */
export function TeamFilters({ categories, tags, currentFilters }: TeamFiltersProps) {
  const t = useTranslations("bots");

  return (
    <PromptFilters
      basePath="/bots/teams"
      categories={categories}
      tags={tags}
      currentFilters={currentFilters}
      searchPlaceholder={t("teams.searchPlaceholder")}
      showSort={false}
      primaryFilter={{
        param: "platform",
        label: t("form.platform"),
        options: BOT_PLATFORMS.map((platform) => ({
          value: BOT_PLATFORM_INFO[platform].param,
          label: BOT_PLATFORM_INFO[platform].name,
        })),
      }}
    />
  );
}
