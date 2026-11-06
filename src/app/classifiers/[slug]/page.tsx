import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, GitBranch } from "lucide-react";
import {
  formatClassifierDefinition,
  formatClassifierOutcomes,
  getChainsForClassifier,
  getClassifier,
  getClassifiers,
  getSharedChains,
  REFERENCES,
} from "@/lib/classifiers";
import { buildPageMetadata, NOINDEX_ROBOTS } from "@/lib/seo";
import {
  CategoryBadge,
  OutcomeChip,
  QuestionTypeBadge,
  SourcedBadge,
} from "@/components/classifiers/classifier-badges";
import { CopyTextButton } from "@/components/classifiers/copy-text-button";
import { ScenarioExplorer } from "@/components/classifiers/scenario-explorer";
import { RequestSnippet } from "@/components/classifiers/request-snippet";
import { REFERENCE_KIND_KEYS } from "@/components/classifiers/classifier-styles";

interface ClassifierPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getClassifiers().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: ClassifierPageProps): Promise<Metadata> {
  const { slug } = await params;
  const classifier = getClassifier(slug);
  const t = await getTranslations("seo.classifiers");
  if (!classifier) {
    return { title: t("notFound"), robots: NOINDEX_ROBOTS };
  }
  return buildPageMetadata({
    title: t("detailTitle", { name: classifier.name }),
    description: classifier.summary,
    path: `/classifiers/${classifier.slug}`,
  });
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="space-y-0.5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ClassifierPage({ params }: ClassifierPageProps) {
  const { slug } = await params;
  const classifier = getClassifier(slug);
  if (!classifier) notFound();

  const t = await getTranslations("classifiers");
  const chains = getChainsForClassifier(classifier.slug);
  const { question } = classifier;
  const partners = classifier.betterTogether
    .map((link) => ({ link, partner: getClassifier(link.slug), shared: getSharedChains(classifier.slug, link.slug) }))
    .filter((p) => p.partner);

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
          <QuestionTypeBadge type={question.type} />
          <CategoryBadge category={classifier.category} linked />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{classifier.name}</h1>
        <p className="max-w-3xl text-muted-foreground">{classifier.summary}</p>
        <div className="flex flex-wrap gap-2">
          <CopyTextButton label={t("copyDefinition")} text={formatClassifierDefinition(classifier)} />
          <CopyTextButton label={t("copyQuestion")} text={question.instructions} />
          <CopyTextButton label={t("copyOutcomes")} text={formatClassifierOutcomes(classifier)} />
          <CopyTextButton label={t("copyLink")} copyPageUrl variant="ghost" />
        </div>
      </header>

      {classifier.caveats && classifier.caveats.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/40 bg-amber-500/5 p-4" role="note">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("caveats")}</p>
            {classifier.caveats.map((caveat) => (
              <p key={caveat} className="text-sm text-muted-foreground">
                {caveat}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-x-10">
        <div className="space-y-8 lg:col-start-1 lg:row-start-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius)] border p-4">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("problem")}</h2>
              <p className="text-sm">{classifier.problem}</p>
            </div>
            <div className="rounded-[var(--radius)] border p-4">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("goal")}</h2>
              <p className="text-sm">{classifier.goal}</p>
            </div>
          </div>

          <Section id="input-heading" title={t("inputState")} description={classifier.input.summary}>
            <dl className="divide-y rounded-[var(--radius)] border">
              {classifier.input.fields.map((field) => (
                <div key={field.name} className="grid gap-1 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="font-mono text-xs">{field.name}</dt>
                  <dd className="text-sm text-muted-foreground">{field.description}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="question-heading" title={t("decisionQuestion")}>
            <div className="space-y-3 rounded-[var(--radius)] border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <QuestionTypeBadge type={question.type} />
                <span>
                  {t("questionKey")} <code className="font-mono text-foreground">{question.key}</code>
                </span>
              </div>
              <p className="text-base font-medium">{question.instructions}</p>
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`optionsHeading.${question.type}`)}
                </h3>
                <ul className="divide-y rounded-[var(--radius)] border">
                  {question.options.map((option) => (
                    <li key={option.key} className="grid gap-1 p-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <code className="font-mono text-xs">{option.key}</code>
                      <span className="text-sm text-muted-foreground">{option.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section id="outcomes-heading" title={t("outcomes")} description={t("outcomesDescription")}>
            <ul className="divide-y rounded-[var(--radius)] border">
              {classifier.outcomes.map((outcome) => (
                <li key={outcome.id} className="grid gap-1.5 p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                  <OutcomeChip outcome={outcome} className="w-fit" />
                  <span className="text-sm text-muted-foreground">{outcome.when}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="scenarios-heading" title={t("scenarios")}>
            <ScenarioExplorer classifier={classifier} />
          </Section>
        </div>

        <aside className="space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="better-together-heading" className="space-y-3" id="better-together">
            <div className="space-y-0.5">
              <h2 id="better-together-heading" className="text-base font-semibold">
                {t("betterTogether")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("betterTogetherDescription")}</p>
            </div>
            <ul className="space-y-2">
              {partners.map(({ link, partner, shared }) => (
                <li key={link.slug} className="space-y-2 rounded-[var(--radius)] border bg-card p-3" data-testid="better-together-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/classifiers/${partner!.slug}`} className="text-sm font-semibold hover:underline">
                      {partner!.name}
                    </Link>
                    <QuestionTypeBadge type={partner!.question.type} />
                  </div>
                  <p className="text-sm text-muted-foreground">{link.reason}</p>
                  {shared.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="text-muted-foreground">{t("combinedIn")}</span>
                      {shared.map((chain) => (
                        <Link
                          key={chain.slug}
                          href={`/classifiers/chains/${chain.slug}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <GitBranch className="h-3 w-3" />
                          {chain.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="chains-heading" className="space-y-3">
            <h2 id="chains-heading" className="text-base font-semibold">
              {t("usedInChains")}
            </h2>
            {chains.length > 0 ? (
              <ul className="space-y-2">
                {chains.map((chain) => {
                  const position = chain.steps.findIndex((s) => s.classifier === classifier.slug) + 1;
                  return (
                    <li key={chain.slug}>
                      <Link
                        href={`/classifiers/chains/${chain.slug}#step-${chain.steps[position - 1].id}`}
                        className="group flex items-start justify-between gap-2 rounded-[var(--radius)] border p-3 hover:bg-accent/40"
                      >
                        <span className="space-y-0.5">
                          <span className="block text-sm font-medium group-hover:underline">{chain.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t("stepOf", { number: position, total: chain.steps.length })}
                          </span>
                        </span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("notInChains")}</p>
            )}
          </section>

          <section aria-labelledby="sources-heading" className="space-y-3">
            <div className="space-y-0.5">
              <h2 id="sources-heading" className="text-base font-semibold">
                {t("sources")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("sourcesDescription")}</p>
            </div>
            <ul className="space-y-2">
              {classifier.references.map((id) => {
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
                    <p className="text-xs text-muted-foreground">{ref.note}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        <div className="space-y-8 lg:col-start-1 lg:row-start-2 lg:self-start">
          <Section id="guidance-heading" title={t("guidance")}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
              {classifier.guidance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="request-heading" title={t("requestDefinition")}>
            <RequestSnippet classifier={classifier} />
          </Section>
        </div>
      </div>
    </div>
  );
}
