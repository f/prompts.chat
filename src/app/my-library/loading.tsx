import { getTranslations } from "next-intl/server";
export default async function Loading() {
  const t = await getTranslations("myLibrary");
  return <p role="status" className="p-8 animate-pulse">{t("loading")}</p>;
}
