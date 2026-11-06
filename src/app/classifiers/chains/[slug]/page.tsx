import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink, Route } from "lucide-react";
import {
  getChain,
  getChains,
  getClassifier,
  REFERENCES,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { buildPageMetadata, NOINDEX_ROBOTS } from "@/lib/seo";
import { CategoryBadge, SourcedBadge } from "@/components/classifiers/classifier-badges";
import { ChainFlow } from "@/components/classifiers/chain-flow";
import { CopyTextButton } from "@/components/classifiers/copy-text-button";
import { REFERENCE_KIND_KEYS } from "@/components/classifiers/classifier-styles";

interface ChainPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getChains().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: ChainPageProps): Promise<Metadata> {
  const { slug } = await params;
  const chain = getChain(slug);
  const t = await getTranslations("seo.classifiers");
  if (!chain) {
    return { title: t("notFound"), robots: NOINDEX_ROBOTS };
  }
  return buildPageMetadata({
    title: t("chainTitle", { name: chain.name }),
    description: chain.summary,
    path: `/classifiers/chains/${chain.slug}`,
  });
}

export default async function ChainPage({ params }: ChainPageProps) {
  const { slug } = await params;
  const chain = getChain(slug);
  if (!chain) notFound();

  const t = await getTranslations("classifiers");
  const classifiers: Record<string, ClassifierDefinition> = {};
  for (const step of chain.steps) {
    const classifier = getClassifier(step.classifier);
    if (classifier) classifiers[classifier.slug] = classifier;
  }
  const chainNames = Object.fromEntries(getChains().map((c) => [c.slug, c.name]));

  return (
    <div className="container py-6">
      <Link
        href="/classifiers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToCatalog")}
      </Link>

      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Route className="h-3.5 w-3.5" />
            {t("decisionChain")}
          </span>
          <CategoryBadge category={chain.category} linked />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{chain.name}</h1>
        <p className="max-w-3xl text-muted-foreground">{chain.summary}</p>
        <div className="flex flex-wrap gap-2">
          <CopyTextButton label={t("copyLink")} copyPageUrl variant="outline" />
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        <aside className="space-y-8 lg:col-start-2 lg:row-start-1">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("goal")}</h2>
            <p className="text-sm text-muted-foreground">{chain.goal}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("chainInput")}</h2>
            <p className="text-sm text-muted-foreground">{chain.input.summary}</p>
            <dl className="divide-y rounded-[var(--radius)] border">
              {chain.input.fields.map((field) => (
                <div key={field.name} className="space-y-0.5 p-2.5">
                  <dt className="font-mono text-xs">{field.name}</dt>
                  <dd className="text-xs text-muted-foreground">{field.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ChainFlow chain={chain} classifiers={classifiers} chainNames={chainNames} />
        </div>

        <aside className="space-y-8 lg:col-start-2 lg:row-start-2 lg:self-start">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("howItRuns")}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
              {chain.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("sources")}</h2>
            <p className="text-xs text-muted-foreground">{t("chainSourcesDescription")}</p>
            <ul className="space-y-2">
              {chain.references.map((id) => {
                const ref = REFERENCES[id];
                return (
                  <li key={id} className="space-y-1 rounded-[var(--radius)] border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SourcedBadge />
                      <span className="text-xs text-muted-foreground">
                        {ref.publisher} · {t(`referenceKinds.${REFERENCE_KIND_KEYS[ref.kind]}`)}
                      </span>
                    </div>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {ref.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
