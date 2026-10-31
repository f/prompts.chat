import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotTeamsGraph } from "@/components/bots/teams/bot-teams-graph";
import { CreateTeamButton } from "@/components/bots/teams/bot-team-editor";
import { JsonLd, breadcrumbSchema, collectionPageSchema } from "@/components/seo/structured-data";
import { listTeams, teamExcerpt, toTeamGraphTeam } from "@/lib/bots/teams";
import { buildPageMetadata } from "@/lib/seo";
import { getBotTeamUrl } from "@/lib/urls";

const PER_PAGE = 24;

interface BotTeamsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: BotTeamsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("seo.botTeams");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/bots/teams",
    noindex: !!params.q || !!params.page,
  });
}

function pageHref(q: string | undefined, page: number) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/bots/teams?${search}` : "/bots/teams";
}

export default async function BotTeamsPage({ searchParams }: BotTeamsPageProps) {
  const params = await searchParams;
  const t = await getTranslations("bots.teams");
  const tBots = await getTranslations("bots");
  const tSeo = await getTranslations("seo.botTeams");
  const tNav = await getTranslations("nav");
  const session = await auth();
  const q = params.q?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { teams, total } = await listTeams({
    q,
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    viewer: session?.user ? { id: session.user.id, role: session.user.role } : null,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (page > totalPages) notFound();

  return (
    <div className="container py-6 pb-24">
      <JsonLd
        data={[
          collectionPageSchema({
            name: tSeo("heading"),
            description: tSeo("description"),
            path: pageHref(q, page),
            items: teams.map((team) => ({ name: team.title, path: getBotTeamUrl(team.slug) })),
          }),
          breadcrumbSchema([
            { name: tNav("bots"), path: "/bots" },
            { name: tSeo("heading"), path: "/bots/teams" },
          ]),
        ]}
      />

      <Link href="/bots" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {tBots("backToBots")}
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-semibold">{tSeo("heading")}</h1>
          <span className="text-xs text-muted-foreground">{t("count", { count: total })}</span>
        </div>
        <form action="/bots/teams" className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="h-8 pl-9 text-sm" />
        </form>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">{t("description")}</p>

      {teams.length > 0 ? (
        <>
          <BotTeamsGraph teams={teams.map(toTeamGraphTeam)} />

          <section aria-labelledby="all-teams" className="mt-10 space-y-3">
            <h2 id="all-teams" className="text-base font-semibold">{t("allTeams")}</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={getBotTeamUrl(team.slug)}
                    className="flex h-full flex-col gap-3 rounded-md border p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 font-medium wrap-anywhere">{team.title}</h3>
                      {team.isFeatured && <Star className="h-4 w-4 shrink-0 fill-yellow-500 text-yellow-500" aria-label={t("featured")} />}
                    </div>
                    {team.description && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-foreground/80 wrap-anywhere">{teamExcerpt(team.description)}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex -space-x-1.5" aria-hidden="true">
                        {team.members.slice(0, 6).map(({ bot }) => (
                          <BotAvatar key={bot.id} icon={bot.icon} color={bot.color} size="sm" className="ring-2 ring-background" />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t("membersCount", { count: team.members.length })} · {t("handoffsCount", { count: team.links.length })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? <Link href={pageHref(q, page - 1)}><ChevronLeft className="h-4 w-4" /></Link> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <span className="px-2 text-sm tabular-nums">{page} / {totalPages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={pageHref(q, page + 1)}><ChevronRight className="h-4 w-4" /></Link> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">{q ? t("noResults") : t("empty")}</p>
      )}

      <CreateTeamButton isLoggedIn={!!session?.user} />
    </div>
  );
}
