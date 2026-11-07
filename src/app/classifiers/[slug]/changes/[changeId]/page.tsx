import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ChangeRequestDetail } from "@/components/prompts/change-request-detail";
import { findClassifierBySlug } from "@/lib/classifiers/store";
import { canViewPrompt } from "@/lib/prompt-access";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getClassifierUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface ClassifierChangeRequestPageProps {
  params: Promise<{ slug: string; changeId: string }>;
}

export default async function ClassifierChangeRequestPage({ params }: ClassifierChangeRequestPageProps) {
  const { slug, changeId } = await params;
  const session = await auth();
  const found = await findClassifierBySlug(slug, { includeDeleted: session?.user?.role === "ADMIN" });
  if (!found || !canViewPrompt({ isPrivate: found.row.isPrivate, authorId: found.row.authorId }, session)) {
    notFound();
  }

  const t = await getTranslations("changeRequests");

  return (
    <ChangeRequestDetail
      promptId={found.row.id}
      changeId={changeId}
      basePath={getClassifierUrl(found.record.slug)}
      backLabel={t("backToClassifier")}
    />
  );
}
