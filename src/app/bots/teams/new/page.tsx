import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { BotTeamForm } from "@/components/bots/teams/bot-team-form";
import { getTeamFormOptions } from "@/lib/bots/teams";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create Team",
  description: "Create a team of bots that hand work off to each other",
  robots: NOINDEX_ROBOTS,
};

export default async function NewBotTeamPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("bots.teams");
  const { categories, tags } = await getTeamFormOptions();

  return (
    <div className="container max-w-3xl py-8">
      <Link href="/bots/teams" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("backToTeams")}
      </Link>
      <BotTeamForm categories={categories} tags={tags} />
    </div>
  );
}
