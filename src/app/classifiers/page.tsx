import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { ClassifierCatalog } from "@/components/classifiers/classifier-catalog";
import {
  CLASSIFIER_CATEGORIES,
  getChains,
  getClassifiers,
  type ClassifierCategoryId,
} from "@/lib/classifiers";
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

  return (
    <div className="container py-6">
      <div className="mb-6 max-w-3xl space-y-3">
        <h1 className="text-lg font-semibold">{tSeo("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <span className="font-medium text-foreground">{t("disclaimerTitle")}</span> {t("disclaimer")}
          </p>
        </div>
      </div>

      <ClassifierCatalog
        classifiers={getClassifiers()}
        chains={getChains()}
        initialQuery={params.q ?? ""}
        initialCategory={parseCategory(params.category)}
      />
    </div>
  );
}
