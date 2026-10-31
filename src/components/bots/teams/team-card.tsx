import Link from "next/link";
import { useTranslations } from "next-intl";
import { EyeOff, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UpvoteCount } from "@/components/prompts/upvote-count";
import { getBotTeamUrl } from "@/lib/urls";

export interface TeamCardTeam {
  slug: string;
  title: string;
  isFeatured: boolean;
  isUnlisted: boolean;
  voteCount: number;
  memberCount: number;
  excerpt?: string | null;
  category: { name: string; slug: string; parent: { name: string } | null } | null;
}

export function TeamCard({ team }: { team: TeamCardTeam }) {
  const t = useTranslations("bots");
  return (
    <div className="relative flex h-full min-w-0 items-start gap-3 rounded-[var(--radius)] border bg-card p-3 transition-colors hover:border-foreground/20">
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
          {team.isUnlisted && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              <EyeOff className="mr-1 h-3 w-3" />
              {t("unlisted")}
            </Badge>
          )}
        </div>
        {team.excerpt && <p className="line-clamp-2 text-xs text-muted-foreground wrap-anywhere">{team.excerpt}</p>}
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
    </div>
  );
}
