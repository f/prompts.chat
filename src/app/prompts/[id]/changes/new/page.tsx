import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ChangeRequestForm } from "@/components/prompts/change-request-form";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getBotUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface NewChangeRequestPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Extracts the prompt ID from a URL parameter that may contain a slug
 */
function extractPromptId(idParam: string): string {
  const underscoreIndex = idParam.indexOf("_");
  if (underscoreIndex !== -1) {
    return idParam.substring(0, underscoreIndex);
  }
  return idParam;
}

export default async function NewChangeRequestPage({ params }: NewChangeRequestPageProps) {
  const session = await auth();
  const t = await getTranslations("changeRequests");
  
  if (!session?.user) {
    redirect("/login");
  }

  const { id: idParam } = await params;
  const id = extractPromptId(idParam);

  const prompt = await db.prompt.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      structuredFormat: true,
      authorId: true,
      isPrivate: true,
      slug: true,
    },
  });

  if (!prompt) {
    notFound();
  }

  // Bots propose changes to every bot field on their own page
  if (prompt.type === "BOT") {
    redirect(`${getBotUrl(prompt.id, prompt.slug)}/changes/new`);
  }

  // Can't create change request for own prompt
  if (prompt.authorId === session.user.id) {
    redirect(`/prompts/${id}`);
  }

  // Can't create change request for private prompt
  if (prompt.isPrivate) {
    notFound();
  }

  return (
    <div className="container max-w-3xl py-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href={`/prompts/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t("backToPrompt")}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t("create")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {prompt.title}
        </p>
      </div>

      {/* Form */}
      <ChangeRequestForm 
        promptId={prompt.id} 
        currentContent={prompt.content}
        currentTitle={prompt.title}
        promptType={prompt.type}
        structuredFormat={prompt.structuredFormat}
      />
    </div>
  );
}
