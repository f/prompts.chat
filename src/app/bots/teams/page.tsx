import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BotTeamsGraph } from "@/components/bots/teams/bot-teams-graph";
import { TeamFilters } from "@/components/bots/teams/team-filters";
import { JsonLd, breadcrumbSchema, collectionPageSchema } from "@/components/seo/structured-data";
import { platformFromParam } from "@/lib/bots/schema";
import { getTeamFilterOptions, listTeams, teamExcerpt, toTeamGraphTeam } from "@/lib/bots/teams";
import { buildPageMetadata } from "@/lib/seo";
import { getBotTeamUrl } from "@/lib/urls";

const PER_PAGE = 24;

type TeamsSearchParams = {
  q?: string;
  platform?: string;
  category?: string;
  tag?: string;
  page?: string;
};

interface BotTeamsPageProps {
  searchParams: Promise<TeamsSearchParams>;
}

const FILTER_KEYS = ["q", "platform", "category", "tag"] as const;

export async function generateMetadata({ searchParams }: BotTeamsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const t = await getTranslations("seo.botTeams");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/bots/teams",
    noindex: FILTER_KEYS.some((key) => !!params[key]) || !!params.page,
  });
}

function pageHref(params: TeamsSearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (params[key]) query.set(key, params[key]);
  }
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
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const isFiltered = FILTER_KEYS.some((key) => !!params[key]);

  const [{ teams, total }, filterOptions] = await Promise.all([
    listTeams({
      q: params.q?.trim() || undefined,
      platform: platformFromParam(params.platform),
      categorySlug: params.category || undefined,
      tagSlugs: params.tag?.split(",").map((slug) => slug.trim()).filter(Boolean),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      viewer: session?.user ? { id: session.user.id, role: session.user.role } : null,
    }),
    getTeamFilterOptions(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (page > totalPages) notFound();

  return (
    <div className="container py-6">
      <JsonLd
        data={[
          collectionPageSchema({
            name: tSeo("heading"),
            description: tSeo("description"),
            path: pageHref(params, page),
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

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-semibold">{tSeo("heading")}</h1>
          <span className="text-xs text-muted-foreground">{t("count", { count: total })}</span>
        </div>
        <Button size="sm" className="h-8 shrink-0 text-xs" asChild>
          <Link href="/bots/teams/new">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("create")}
          </Link>
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {t("description")} {t("botHint")}
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <TeamFilters categories={filterOptions.categories} tags={filterOptions.tags} currentFilters={params} />
        </aside>
        <main className="flex-1 min-w-0">
          {teams.length > 0 ? (
            <>
              <BotTeamsGraph key={pageHref(params, page)} teams={teams.map(toTeamGraphTeam)} />

              <nav aria-labelledby="all-teams" className="sr-only focus-within:not-sr-only focus-within:mt-4">
                <h2 id="all-teams" className="text-sm font-semibold">{t("allTeams")}</h2>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <Link href={getBotTeamUrl(team.slug)} className="underline-offset-4 hover:underline">
                        {team.title}
                      </Link>
                      {team.description && <span className="sr-only"> – {teamExcerpt(team.description)}</span>}
                    </li>
                  ))}
                </ul>
              </nav>

              {totalPages > 1 && (
                <nav aria-label={t("pagination")} className="mt-6 flex items-center justify-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} asChild={page > 1}>
                    {page > 1 ? <Link href={pageHref(params, page - 1)} aria-label={t("previousPage")}><ChevronLeft className="h-4 w-4" /></Link> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                  <span className="px-2 text-sm tabular-nums">{page} / {totalPages}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} asChild={page < totalPages}>
                    {page < totalPages ? <Link href={pageHref(params, page + 1)} aria-label={t("nextPage")}><ChevronRight className="h-4 w-4" /></Link> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </nav>
              )}
            </>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">{isFiltered ? t("noResults") : t("empty")}</p>
          )}
        </main>
      </div>
    </div>
  );
}
