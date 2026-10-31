import { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, EyeOff, GitPullRequest, Handshake, Pencil, Plug, Shield, Sparkles, Star, Trash2, Users, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { CommentSection } from "@/components/comments";
import { ChangeRequestList } from "@/components/prompts/change-request-list";
import { UpvoteButton } from "@/components/prompts/upvote-button";
import { UpvoteCount } from "@/components/prompts/upvote-count";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BotViewTracker } from "@/components/bots/bot-analytics";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotBundleInstall } from "@/components/bots/bot-bundle-install";
import { BotCard } from "@/components/bots/bot-card";
import { BotComputerBadges } from "@/components/bots/bot-computer-badge";
import { BotInstall } from "@/components/bots/bot-install";
import { BotPlatformBadge } from "@/components/bots/bot-platform-badge";
import { DelistBanner } from "@/components/prompts/delist-banner";
import { PromptAuthor } from "@/components/prompts/prompt-author";
import { FeaturePromptButton } from "@/components/prompts/feature-prompt-button";
import { RestorePromptButton } from "@/components/prompts/restore-prompt-button";
import { UnlistPromptButton } from "@/components/prompts/unlist-prompt-button";
import { JsonLd, botSchema, breadcrumbSchema } from "@/components/seo/structured-data";
import { BOT_PLATFORM_INFO, extractBotId, formatBotPlatforms, getBotById, getBotInstallOptions, getBotUrls } from "@/lib/bots";
import { getBotPairings, getBundleInstallOptions } from "@/lib/bots/pairings";
import { getBotTeams } from "@/lib/bots/teams";
import { canViewPrompt } from "@/lib/prompt-access";
import { buildPageMetadata, getBaseUrl, NOINDEX_ROBOTS, toMetaDescription } from "@/lib/seo";
import { getBotTeamUrl, getBotUrl } from "@/lib/urls";
import { isTrending } from "@/lib/trending";
import { TrendingBadge } from "@/components/prompts/trending-badge";
import { TrendingPromptButton } from "@/components/prompts/trending-prompt-button";

interface BotPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BotPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bot = await getBotById(extractBotId(slug));
  if (!bot || bot.isPrivate) {
    return { robots: NOINDEX_ROBOTS };
  }
  return buildPageMetadata({
    title: `${bot.title} · ${formatBotPlatforms(bot.platforms)}`,
    description: toMetaDescription(bot.description || bot.instructions),
    path: getBotUrl(bot.id, bot.slug),
    noindex: bot.isUnlisted,
    image: "route",
  });
}

export default async function BotPage({ params }: BotPageProps) {
  const { slug } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const bot = await getBotById(extractBotId(slug), { includeDeleted: isAdmin });
  if (!bot || !canViewPrompt(bot, session)) {
    notFound();
  }

  const canonicalPath = getBotUrl(bot.id, bot.slug);
  if (`/bots/${slug}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  const t = await getTranslations("bots");
  const tNav = await getTranslations("nav");
  const baseUrl = getBaseUrl();
  const tPrompts = await getTranslations("prompts");
  const isOwner = session?.user?.id === bot.authorId;
  const canEdit = isOwner || isAdmin;
  const { routines, skills, connectors } = bot.config;
  const platformNames = bot.platforms.map((platform) => BOT_PLATFORM_INFO[platform].name);
  const config = await getConfig();
  const locale = await getLocale();
  const tChanges = await getTranslations("changeRequests");
  const canRequestChange = !!session?.user && !isOwner && !bot.isPrivate && !bot.deletedAt;

  const [userVote, changeRequests, pairings, teams] = await Promise.all([
    session?.user
      ? db.promptVote.findUnique({
          where: { userId_promptId: { userId: session.user.id, promptId: bot.id } },
          select: { userId: true },
        })
      : null,
    db.changeRequest.findMany({
      where: { promptId: bot.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
    }),
    getBotPairings(bot.id),
    getBotTeams(bot.id),
  ]);
  const pendingCount = changeRequests.filter((cr) => cr.status === "PENDING").length;

  return (
    <div className="container max-w-5xl py-6 min-w-0">
      <BotViewTracker botId={bot.id} botTitle={bot.title} />
      <JsonLd
        data={[
          ...botSchema({
            path: canonicalPath,
            name: bot.title,
            description: toMetaDescription(bot.description || bot.instructions),
            platforms: platformNames,
            author: { name: bot.author.name || bot.author.username, username: bot.author.username },
            keywords: [
              ...platformNames,
              ...(bot.category ? [bot.category.name] : []),
              ...bot.tags.map((tag) => tag.name),
              ...skills.map((skill) => skill.name),
              ...connectors,
            ],
            features: routines.map((routine) => routine.name),
            dateCreated: bot.createdAt,
            dateModified: bot.updatedAt,
          }),
          breadcrumbSchema([
            { name: tNav("bots"), path: "/bots" },
            { name: bot.title, path: canonicalPath },
          ]),
        ]}
      />

      {bot.deletedAt && isAdmin && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{tPrompts("promptDeleted")}</h3>
              <p className="text-sm text-red-600 dark:text-red-500">{tPrompts("promptDeletedDescription")}</p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <RestorePromptButton promptId={bot.id} />
          </div>
        </div>
      )}

      {bot.isUnlisted && bot.delistReason && (isOwner || isAdmin) && (
        <DelistBanner promptId={bot.id} delistReason={bot.delistReason} isOwner={isOwner} isDeleted={!!bot.deletedAt} />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/bots" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("backToBots")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canRequestChange && (
            <Button size="sm" className="h-8 text-xs" asChild>
              <Link href={`${canonicalPath}/changes/new`}>
                <GitPullRequest className="h-3.5 w-3.5 mr-1" />
                {tPrompts("createChangeRequest")}
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href={`${canonicalPath}/edit`}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {t("edit")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {bot.platforms.map((platform) => (
            <BotPlatformBadge key={platform} platform={platform} />
          ))}
          <BotComputerBadges requirements={bot.computerRequirements} size="md" />
          {isTrending(bot.trendingUntil) && <TrendingBadge />}
          {bot.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
          {bot.isPrivate && (
            <Badge variant="secondary"><EyeOff />{t("private")}</Badge>
          )}
          {bot.isUnlisted && <Badge variant="outline">{t("unlisted")}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <UpvoteButton
            promptId={bot.id}
            initialVoted={!!userVote}
            initialCount={bot.voteCount}
            isLoggedIn={!!session?.user}
            size="circular"
          />
          <BotAvatar icon={bot.icon} color={bot.color} size="lg" className="h-12 w-12 sm:h-14 sm:w-14" />
          <h1 className="min-w-0 flex-1 text-xl sm:text-2xl font-semibold wrap-anywhere">{bot.title}</h1>
        </div>
        {bot.description && <p className="text-muted-foreground wrap-anywhere">{bot.description}</p>}
        {(bot.category || bot.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {bot.category && (
              <Link href={`/categories/${bot.category.slug}`} className="max-w-full">
                <Badge variant="outline" className="max-w-full whitespace-normal wrap-anywhere">
                  {bot.category.parent && `${bot.category.parent.name} › `}
                  {bot.category.name}
                </Badge>
              </Link>
            )}
            {bot.category && bot.tags.length > 0 && <span className="text-muted-foreground">•</span>}
            {bot.tags.map((tag) => (
              <Link key={tag.id} href={`/tags/${tag.slug}`} className="max-w-full">
                <Badge
                  variant="secondary"
                  className="max-w-full whitespace-normal wrap-anywhere"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
        <PromptAuthor author={bot.author} size="md" className="w-fit max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8 min-w-0">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("instructions")}</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap wrap-anywhere rounded-md border bg-muted/50 p-3 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed">
              {bot.instructions}
            </pre>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("routines")}</h2>
            {routines.length > 0 ? (
              <div className="space-y-3">
                {routines.map((routine, index) => (
                  <div key={index} className="min-w-0 rounded-md border p-3 sm:p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="min-w-0 font-medium wrap-anywhere">{routine.name}</h3>
                      <Badge variant="outline" className="gap-1">
                        {routine.type === "schedule" ? <Clock /> : <Zap />}
                        {routine.type === "schedule" ? t("scheduled") : t("eventTriggered")}
                      </Badge>
                    </div>
                    <p className="text-sm wrap-anywhere">
                      <span className="text-muted-foreground">{routine.type === "schedule" ? t("schedule") : t("trigger")}: </span>
                      {routine.triggerLabel || routine.trigger}
                      {routine.type === "schedule" && routine.triggerLabel && (
                        <code className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">{routine.trigger}</code>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap wrap-anywhere">{routine.prompt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noRoutines")}</p>
            )}
          </section>

          {(skills.length > 0 || connectors.length > 0) && (
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {skills.length > 0 && (
                <div className="min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="h-4 w-4" />
                    {t("skills")}
                  </h2>
                  <ul className="space-y-2">
                    {skills.map((skill, index) => (
                      <li key={index} className="text-sm wrap-anywhere">
                        <span className="font-medium">{skill.name}</span>
                        {skill.description && <span className="text-muted-foreground"> — {skill.description}</span>}
                        {skill.source && (
                          <code className="mt-1 block w-fit max-w-full overflow-x-auto whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-xs">{skill.source}</code>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {connectors.length > 0 && (
                <div className="min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Plug className="h-4 w-4" />
                    {t("connectors")}
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {connectors.map((connector) => (
                      <Badge key={connector} variant="outline" className="max-w-full whitespace-normal wrap-anywhere">{connector}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {pairings.length > 0 && (
            <section aria-labelledby="better-together" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="better-together" className="flex items-center gap-2 text-base font-semibold">
                  <Handshake className="h-4 w-4" />
                  {t("betterTogether")}
                </h2>
                <BotBundleInstall
                  botId={bot.id}
                  botTitle={bot.title}
                  botCount={pairings.length + 1}
                  options={getBundleInstallOptions(bot, pairings.map((pairing) => pairing.bot), baseUrl)}
                />
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pairings.map(({ bot: paired, note }) => (
                  <li key={paired.id} className="flex min-w-0 flex-col gap-2">
                    <BotCard bot={paired} />
                    {note && <p className="px-1 text-sm text-muted-foreground wrap-anywhere">{note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {teams.length > 0 && (
            <section aria-labelledby="bot-teams" className="space-y-3">
              <h2 id="bot-teams" className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4" />
                {t("teams.memberOf")}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {teams.map((team) => (
                  <li
                    key={team.id}
                    className="relative flex min-w-0 items-start gap-3 rounded-[var(--radius)] border bg-card p-3 transition-colors hover:border-foreground/20"
                  >
                    <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={getBotTeamUrl(team.slug)}
                          className="min-w-0 truncate text-sm font-medium hover:underline after:absolute after:inset-0 after:content-['']"
                        >
                          {team.title}
                        </Link>
                        {team.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" aria-label={t("teams.featured")} />}
                      </div>
                      {team.role && <p className="text-xs text-muted-foreground wrap-anywhere">{team.role}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {team.category && (
                          <Link href={`/bots/teams?category=${team.category.slug}`} className="relative z-10 max-w-full">
                            <Badge variant="outline" className="max-w-full whitespace-normal text-[10px] wrap-anywhere">
                              {team.category.parent && `${team.category.parent.name} › `}
                              {team.category.name}
                            </Badge>
                          </Link>
                        )}
                        <span>{t("teams.memberCount", { count: team.memberCount })}</span>
                        <UpvoteCount count={team.voteCount} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-16 h-fit rounded-md border p-3 sm:p-4 space-y-3">
          <h2 className="text-base font-semibold">{t("install")}</h2>
          <BotInstall botId={bot.id} options={getBotInstallOptions(bot, baseUrl)} urls={getBotUrls(bot, baseUrl)} />
        </aside>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8 min-w-0">
          {changeRequests.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <GitPullRequest className="h-4 w-4" />
                {tChanges("title")}
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{pendingCount}</Badge>
                )}
              </h2>
              <ChangeRequestList changeRequests={changeRequests} basePath={canonicalPath} />
            </section>
          )}

          {config.features.comments !== false && !bot.isPrivate && !bot.deletedAt && (
            <CommentSection
              promptId={bot.id}
              currentUserId={session?.user?.id}
              isAdmin={isAdmin}
              isLoggedIn={!!session?.user}
              locale={locale}
            />
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-8 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-500">{tPrompts("adminArea")}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FeaturePromptButton promptId={bot.id} isFeatured={bot.isFeatured} />
            <TrendingPromptButton promptId={bot.id} trendingUntil={bot.trendingUntil} />
            <UnlistPromptButton promptId={bot.id} isUnlisted={bot.isUnlisted} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`${canonicalPath}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                {t("edit")}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
