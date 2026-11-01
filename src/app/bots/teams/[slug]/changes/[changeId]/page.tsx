import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Check, Clock, Users, X } from "lucide-react";
import { auth } from "@/lib/auth";
import { formatDistanceToNow } from "@/lib/date";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamDiff } from "@/components/bots/teams/team-diff";
import { ChangeRequestActions } from "@/components/prompts/change-request-actions";
import { DismissChangeRequestButton } from "@/components/prompts/dismiss-change-request-button";
import { ReopenChangeRequestButton } from "@/components/prompts/reopen-change-request-button";
import { getTeamChangeRequest } from "@/lib/bots/team-changes";
import { canEditTeam, getTeam } from "@/lib/bots/teams";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotTeamUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface TeamChangeRequestPageProps {
  params: Promise<{ slug: string; changeId: string }>;
}

const STATUS_CONFIG = {
  PENDING: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", icon: Clock },
  APPROVED: { color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20", icon: Check },
  REJECTED: { color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: X },
};

/** A team change request: the same layout as a prompt change request, with the team diff */
export default async function TeamChangeRequestPage({ params }: TeamChangeRequestPageProps) {
  const { slug, changeId } = await params;
  const session = await auth();
  const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
  const team = await getTeam({ slug }, viewer);
  if (!team) notFound();
  const changeRequest = await getTeamChangeRequest(team.id, changeId, viewer);
  if (!changeRequest) notFound();

  const t = await getTranslations("changeRequests");
  const locale = await getLocale();
  const teamPath = getBotTeamUrl(team.slug);
  const apiPath = `/api/bots/teams/${encodeURIComponent(team.slug)}/changes/${changeRequest.id}`;
  const canReview = canEditTeam(team, viewer);
  const isRequestAuthor = viewer?.id === changeRequest.author.id;
  const StatusIcon = STATUS_CONFIG[changeRequest.status].icon;

  return (
    <div className="container max-w-3xl pt-6 pb-24 sm:pb-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href={teamPath}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t("backToTeam")}
          </Link>
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <Badge className={STATUS_CONFIG[changeRequest.status].color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {t(changeRequest.status.toLowerCase())}
          </Badge>
        </div>
        <Link href={teamPath} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mt-1">
          <Users className="h-3.5 w-3.5" />
          {team.title}
        </Link>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Avatar className="h-6 w-6">
            <AvatarImage src={changeRequest.author.avatar || ""} />
            <AvatarFallback className="text-xs">{changeRequest.author.name?.[0] || changeRequest.author.username[0]}</AvatarFallback>
          </Avatar>
          <span className="text-sm">
            <Link href={`/@${changeRequest.author.username}`} className="font-medium hover:underline">
              @{changeRequest.author.username}
            </Link>
            <span className="text-muted-foreground"> · {formatDistanceToNow(changeRequest.createdAt, locale)}</span>
          </span>
        </div>
      </div>

      {changeRequest.reason && (
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t("reason")}</p>
          <p className="text-sm whitespace-pre-wrap">{changeRequest.reason}</p>
        </div>
      )}

      <div className="mb-6">
        <TeamDiff original={changeRequest.originalSnapshot} modified={changeRequest.proposedSnapshot} />
      </div>

      {(changeRequest.reviewNote || changeRequest.reviewer) && changeRequest.status !== "PENDING" && (
        <div className="mb-6 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">{t("reviewNote")}</p>
          {changeRequest.reviewNote && <p className="text-sm whitespace-pre-wrap">{changeRequest.reviewNote}</p>}
          {changeRequest.reviewer && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("reviewedBy", { user: `@${changeRequest.reviewer.username}` })}
              {changeRequest.reviewedAt && ` · ${formatDistanceToNow(changeRequest.reviewedAt, locale)}`}
            </p>
          )}
        </div>
      )}

      {canReview && changeRequest.status === "PENDING" && (
        <div className="pt-4 border-t">
          <ChangeRequestActions changeRequestId={changeRequest.id} promptId={team.id} apiPath={apiPath} approvedMessage={t("teamApprovedSuccess")} />
        </div>
      )}

      {canReview && changeRequest.status === "REJECTED" && (
        <div className="pt-4 border-t">
          <ReopenChangeRequestButton changeRequestId={changeRequest.id} promptId={team.id} apiPath={apiPath} />
        </div>
      )}

      {isRequestAuthor && changeRequest.status === "PENDING" && (
        <div className="pt-4 border-t">
          <DismissChangeRequestButton changeRequestId={changeRequest.id} promptId={team.id} apiPath={apiPath} redirectTo={teamPath} />
        </div>
      )}
    </div>
  );
}
