import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getRequestSearchParams,
  isPageOutOfRange,
  parsePageParam,
  PROFILE_PROMPTS_PER_PAGE,
  profilePromptsWhere,
} from "@/lib/listing-pagination";
import { escapeLikePattern } from "@/lib/utils";

interface UserProfileLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

/**
 * Returns a real 404 for unknown users, for any other top-level path this
 * catch-all segment receives, and for prompt pages past the end of the
 * profile's listing. This runs before the loading.tsx boundary below it
 * starts streaming the page with a 200 status.
 */
export default async function UserProfileLayout({ children, params }: UserProfileLayoutProps) {
  const { username: rawUsername } = await params;
  const decodedUsername = decodeURIComponent(rawUsername);

  // Only support /@username format
  if (!decodedUsername.startsWith("@")) {
    notFound();
  }

  const user = await db.user.findFirst({
    where: { username: { equals: escapeLikePattern(decodedUsername.slice(1)), mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!user) {
    notFound();
  }

  const searchParams = await getRequestSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  if (page > 1) {
    const session = await auth();
    const total = await db.prompt.count({
      where: profilePromptsWhere(user.id, {
        includePrivate: session?.user?.id === user.id,
        date: searchParams.get("date"),
      }),
    });
    if (isPageOutOfRange(page, total, PROFILE_PROMPTS_PER_PAGE)) {
      notFound();
    }
  }

  return children;
}
