import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const FILTERS: Record<string, Prisma.BotTeamWhereInput> = {
  all: {},
  listed: { isUnlisted: false },
  unlisted: { isUnlisted: true },
  featured: { isFeatured: true },
};

// GET - List every team, unlisted ones included, newest first, for admins and moderation routines
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      Math.max(1, Number.parseInt(searchParams.get("perPage") || searchParams.get("limit") || "20", 10) || 20),
      100
    );
    const search = searchParams.get("search")?.trim() || "";
    const filter = FILTERS[searchParams.get("filter") || "all"] ?? FILTERS.all;
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where: Prisma.BotTeamWhereInput = {
      ...filter,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [teams, total] = await Promise.all([
      db.botTeam.findMany({
        where,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          isFeatured: true,
          isUnlisted: true,
          unlistedAt: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { members: true, votes: true } },
        },
      }),
      db.botTeam.count({ where }),
    ]);

    return NextResponse.json({
      teams,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin list teams error:", error);
    return NextResponse.json({ error: "server_error", message: "Failed to fetch teams" }, { status: 500 });
  }
}
