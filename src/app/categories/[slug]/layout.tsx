import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  CATEGORY_PROMPTS_PER_PAGE,
  categoryPromptsWhere,
  getRequestSearchParams,
  isPageOutOfRange,
  parsePageParam,
} from "@/lib/listing-pagination";

interface CategoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Returns a real 404 for unknown categories and for pages past the end of the
 * listing. This runs before the loading.tsx boundary below it starts
 * streaming the page with a 200 status.
 */
export default async function CategoryLayout({ children, params }: CategoryLayoutProps) {
  const { slug } = await params;
  const category = await db.category.findUnique({ where: { slug }, select: { id: true } });

  if (!category) {
    notFound();
  }

  const searchParams = await getRequestSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  if (page > 1) {
    const total = await db.prompt.count({ where: categoryPromptsWhere(category.id, searchParams.get("q")) });
    if (isPageOutOfRange(page, total, CATEGORY_PROMPTS_PER_PAGE)) {
      notFound();
    }
  }

  return children;
}
