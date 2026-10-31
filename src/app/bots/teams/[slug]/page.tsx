import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, Star, Users, Workflow } from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { BotCard } from "@/components/bots/bot-card";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotTeamsGraph } from "@/components/bots/teams/bot-teams-graph";
import { BotTeamActions } from "@/components/bots/teams/bot-team-actions";
import { TeamInstall } from "@/components/bots/teams/team-install";
import { TeamMarkdown } from "@/components/bots/teams/team-markdown";
import { PromptAuthor } from "@/components/prompts/prompt-author";
import { UpvoteButton } from "@/components/prompts/upvote-button";
import { JsonLd, breadcrumbSchema } from "@/components/seo/structured-data";
import { canEditTeam, getTeam, getTeamInstallOptions, getVotedTeamIds, teamExcerpt, toTeamGraphTeam } from "@/lib/bots/teams";
import { buildPageMetadata, getBaseUrl, NOINDEX_ROBOTS, toMetaDescription } from "@/lib/seo";
import { getBotTeamUrl, getBotUrl } from "@/lib/urls";

interface BotTeamPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BotTeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeam({ slug });
  if (!team || team.members.length === 0) return { robots: NOINDEX_ROBOTS };
  const names = team.members.map(({ bot }) => bot.title).join(", ");
  return buildPageMetadata({
    title: team.title,
    description: toMetaDescription(teamExcerpt(team.description, 500) || names),
    path: getBotTeamUrl(team.slug),
  });
}

export default async function BotTeamPage({ params }: BotTeamPageProps) {
  const { slug } = await params;
  const session = await auth();
  const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
  const team = await getTeam({ slug }, viewer);
  if (!team) notFound();

  const t = await getTranslations("bots.teams");
  const tNav = await getTranslations("nav");
  const tSeo = await getTranslations("seo.botTeams");
  const baseUrl = getBaseUrl();
  const path = getBotTeamUrl(team.slug);
  const titles = new Map(team.members.map(({ bot }) => [bot.id, bot]));
  const voted = (await getVotedTeamIds(viewer?.id, [team.id])).has(team.id);

  return (
    <div className="container max-w-5xl min-w-0 py-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: tNav("bots"), path: "/bots" },
          { name: tSeo("heading"), path: "/bots/teams" },
          { name: team.title, path },
        ])}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/bots/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("backToTeams")}
        </Link>
        {canEditTeam(team, viewer) && (
          <BotTeamActions team={{ slug: team.slug }} />
        )}
      </div>

      <header className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          {team.members.length > 0 && (
            <UpvoteButton
              voteUrl={`/api/bots/teams/${encodeURIComponent(team.slug)}/vote`}
              initialVoted={voted}
              initialCount={team.voteCount}
              isLoggedIn={!!viewer}
              size="circular"
            />
          )}
          <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground sm:h-14 sm:w-14">
            <Users className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h1 className="min-w-0 flex-1 text-xl sm:text-2xl font-semibold wrap-anywhere">{team.title}</h1>
          {team.isFeatured && <Star className="h-4 w-4 shrink-0 fill-yellow-500 text-yellow-500" aria-label={t("featured")} />}
        </div>
        {team.description && <TeamMarkdown className="leading-relaxed">{team.description}</TeamMarkdown>}
        {(team.category || team.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {team.category && (
              <Link href={`/bots/teams?category=${team.category.slug}`} className="max-w-full">
                <Badge variant="outline" className="max-w-full whitespace-normal wrap-anywhere">
                  {team.category.parent && `${team.category.parent.name} › `}
                  {team.category.name}
                </Badge>
              </Link>
            )}
            {team.category && team.tags.length > 0 && <span className="text-muted-foreground">•</span>}
            {team.tags.map((tag) => (
              <Link key={tag.id} href={`/bots/teams?tag=${tag.slug}`} className="max-w-full">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PromptAuthor author={team.author} size="md" />
          <TeamInstall
            team={{ id: team.id, slug: team.slug, title: team.title, memberCount: team.members.length }}
            options={getTeamInstallOptions(team, baseUrl)}
          />
        </div>
      </header>

      {team.members.length > 0 && (
        <div className="mb-8 overflow-hidden">
          <BotTeamsGraph teams={[toTeamGraphTeam(team, { voted })]} variant="single" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="team-members" className="min-w-0 space-y-2">
          <h2 id="team-members" className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" />
            {t("members")}
          </h2>
          {team.members.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {team.members.map(({ bot, role, description }) => (
                <li key={bot.id} className="flex h-full min-w-0 flex-col gap-3 rounded-[var(--radius)] border bg-muted/50 p-3">
                  {(role || description) && (
                    <div className="flex-1 space-y-1 px-1">
                      {role && <p className="text-sm font-semibold wrap-anywhere">{role}</p>}
                      {description && <p className="text-sm text-muted-foreground wrap-anywhere">{description}</p>}
                    </div>
                  )}
                  <div className="mt-auto flex min-w-0 flex-col">
                    <BotCard bot={bot} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noVisibleMembers")}</p>
          )}
        </section>

        <section aria-labelledby="team-handoffs" className="h-fit min-w-0 space-y-3 rounded-md border p-3 sm:p-4 lg:sticky lg:top-16">
          <h2 id="team-handoffs" className="flex items-center gap-2 text-base font-semibold">
            <Workflow className="h-4 w-4" />
            {t("handoffs")}
          </h2>
          {team.links.length > 0 ? (
            <ol className="space-y-3">
              {team.links.map((link) => {
                const from = titles.get(link.fromBotId)!;
                const to = titles.get(link.toBotId)!;
                return (
                  <li key={`${link.fromBotId}>${link.toBotId}`} className="space-y-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      <Link href={getBotUrl(from.id, from.slug)} className="flex min-w-0 items-center gap-1.5 hover:underline">
                        <BotAvatar icon={from.icon} color={from.color} size="sm" className="h-5 w-5" />
                        <span className="truncate">{from.title}</span>
                      </Link>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("handsOffTo")} />
                      <Link href={getBotUrl(to.id, to.slug)} className="flex min-w-0 items-center gap-1.5 hover:underline">
                        <BotAvatar icon={to.icon} color={to.color} size="sm" className="h-5 w-5" />
                        <span className="truncate">{to.title}</span>
                      </Link>
                    </div>
                    {link.label && <p className="pl-6 text-sm text-muted-foreground wrap-anywhere">{link.label}</p>}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noHandoffs")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
