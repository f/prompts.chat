import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - List all prompts for admin with pagination and search
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedPage = parseInt(searchParams.get("page") || "1");
    const requestedLimit = parseInt(searchParams.get("limit") || "20");
    
    // Cap pagination to prevent database overload
    const page = Math.max(1, requestedPage);
    const limit = Math.min(Math.max(1, requestedLimit), 100);
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const filter = searchParams.get("filter") || "all";

    // Validate pagination
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validPage - 1) * validLimit;

    // Build filter conditions
    type WhereCondition = {
      OR?: Array<{ title?: { contains: string; mode: "insensitive" }; content?: { contains: string; mode: "insensitive" } }>;
      isUnlisted?: boolean;
      isPrivate?: boolean;
      isFeatured?: boolean;
      deletedAt?: { not: null } | null;
      reports?: { some: object };
    };

    const filterConditions: WhereCondition = {};
    
    switch (filter) {
      case "unlisted":
        filterConditions.isUnlisted = true;
        break;
      case "private":
        filterConditions.isPrivate = true;
        break;
      case "featured":
        filterConditions.isFeatured = true;
        break;
      case "deleted":
        filterConditions.deletedAt = { not: null };
        break;
      case "reported":
        filterConditions.reports = { some: {} };
        break;
      case "public":
        filterConditions.isPrivate = false;
        filterConditions.isUnlisted = false;
        filterConditions.deletedAt = null;
        break;
      default:
        // "all" - no filter
        break;
    }

    // Build where clause combining search and filters
    const where: WhereCondition = {
      ...filterConditions,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Build orderBy
    const validSortFields = ["createdAt", "updatedAt", "title", "viewCount"];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderByDirection = sortOrder === "asc" ? "asc" : "desc";

    // Fetch prompts and total count
    const [prompts, total] = await Promise.all([
      db.prompt.findMany({
        where,
        skip,
        take: validLimit,
        orderBy: { [orderByField]: orderByDirection },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          isPrivate: true,
          isUnlisted: true,
          isFeatured: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              votes: true,
              reports: true,
            },
          },
        },
      }),
      db.prompt.count({ where }),
    ]);

    return NextResponse.json({
      prompts,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    });
  } catch (error) {
    console.error("Admin list prompts error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}
