import type { CSSProperties } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BotTeamsGraph } from "@/components/bots/teams/bot-teams-graph";
import { teamCardHeights } from "@/lib/bots/team-graph";
import { getVotedTeamIds, listFeaturedTeams, toTeamGraphTeam } from "@/lib/bots/teams";

export async function FeaturedTeams() {
  const t = await getTranslations("bots");
  const [teams, session] = await Promise.all([listFeaturedTeams(6), auth()]);

  if (teams.length === 0) return null;

  const voted = await getVotedTeamIds(session?.user?.id, teams.map((team) => team.id));
  // Cards have no detail panel, so the team description is left out of the client payload
  const graphTeams = teams.map((team) => ({ ...toTeamGraphTeam(team, { voted: voted.has(team.id) }), description: null }));
  // One height per breakpoint, matching the grid's columns, so each row lines up before and after its graphs are drawn
  const [one, two, three] = [1, 2, 3].map((columns) => teamCardHeights(graphTeams, columns));

  return (
    <section className="py-12 border-b" aria-labelledby="featured-teams-heading">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h2 id="featured-teams-heading" className="text-xl font-semibold">{t("featuredTeams")}</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/bots/teams" prefetch={false}>
              {t("viewAll")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {graphTeams.map((team, index) => (
            <li
              key={team.id}
              className="min-w-0 h-(--card-h) md:h-(--card-h-md) lg:h-(--card-h-lg)"
              style={{ "--card-h": `${one[index]}px`, "--card-h-md": `${two[index]}px`, "--card-h-lg": `${three[index]}px` } as CSSProperties}
            >
              <BotTeamsGraph teams={[team]} variant="card" isLoggedIn={!!session?.user} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
