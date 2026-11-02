import { getTranslations } from "next-intl/server";
import { PromptLibrary } from "@/components/my-library/prompt-library";
import type { LibraryPrompt } from "@/lib/my-library";
import { loadRepositoryLibrary } from "@/lib/my-library/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("myLibrary");
  return { title: t("title") };
}

export default async function MyLibraryPage() {
  const t = await getTranslations("myLibrary");
  let prompts: LibraryPrompt[];
  try {
    prompts = await loadRepositoryLibrary();
  } catch (error) {
    console.error("Repository prompt library could not be loaded", error);
    return <div role="alert" className="container mx-auto p-8">{t("loadError")}</div>;
  }
  return <PromptLibrary initialPrompts={prompts} />;
}
