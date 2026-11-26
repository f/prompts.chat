"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilterContext } from "@/components/prompts/filter-context";
import { cn } from "@/lib/utils";
import {
  filterChains,
  filterClassifiers,
  type ClassifierCategoryId,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { ChainCard, ClassifierCard, type ClassifierCardData } from "./classifier-cards";

interface ClassifierCatalogProps {
  classifiers: ClassifierCardData[];
  /** Every classifier chains may use, unlisted ones included; defaults to `classifiers` */
  stepClassifiers?: ClassifierDefinition[];
  chains: ClassifierChain[];
  /** Search and category from the URL, set by the listing sidebar */
  query?: string;
  category?: ClassifierCategoryId | null;
}

export function ClassifierCatalog({
  classifiers,
  stepClassifiers = classifiers,
  chains,
  query = "",
  category = null,
}: ClassifierCatalogProps) {
  const t = useTranslations("classifiers");
  const { isFilterPending, setFilterPending } = useFilterContext();

  useEffect(() => {
    setFilterPending(false);
  }, [classifiers, query, category, setFilterPending]);

  const visibleClassifiers = useMemo(
    () => filterClassifiers(classifiers, { query, category }),
    [classifiers, query, category]
  );
  const visibleChains = useMemo(
    () => filterChains(chains, stepClassifiers, { query, category }),
    [chains, stepClassifiers, query, category]
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
    () => Object.fromEntries(stepClassifiers.map((c) => [c.slug, c.name])),
    [stepClassifiers]
  );

  const nothingFound = visibleClassifiers.length === 0 && visibleChains.length === 0;

  return (
    <div className={cn("space-y-8 transition-opacity", isFilterPending && "opacity-60")} aria-busy={isFilterPending}>
      {classifiers.length === 0 && chains.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-muted/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("emptyCatalog")}</p>
        </div>
      ) : nothingFound ? (
        <div className="rounded-[var(--radius)] border bg-muted/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" asChild>
            <Link href="/classifiers">
              <X className="h-3.5 w-3.5" />
              {t("clearFilters")}
            </Link>
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
                  <ClassifierCard key={classifier.slug} classifier={classifier} chainCount={chainCounts[classifier.slug] ?? 0} />
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
    </div>
  );
}
