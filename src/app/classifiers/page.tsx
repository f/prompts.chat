import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClassifierCatalog } from "@/components/classifiers/classifier-catalog";
import { ClassifierFilters } from "@/components/classifiers/classifier-filters";
import { FilterProvider } from "@/components/prompts/filter-context";
import { CLASSIFIER_CATEGORIES, type ClassifierCategoryId } from "@/lib/classifiers";
import { getClassifierCatalog, getClassifierVotes, listedClassifiers } from "@/lib/classifiers/store";
import { auth } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";

interface ClassifiersPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

function parseCategory(value?: string): ClassifierCategoryId | null {
  return CLASSIFIER_CATEGORIES.find((c) => c === value) ?? null;
}

export async function generateMetadata({ searchParams }: ClassifiersPageProps): Promise<Metadata> {
  const { q, category } = await searchParams;
  const t = await getTranslations("seo.classifiers");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/classifiers",
    noindex: Boolean(q || category),
  });
}

export default async function ClassifiersPage({ searchParams }: ClassifiersPageProps) {
  const t = await getTranslations("classifiers");
  const tSeo = await getTranslations("seo.classifiers");
  const params = await searchParams;
  const [catalog, session] = await Promise.all([getClassifierCatalog(), auth()]);
  const listed = listedClassifiers(catalog);
  const votes = await getClassifierVotes(listed.map((c) => c.id), session?.user?.id);
  const query = params.q?.trim() ?? "";
  const category = parseCategory(params.category);
  const categoryCounts: Partial<Record<ClassifierCategoryId, number>> = {};
  for (const classifier of listed) {
    categoryCounts[classifier.category] = (categoryCounts[classifier.category] ?? 0) + 1;
  }

  return (
    <div className="container py-6">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="classifiers-header">
          <h1 className="min-w-0 text-lg font-semibold wrap-anywhere">{tSeo("heading")}</h1>
          <Button size="sm" className="h-8 shrink-0 text-xs" asChild>
            <Link href="/classifiers/new">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("create")}
            </Link>
          </Button>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("intro")}</p>
        <div className="flex max-w-3xl items-start gap-2 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-medium text-foreground">{t("disclaimerTitle")}</span> {t("disclaimer")}
          </p>
        </div>
      </div>

      <FilterProvider>
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <ClassifierFilters
              categoryCounts={categoryCounts}
              currentFilters={{ q: query || undefined, category: category ?? undefined }}
            />
          </aside>
          <main className="flex-1 min-w-0">
            <ClassifierCatalog
              classifiers={listed.map((c) => ({ ...c, voteCount: votes.counts.get(c.id) ?? 0, voted: votes.voted.has(c.id) }))}
              stepClassifiers={catalog.classifiers}
              chains={catalog.chains}
              query={query}
              category={category}
            />
          </main>
        </div>
      </FilterProvider>
    </div>
  );
}
