"use client";

import { useTranslations } from "next-intl";
import { BotBundleInstall } from "@/components/bots/bot-bundle-install";
import type { BotBundleInstallOption } from "@/lib/bots/pairings";

interface TeamInstallProps {
  team: { id: string; slug: string; title: string; memberCount: number };
  /** Install options rendered on the server; without them they load when the dialog opens */
  options?: BotBundleInstallOption[];
  /** "card" shows a short "Install" button for team cards */
  variant?: "page" | "card";
  className?: string;
}

/** The "Install team" button and dialog with every member's install prompt and the handoffs */
export function TeamInstall({ team, options, variant = "page", className }: TeamInstallProps) {
  const t = useTranslations("bots.teams");
  return (
    <BotBundleInstall
      botId={`team:${team.id}`}
      botTitle={team.title}
      botCount={team.memberCount}
      options={options ?? { url: `/api/bots/teams/${encodeURIComponent(team.slug)}/install` }}
      labels={{
        trigger: variant === "card" ? t("installShort") : t("install"),
        title: t("installTitle", { count: team.memberCount }),
        description: t("installDescription", { team: team.title }),
      }}
      triggerClassName={className}
    />
  );
}
