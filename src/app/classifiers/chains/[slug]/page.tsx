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
import { Disclosure } from "@/components/classifiers/disclosure";
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
      <div className="mx-auto max-w-5xl">
        <Link
          href="/classifiers"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToCatalog")}
        </Link>

        <header className="mb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Route className="h-3.5 w-3.5" />
              {t("decisionChain")}
            </span>
            <CategoryBadge category={chain.category} linked />
            <span className="text-xs text-muted-foreground">
              {t("stepCount", { count: chain.steps.length })} · {t("endpointCount", { count: chain.terminals.length })}
            </span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{chain.name}</h1>
            <CopyTextButton label={t("copyLink")} copyPageUrl variant="outline" />
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{chain.summary}</p>
        </header>

        <ChainFlow chain={chain} classifiers={classifiers} chainNames={chainNames} />

        <section aria-labelledby="about-chain-heading" className="mt-6 space-y-2">
          <h2 id="about-chain-heading" className="text-sm font-semibold">
            {t("aboutChain")}
          </h2>
          <div className="grid items-start gap-2 md:grid-cols-3" data-testid="chain-about">
            <AboutPanel summary={t("goalAndInput")}>
              <p className="text-foreground">{chain.goal}</p>
              <p>{chain.input.summary}</p>
              <dl className="divide-y rounded-[var(--radius)] border">
                {chain.input.fields.map((field) => (
                  <div key={field.name} className="space-y-0.5 p-2">
                    <dt className="font-mono text-foreground">{field.name}</dt>
                    <dd>{field.description}</dd>
                  </div>
                ))}
              </dl>
            </AboutPanel>

            <AboutPanel summary={t("howItRuns")}>
              <ul className="list-disc space-y-1.5 pl-4 marker:text-muted-foreground/60">
                {chain.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AboutPanel>

            <AboutPanel summary={`${t("sources")} (${chain.references.length})`}>
              <p>{t("chainSourcesDescription")}</p>
              <ul className="space-y-2">
                {chain.references.map((id) => {
                  const ref = REFERENCES[id];
                  return (
                    <li key={id} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SourcedBadge />
                        <span>
                          {ref.publisher} · {t(`referenceKinds.${REFERENCE_KIND_KEYS[ref.kind]}`)}
                        </span>
                      </div>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                      >
                        {ref.title}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </AboutPanel>
          </div>
        </section>
      </div>
    </div>
  );
}

function AboutPanel({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <Disclosure
      summary={summary}
      className="rounded-[var(--radius)] border bg-card"
      summaryClassName="px-3 py-2.5 text-sm"
      contentClassName="space-y-2 border-t px-3 py-3 text-xs text-muted-foreground"
    >
      {children}
    </Disclosure>
  );
}
