import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, EyeOff, GitBranch, GitPullRequest, History, Pencil, Shield, Star, Trash2 } from "lucide-react";
import {
  formatClassifierDefinition,
  formatClassifierOutcomes,
  getChainsForClassifier,
  getSharedChains,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { getClassifierCatalog, findClassifierBySlug, listedClassifiers } from "@/lib/classifiers/store";
import { configFromDefinition } from "@/lib/classifiers/schema";
import { parseVersionClassifierSnapshot } from "@/lib/classifiers/change-snapshot";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { canViewPrompt } from "@/lib/prompt-access";
import { isTrending } from "@/lib/trending";
import { buildPageMetadata, NOINDEX_ROBOTS } from "@/lib/seo";
import { getClassifierUrl } from "@/lib/urls";
import { CommentSection } from "@/components/comments";
import { ChangeRequestList } from "@/components/prompts/change-request-list";
import { UpvoteButton } from "@/components/prompts/upvote-button";
import { DelistBanner } from "@/components/prompts/delist-banner";
import { PromptAuthor } from "@/components/prompts/prompt-author";
import { FeaturePromptButton } from "@/components/prompts/feature-prompt-button";
import { RestorePromptButton } from "@/components/prompts/restore-prompt-button";
import { TrendingBadge } from "@/components/prompts/trending-badge";
import { TrendingPromptButton } from "@/components/prompts/trending-prompt-button";
import { UnlistPromptButton } from "@/components/prompts/unlist-prompt-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClassifierVersionHistory } from "@/components/classifiers/classifier-version-history";
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

export async function generateMetadata({ params }: ClassifierPageProps): Promise<Metadata> {
  const { slug } = await params;
  const found = await findClassifierBySlug(slug);
  const t = await getTranslations("seo.classifiers");
  if (!found || found.record.isPrivate) {
    return { title: t("notFound"), robots: NOINDEX_ROBOTS };
  }
  const classifier = found.record;
  return buildPageMetadata({
    title: t("detailTitle", { name: classifier.name }),
    description: classifier.summary,
    path: getClassifierUrl(classifier.slug),
    noindex: classifier.isUnlisted,
  });
}

/** Up to three listed classifiers of the same category, for classifiers without curated pairings */
function suggestedPartners(classifier: ClassifierDefinition, listed: ClassifierDefinition[]) {
  return listed.filter((c) => c.slug !== classifier.slug && c.category === classifier.category).slice(0, 3);
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
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const found = await findClassifierBySlug(slug, { includeDeleted: isAdmin });
  if (!found || !canViewPrompt({ isPrivate: found.row.isPrivate, authorId: found.row.authorId }, session)) notFound();
  const { record: classifier, row } = found;

  const t = await getTranslations("classifiers");
  const tPrompts = await getTranslations("prompts");
  const tChanges = await getTranslations("changeRequests");
  const locale = await getLocale();
  const config = await getConfig();
  const catalog = await getClassifierCatalog();
  const canonicalPath = getClassifierUrl(classifier.slug);
  const isOwner = session?.user?.id === row.authorId;
  const canEdit = isOwner || isAdmin;
  const canRequestChange = !!session?.user && !isOwner && !row.isPrivate && !row.deletedAt;

  const chains = getChainsForClassifier(catalog.chains, classifier.slug);
  const { question } = classifier;
  const findListed = (s: string) => catalog.classifiers.find((c) => c.slug === s);
  const partners =
    classifier.betterTogether.length > 0
      ? classifier.betterTogether
          .map((link) => ({ link, partner: findListed(link.slug), shared: getSharedChains(catalog.chains, classifier.slug, link.slug) }))
          .filter((p) => p.partner)
      : [];
  const suggestions = partners.length === 0 ? suggestedPartners(classifier, listedClassifiers(catalog)) : [];
  const sources = classifier.references.flatMap((id) => catalog.sources.filter((s) => s.id === id));

  const [userVote, changeRequests, versions] = await Promise.all([
    session?.user
      ? db.promptVote.findUnique({ where: { userId_promptId: { userId: session.user.id, promptId: row.id } }, select: { userId: true } })
      : null,
    db.changeRequest.findMany({
      where: { promptId: row.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
    }),
    db.promptVersion.findMany({
      where: { promptId: row.id },
      orderBy: { version: "desc" },
      select: { id: true, version: true, changeNote: true, createdAt: true, classifierSnapshot: true, author: { select: { username: true } } },
    }),
  ]);
  const pendingCount = changeRequests.filter((cr) => cr.status === "PENDING").length;
  const currentSide = { title: classifier.name, fields: { description: classifier.summary, config: configFromDefinition(classifier) } };
  const versionHistory = versions.map((version) => {
    const snapshot = parseVersionClassifierSnapshot(version.classifierSnapshot);
    return {
      id: version.id,
      version: version.version,
      changeNote: version.changeNote,
      createdAt: version.createdAt,
      authorUsername: version.author.username,
      snapshot: { title: snapshot?.title ?? classifier.name, fields: snapshot?.fields ?? null },
    };
  });
  const exportJson = JSON.stringify(
    { slug: classifier.slug, name: classifier.name, summary: classifier.summary, ...configFromDefinition(classifier) },
    null,
    2
  );

  return (
    <div className="container py-6">
      {row.deletedAt && isAdmin && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{tPrompts("promptDeleted")}</h3>
              <p className="text-sm text-red-600 dark:text-red-500">{tPrompts("promptDeletedDescription")}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <RestorePromptButton promptId={row.id} />
          </div>
        </div>
      )}

      {row.isUnlisted && row.delistReason && (isOwner || isAdmin) && (
        <DelistBanner promptId={row.id} delistReason={row.delistReason} isOwner={isOwner} isDeleted={!!row.deletedAt} />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/classifiers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("backToCatalog")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canRequestChange && (
            <Button size="sm" className="h-8 text-xs" asChild>
              <Link href={`${canonicalPath}/changes/new`}>
                <GitPullRequest className="mr-1 h-3.5 w-3.5" />
                {tPrompts("createChangeRequest")}
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href={`${canonicalPath}/edit`}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t("edit")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <QuestionTypeBadge type={question.type} />
          <CategoryBadge category={classifier.category} linked />
          {!classifier.curated && <Badge variant="outline">{t("community")}</Badge>}
          {isTrending(row.trendingUntil) && <TrendingBadge />}
          {row.isFeatured && <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
          {row.isPrivate && (
            <Badge variant="secondary">
              <EyeOff />
              {t("private")}
            </Badge>
          )}
          {row.isUnlisted && <Badge variant="outline">{t("unlisted")}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <UpvoteButton
            promptId={row.id}
            initialVoted={!!userVote}
            initialCount={row._count.votes}
            isLoggedIn={!!session?.user}
            size="circular"
            refreshAfterVote
          />
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight wrap-anywhere">{classifier.name}</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground wrap-anywhere">{classifier.summary}</p>
        <PromptAuthor author={classifier.author} size="md" className="w-fit max-w-full" />
        <div className="flex flex-wrap gap-2">
          <CopyTextButton label={t("copyDefinition")} text={formatClassifierDefinition(classifier)} />
          <CopyTextButton label={t("copyQuestion")} text={question.instructions} />
          <CopyTextButton label={t("copyOutcomes")} text={formatClassifierOutcomes(classifier)} />
          <CopyTextButton label={t("copyJson")} text={exportJson} variant="ghost" />
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
            <ScenarioExplorer classifier={classifier} sources={catalog.sources} />
          </Section>
        </div>

        <aside className="space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="better-together-heading" className="space-y-3" id="better-together">
            <div className="space-y-0.5">
              <h2 id="better-together-heading" className="text-base font-semibold">
                {t("betterTogether")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {partners.length > 0 ? t("betterTogetherDescription") : t("suggestedDescription")}
              </p>
            </div>
            {suggestions.length > 0 && (
              <ul className="space-y-2">
                {suggestions.map((partner) => (
                  <li key={partner.slug} className="space-y-2 rounded-[var(--radius)] border bg-card p-3" data-testid="better-together-item">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={getClassifierUrl(partner.slug)} className="text-sm font-semibold hover:underline">
                        {partner.name}
                      </Link>
                      <QuestionTypeBadge type={partner.question.type} />
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{partner.summary}</p>
                  </li>
                ))}
              </ul>
            )}
            {partners.length === 0 && suggestions.length === 0 && <p className="text-sm text-muted-foreground">{t("noSuggestions")}</p>}
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

          {sources.length > 0 && (
          <section aria-labelledby="sources-heading" className="space-y-3">
            <div className="space-y-0.5">
              <h2 id="sources-heading" className="text-base font-semibold">
                {t("sources")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("sourcesDescription")}</p>
            </div>
            <ul className="space-y-2">
              {sources.map((ref) => {
                return (
                  <li key={ref.id} className="space-y-1 rounded-[var(--radius)] border p-3">
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
          )}
        </aside>

        <div className="space-y-8 lg:col-start-1 lg:row-start-2 lg:self-start">
          {classifier.guidance.length > 0 && (
            <Section id="guidance-heading" title={t("guidance")}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
                {classifier.guidance.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="request-heading" title={t("requestDefinition")}>
            <RequestSnippet classifier={classifier} />
          </Section>
        </div>
      </div>

      <div className="mt-10 max-w-4xl space-y-8">
        {changeRequests.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <GitPullRequest className="h-4 w-4" />
              {tChanges("title")}
              {pendingCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{pendingCount}</Badge>}
            </h2>
            <ChangeRequestList changeRequests={changeRequests} basePath={canonicalPath} />
          </section>
        )}

        {versionHistory.length > 0 && (
          <section aria-labelledby="classifier-history" className="space-y-2">
            <h2 id="classifier-history" className="flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4" />
              {tPrompts("versionHistory")}
            </h2>
            <ClassifierVersionHistory versions={versionHistory} current={currentSide} />
          </section>
        )}

        {config.features.comments !== false && !row.isPrivate && !row.deletedAt && (
          <CommentSection promptId={row.id} currentUserId={session?.user?.id} isAdmin={isAdmin} isLoggedIn={!!session?.user} locale={locale} />
        )}
      </div>

      {isAdmin && (
        <div className="mt-8 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-500">{tPrompts("adminArea")}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FeaturePromptButton promptId={row.id} isFeatured={row.isFeatured} />
            <TrendingPromptButton promptId={row.id} trendingUntil={row.trendingUntil} />
            <UnlistPromptButton promptId={row.id} isUnlisted={row.isUnlisted} />
          </div>
        </div>
      )}
    </div>
  );
}
