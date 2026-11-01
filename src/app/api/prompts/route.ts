import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionOrAdminApiKeyUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { promptListTypeWhere } from "@/lib/prompt-list";
import { isTrending, trendingWhere } from "@/lib/trending";
import { createPrompt } from "@/lib/prompt-write";

// Create prompt
export async function POST(request: Request) {
  try {
    const user = await getSessionOrAdminApiKeyUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in" },
        { status: 401 }
      );
    }

    const result = await createPrompt(user, await request.json());
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Create prompt error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// List prompts (for API access)
const MAX_API_PER_PAGE = 100;
const DEFAULT_API_PER_PAGE = 24;
const MAX_API_PAGE = 10000;
const DEFAULT_API_PAGE = 1;

const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, MAX_API_PAGE))
    .catch(DEFAULT_API_PAGE),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, MAX_API_PER_PAGE))
    .catch(DEFAULT_API_PER_PAGE),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage } = paginationQuerySchema.parse({
      page: searchParams.get("page"),
      perPage: searchParams.get("perPage"),
    });
    const type = searchParams.get("type");
    const categoryId = searchParams.get("category");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort");
    const q = searchParams.get("q");
    const trending = searchParams.get("trending");

    const where: Record<string, unknown> = {
      isPrivate: false,
      isUnlisted: false, // Exclude unlisted prompts from public API
      deletedAt: null, // Exclude soft-deleted prompts
      // Exclude intermediate flow prompts (only show first prompts or standalone)
      // Note: "related" connections are AI-suggested similar prompts, not flow connections
      incomingConnections: { none: { label: { not: "related" } } },
    };

    Object.assign(where, promptListTypeWhere(type));

    if (trending === "1" || trending === "true") {
      Object.assign(where, trendingWhere());
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tag) {
      // Handle multiple tags (comma-separated)
      const tagSlugs = tag.split(",").map(t => t.trim()).filter(Boolean);
      if (tagSlugs.length > 0) {
        where.AND = tagSlugs.map(slug => ({
          tags: {
            some: {
              tag: { slug },
            },
          },
        }));
      }
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    // Build order by clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: "desc" };
    if (sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (sort === "upvotes") {
      orderBy = { votes: { _count: "desc" } };
    }

    const [promptsRaw, total] = await Promise.all([
      db.prompt.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              verified: true,
            },
          },
          category: {
            include: {
              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          contributors: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              votes: true,
              contributors: true,
              outgoingConnections: { where: { label: { not: "related" } } },
              incomingConnections: { where: { label: { not: "related" } } },
            },
          },
          userExamples: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              mediaUrl: true,
              user: {
                select: {
                  username: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      db.prompt.count({ where }),
    ]);

    // Transform to include voteCount and contributorCount, exclude internal fields
    const prompts = promptsRaw.map(({ isPrivate: _p, isUnlisted: _u, unlistedAt: _ua, deletedAt: _d, ...p }) => ({
      ...p,
      isTrending: isTrending(p.trendingUntil),
      voteCount: p._count.votes,
      contributorCount: p._count.contributors,
      contributors: p.contributors,
    }));

    return NextResponse.json({
      prompts,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error("List prompts error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong" },
      { status: 500 }
    );
  }
}
