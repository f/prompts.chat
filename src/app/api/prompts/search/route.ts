import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLimit } from "@/lib/pagination";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const MAX_KEYWORDS = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").slice(0, MAX_QUERY_LENGTH);
  const limit = parseLimit(searchParams.get("limit"), {
    defaultValue: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });
  const ownerOnly = searchParams.get("ownerOnly") === "true";

  if (query.length < 2) {
    return NextResponse.json({ prompts: [] });
  }

  const session = await auth();

  try {
    // Handle comma-separated keywords (capped so a crafted query can't build
    // an arbitrarily large OR clause)
    const keywords = query
      .split(",")
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);
    const titleConditions = keywords.length > 1
      ? keywords.map(keyword => ({ title: { contains: keyword, mode: "insensitive" as const } }))
      : [{ title: { contains: query, mode: "insensitive" as const } }];

    const prompts = await db.prompt.findMany({
      where: {
        deletedAt: null,
        isUnlisted: false,
        AND: [
          // Visibility filter
          ownerOnly && session?.user
            ? { authorId: session.user.id }
            : {
                OR: [
                  { isPrivate: false },
                  ...(session?.user ? [{ authorId: session.user.id }] : []),
                ],
              },
          // Search filter
          { OR: titleConditions },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        author: {
          select: {
            username: true,
          },
        },
      },
      take: limit,
      orderBy: [
        { isFeatured: "desc" },
        { viewCount: "desc" },
      ],
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
