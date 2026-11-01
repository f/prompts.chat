import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BotForm } from "@/components/bots/bot-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create Bot",
  description: "Create a new AI agent bot",
  robots: NOINDEX_ROBOTS,
};

export default async function NewBotPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("prompts");
  const [categories, tags] = await Promise.all([
    db.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, color: true } }),
  ]);

  return (
    <div className="container max-w-3xl py-8">
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>{t("createInfo")}</AlertDescription>
      </Alert>
      <BotForm mode="create" categories={categories} tags={tags} canManagePairings={session.user.role === "ADMIN"} />
    </div>
  );
}
