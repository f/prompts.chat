import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { BotTeamForm } from "@/components/bots/teams/bot-team-form";
import { getTeam, getTeamFormOptions } from "@/lib/bots/teams";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotTeamUrl } from "@/lib/urls";

// Signed-in workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface NewTeamChangeRequestPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewTeamChangeRequestPage({ params }: NewTeamChangeRequestPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const viewer = { id: session.user.id, role: session.user.role };
  const team = await getTeam({ slug }, viewer);
  if (!team) {
    notFound();
  }
  const teamPath = getBotTeamUrl(team.slug);
  if (team.authorId === viewer.id) {
    redirect(`${teamPath}/edit`);
  }

  const t = await getTranslations("changeRequests");
  const { categories, tags } = await getTeamFormOptions();

  return (
    <div className="container max-w-3xl py-8">
      <Link href={teamPath} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("backToTeam")}
      </Link>
      <BotTeamForm
        propose
        categories={categories}
        tags={tags}
        team={{
          slug: team.slug,
          title: team.title,
          description: team.description ?? "",
          categoryId: team.category?.id,
          tagIds: team.tags.map((tag) => tag.id),
          members: team.members.map(({ bot, role, description }) => ({
            botId: bot.id,
            title: bot.title,
            icon: bot.icon,
            color: bot.color,
            computerRequirements: bot.computerRequirements,
            role: role ?? "",
            description: description ?? "",
          })),
          links: team.links,
        }}
      />
    </div>
  );
}
