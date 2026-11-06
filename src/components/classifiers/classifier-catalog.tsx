"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CLASSIFIER_CATEGORIES,
  filterChains,
  filterClassifiers,
  type ClassifierCategoryId,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { ChainCard, ClassifierCard } from "./classifier-cards";

interface ClassifierCatalogProps {
  classifiers: ClassifierDefinition[];
  chains: ClassifierChain[];
  initialQuery?: string;
  initialCategory?: ClassifierCategoryId | null;
}

export function ClassifierCatalog({
  classifiers,
  chains,
  initialQuery = "",
  initialCategory = null,
}: ClassifierCatalogProps) {
  const t = useTranslations("classifiers");
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<ClassifierCategoryId | null>(initialCategory);

  const visibleClassifiers = useMemo(
    () => filterClassifiers(classifiers, { query, category }),
    [classifiers, query, category]
  );
  const visibleChains = useMemo(
    () => filterChains(chains, classifiers, { query, category }),
    [chains, classifiers, query, category]
  );

  const chainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const chain of chains) {
      for (const slug of new Set(chain.steps.map((s) => s.classifier))) {
        counts[slug] = (counts[slug] ?? 0) + 1;
      }
    }
    return counts;
  }, [chains]);

  const classifierNames = useMemo(
    () => Object.fromEntries(classifiers.map((c) => [c.slug, c.name])),
    [classifiers]
  );

  // Keep filters shareable without a server round trip.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (category) url.searchParams.set("category", category);
    else url.searchParams.delete("category");
    if (url.toString() !== window.location.href) {
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [query, category]);

  const hasFilters = Boolean(query.trim() || category);
  const nothingFound = visibleClassifiers.length === 0 && visibleChains.length === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filterByCategory")}>
          <CategoryButton active={category === null} onClick={() => setCategory(null)}>
            {t("allCategories")}
          </CategoryButton>
          {CLASSIFIER_CATEGORIES.map((id) => (
            <CategoryButton key={id} active={category === id} onClick={() => setCategory(category === id ? null : id)}>
              {t(`categories.${id}`)}
            </CategoryButton>
          ))}
        </div>
      </div>

      {nothingFound ? (
        <div className="rounded-[var(--radius)] border bg-muted/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <>
          {visibleClassifiers.length > 0 && (
            <section aria-labelledby="classifiers-heading" className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 id="classifiers-heading" className="text-base font-semibold">
                  {t("classifiersHeading")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t("classifierCount", { count: visibleClassifiers.length })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleClassifiers.map((classifier) => (
                  <ClassifierCard
                    key={classifier.slug}
                    classifier={classifier}
                    chainCount={chainCounts[classifier.slug] ?? 0}
                  />
                ))}
              </div>
            </section>
          )}

          {visibleChains.length > 0 && (
            <section aria-labelledby="chains-heading" className="space-y-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <h2 id="chains-heading" className="text-base font-semibold">
                    {t("chainsHeading")}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {t("chainCount", { count: visibleChains.length })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{t("chainsDescription")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleChains.map((chain) => (
                  <ChainCard key={chain.slug} chain={chain} classifierNames={classifierNames} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {hasFilters && !nothingFound && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            setQuery("");
            setCategory(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
          {t("clearFilters")}
        </Button>
      )}
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
