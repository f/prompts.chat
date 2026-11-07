import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClassifierForm } from "@/components/classifiers/classifier-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create Classifier",
  robots: NOINDEX_ROBOTS,
};

export default async function NewClassifierPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("prompts");
  const sources = await db.classifierSource.findMany({ select: { id: true } });

  return (
    <div className="container max-w-3xl py-8">
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>{t("createInfo")}</AlertDescription>
      </Alert>
      <ClassifierForm mode="create" sourceIds={sources.map((s) => s.id)} />
    </div>
  );
}
