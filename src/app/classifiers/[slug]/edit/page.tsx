import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClassifierForm } from "@/components/classifiers/classifier-form";
import { findClassifierBySlug } from "@/lib/classifiers/store";
import { configFromDefinition } from "@/lib/classifiers/schema";
import { NOINDEX_ROBOTS } from "@/lib/seo";
import { getClassifierUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Edit Classifier",
  robots: NOINDEX_ROBOTS,
};

interface EditClassifierPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditClassifierPage({ params }: EditClassifierPageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const found = await findClassifierBySlug(slug);
  if (!found) {
    notFound();
  }
  const { record, row } = found;
  if (row.authorId !== session.user.id && session.user.role !== "ADMIN") {
    // Same as bots: other users see the classifier, not its editor; private ones stay hidden
    if (row.isPrivate) notFound();
    redirect(getClassifierUrl(record.slug));
  }

  const sources = await db.classifierSource.findMany({ select: { id: true } });

  return (
    <div className="container max-w-3xl py-8">
      <ClassifierForm
        mode="edit"
        promptId={row.id}
        classifierSlug={record.slug}
        sourceIds={sources.map((s) => s.id)}
        initial={{ title: record.name, fields: { description: record.summary, config: configFromDefinition(record) }, isPrivate: row.isPrivate }}
      />
    </div>
  );
}
