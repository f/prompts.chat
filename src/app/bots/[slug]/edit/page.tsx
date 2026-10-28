import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BotForm } from "@/components/bots/bot-form";
import { extractBotId, getBotById } from "@/lib/bots";
import { getBotPairings } from "@/lib/bots/pairings";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Edit Bot",
  robots: NOINDEX_ROBOTS,
};

interface EditBotPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditBotPage({ params }: EditBotPageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const bot = await getBotById(extractBotId(slug));
  if (!bot) {
    notFound();
  }

  if (bot.authorId !== session.user.id && session.user.role !== "ADMIN") {
    redirect(getBotUrl(bot.id, bot.slug));
  }

  const isAdmin = session.user.role === "ADMIN";
  const [categories, tags, pairings] = await Promise.all([
    db.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, color: true } }),
    isAdmin ? getBotPairings(bot.id, { includeHidden: true }) : [],
  ]);

  return (
    <div className="container max-w-3xl py-8">
      <BotForm
        mode="edit"
        botId={bot.id}
        categories={categories}
        tags={tags}
        canManagePairings={isAdmin}
        initialData={{
          title: bot.title,
          description: bot.description ?? "",
          botPlatforms: bot.platforms,
          botIcon: bot.icon,
          botColor: bot.color,
          installUrl: bot.installUrl ?? "",
          content: bot.instructions,
          isPrivate: bot.isPrivate,
          categoryId: bot.category?.id,
          tagIds: bot.tags.map((tag) => tag.id),
          config: bot.config,
          pairings: pairings.map(({ bot: paired, note }) => ({
            botId: paired.id,
            title: paired.title,
            icon: paired.icon,
            color: paired.color,
            note: note ?? "",
          })),
        }}
      />
    </div>
  );
}
