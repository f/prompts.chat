"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotComputerBadge } from "@/components/bots/bot-computer-badge";
import { BotInstall } from "@/components/bots/bot-install";
import { BotPlatformBadge } from "@/components/bots/bot-platform-badge";
import type { BotInstallOption } from "@/lib/bots";
import { BOT_PLATFORM_INFO, type BotPlatform } from "@/lib/bots/schema";
import type { TeamGraphTeam } from "@/lib/bots/team-graph";
import { getBotUrl } from "@/lib/urls";

export type TeamGraphMember = TeamGraphTeam["members"][number];

/** The parts of the public bot JSON (/bots/<id>.json) the dialog shows */
interface BotDetails {
  description: string | null;
  platforms: BotPlatform[];
  author: { username: string };
  urls: { markdown: string; json: string; skill: string };
  install: Omit<BotInstallOption, "platformName">[];
}

interface BotTeamMemberDialogProps {
  member: TeamGraphMember | null;
  teamTitle: string;
  onOpenChange: (open: boolean) => void;
}

/** A team member's details, its part in the team and its install options, opened from the teams graph */
export function BotTeamMemberDialog({ member, teamTitle, onOpenChange }: BotTeamMemberDialogProps) {
  const t = useTranslations("bots.teams");
  const [details, setDetails] = useState<{ botId: string; data: BotDetails | null } | null>(null);
  const botId = member?.id;
  const slug = member?.slug ?? null;

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    fetch(`${getBotUrl(botId, slug)}.json`)
      .then((response) => (response.ok ? (response.json() as Promise<BotDetails>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setDetails({ botId, data });
      });
    return () => {
      cancelled = true;
    };
  }, [botId, slug]);

  const loaded = member && details?.botId === member.id ? details : null;
  const data = loaded?.data ?? null;

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      {member && (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="text-left">
            <div className="flex min-w-0 items-center gap-3 pr-6">
              <BotAvatar icon={member.icon} color={member.color} size="lg" className="h-12 w-12" />
              <div className="min-w-0 space-y-1.5">
                <DialogTitle className="text-lg leading-snug wrap-anywhere">{member.title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  {data?.platforms.map((platform) => <BotPlatformBadge key={platform} platform={platform} />)}
                  <BotComputerBadge requirement={member.computerRequirement} />
                </div>
              </div>
            </div>
            {loaded ? (
              data?.description && <DialogDescription className="wrap-anywhere">{data.description}</DialogDescription>
            ) : (
              <Skeleton className="h-4 w-3/4" />
            )}
          </DialogHeader>

          {(member.role || member.description) && (
            <section className="space-y-1 rounded-md border bg-muted/50 p-3 sm:p-4">
              <h3 className="text-xs text-muted-foreground">{t("inTeam", { team: teamTitle })}</h3>
              {member.role && <p className="text-sm font-semibold wrap-anywhere">{member.role}</p>}
              {member.description && <p className="text-sm text-muted-foreground wrap-anywhere">{member.description}</p>}
            </section>
          )}

          <section className="min-w-0 space-y-3">
            <h3 className="text-base font-semibold">{t("installBot")}</h3>
            {!loaded ? (
              <Skeleton className="h-32 w-full" />
            ) : data ? (
              <BotInstall
                botId={member.id}
                urls={data.urls}
                options={data.install.map((option) => ({ ...option, platformName: BOT_PLATFORM_INFO[option.platform].name }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("botLoadError")}</p>
            )}
          </section>

          <DialogFooter>
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href={getBotUrl(member.id, member.slug)}>
                {t("viewBot")}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
