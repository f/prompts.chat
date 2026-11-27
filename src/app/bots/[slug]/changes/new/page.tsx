import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BotForm } from "@/components/bots/bot-form";
import { extractBotId, getBotById } from "@/lib/bots";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface NewBotChangeRequestPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewBotChangeRequestPage({ params }: NewBotChangeRequestPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const bot = await getBotById(extractBotId(slug));
  // Same rules as prompts: no change requests on private bots
  if (!bot || bot.isPrivate) {
    notFound();
  }

  const botPath = getBotUrl(bot.id, bot.slug);
  if (bot.authorId === session.user.id) {
    redirect(botPath);
  }

  const t = await getTranslations("changeRequests");

  return (
    <div className="container max-w-3xl py-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href={botPath}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t("backToBot")}
        </Link>
      </Button>

      <BotForm
        mode="propose"
        botId={bot.id}
        basePath={botPath}
        categories={[]}
        tags={[]}
        initialData={{
          title: bot.title,
          description: bot.description ?? "",
          botPlatforms: bot.platforms,
          botIcon: bot.icon,
          botColor: bot.color,
          computerRequirements: bot.computerRequirements,
          installUrl: bot.installUrl ?? "",
          content: bot.instructions,
          isPrivate: bot.isPrivate,
          categoryId: bot.category?.id,
          tagIds: bot.tags.map((tag) => tag.id),
          config: bot.config,
        }}
      />
    </div>
  );
}
