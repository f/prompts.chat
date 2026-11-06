import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ClassifierForm } from "@/components/classifiers/classifier-form";
import { findClassifierBySlug } from "@/lib/classifiers/store";
import { configFromDefinition } from "@/lib/classifiers/schema";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getClassifierUrl } from "@/lib/urls";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface NewClassifierChangeRequestPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewClassifierChangeRequestPage({ params }: NewClassifierChangeRequestPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const found = await findClassifierBySlug(slug);
  // Same rules as prompts: no change requests on private classifiers
  if (!found || found.row.isPrivate) {
    notFound();
  }
  const { record, row } = found;
  const classifierPath = getClassifierUrl(record.slug);
  if (row.authorId === session.user.id) {
    redirect(classifierPath);
  }

  const t = await getTranslations("changeRequests");
  const sources = await db.classifierSource.findMany({ select: { id: true } });

  return (
    <div className="container max-w-3xl py-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href={classifierPath}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t("backToClassifier")}
        </Link>
      </Button>

      <ClassifierForm
        mode="propose"
        promptId={row.id}
        classifierSlug={record.slug}
        sourceIds={sources.map((s) => s.id)}
        initial={{ title: record.name, fields: { description: record.summary, config: configFromDefinition(record) }, isPrivate: row.isPrivate }}
      />
    </div>
  );
}
