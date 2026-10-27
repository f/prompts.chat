import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getRequestSearchParams,
  isPageOutOfRange,
  parsePageParam,
  TAG_PROMPTS_PER_PAGE,
  tagPromptsWhere,
} from "@/lib/listing-pagination";

interface TagLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Returns a real 404 for unknown tags and for pages past the end of the
 * listing. This runs before the loading.tsx boundary below it starts
 * streaming the page with a 200 status.
 */
export default async function TagLayout({ children, params }: TagLayoutProps) {
  const { slug } = await params;
  const tag = await db.tag.findUnique({ where: { slug }, select: { id: true } });

  if (!tag) {
    notFound();
  }

  const page = parsePageParam((await getRequestSearchParams()).get("page"));
  if (page > 1) {
    const session = await auth();
    const total = await db.prompt.count({ where: tagPromptsWhere(tag.id, session?.user?.id) });
    if (isPageOutOfRange(page, total, TAG_PROMPTS_PER_PAGE)) {
      notFound();
    }
  }

  return children;
}
