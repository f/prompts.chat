import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestLogger } from "@/lib/logger";
import { executeComposition } from "@/lib/composition";
import { resolveUserOrganizationId } from "@/lib/organization";

const executeSchema = z.object({
  input: z.string().min(1),
  // organizationId / userId are optional and only ever validated against the
  // session-derived values — the execution context is built server-side.
  context: z
    .object({
      organizationId: z.string().min(1).optional(),
      userId: z.string().min(1).optional(),
      sessionId: z.string().nullable().optional(),
    })
    .optional(),
});

// POST /api/v1/compositions/[id]/execute — run the chain end-to-end
export async function POST(
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
    const body = await request.json();
    const { input, context } = executeSchema.parse(body);

    if (context?.organizationId && context.organizationId !== organizationId) {
      return NextResponse.json({ error: "organization_mismatch" }, { status: 403 });
    }
    if (context?.userId && context.userId !== session.user.id) {
      return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
    }

    const composition = await db.composition.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    // Cross-org executes return 404 (not 403) so composition ids don't leak.
    if (!composition || composition.organizationId !== organizationId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const result = await executeComposition(id, input, {
      organizationId,
      userId: session.user.id,
      sessionId: context?.sessionId ?? null,
    });

    log.info(
      {
        op: "composition.execute",
        compositionId: id,
        executionId: result.executionId,
        status: result.status,
        totalTokens: result.totalTokens,
        totalDuration: result.totalDuration,
      },
      "composition executed",
    );

    return NextResponse.json({ ...result, executionTrace: [] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Composition not found")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    log.error({ op: "composition.execute", err: error }, "composition execution failed");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
