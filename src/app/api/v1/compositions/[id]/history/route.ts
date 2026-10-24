import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestLogger } from "@/lib/logger";
import { resolveUserOrganizationId } from "@/lib/organization";

// GET /api/v1/compositions/[id]/history — paginated execution history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = requestLogger(request.headers.get("x-request-id"));
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const organizationId = await resolveUserOrganizationId(session.user.id);
    if (!organizationId) {
      return NextResponse.json({ error: "no_organization" }, { status: 403 });
    }

    const { id } = await params;
    const composition = await db.composition.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    // Cross-org reads return 404 (not 403) so composition ids don't leak.
    if (!composition || composition.organizationId !== organizationId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const [total, executions] = await Promise.all([
      db.executionRecord.count({ where: { compositionId: id } }),
      db.executionRecord.findMany({
        where: { compositionId: id },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { stageTraces: true } } },
      }),
    ]);

    return NextResponse.json({
      executions,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    log.error({ op: "composition.history", err: error }, "failed to fetch history");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
