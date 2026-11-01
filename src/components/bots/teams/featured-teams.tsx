import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamCard } from "@/components/bots/teams/team-card";
import { listFeaturedTeams, teamExcerpt } from "@/lib/bots/teams";

export async function FeaturedTeams() {
  const t = await getTranslations("bots");
  const teams = await listFeaturedTeams(6);

  if (teams.length === 0) return null;

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
          {teams.map((team) => (
            <li key={team.id} className="min-w-0">
              <TeamCard
                team={{
                  slug: team.slug,
                  title: team.title,
                  isFeatured: team.isFeatured,
                  isUnlisted: team.isUnlisted,
                  voteCount: team.voteCount,
                  memberCount: team.members.length,
                  excerpt: teamExcerpt(team.description, 160),
                  category: team.category,
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
