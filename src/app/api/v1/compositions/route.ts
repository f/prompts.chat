import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestLogger } from "@/lib/logger";
import { resolveUserOrganizationId } from "@/lib/organization";

const stageSchema = z.object({
  order: z.number().int(),
  promptId: z.string().min(1),
  fallbackPromptId: z.string().nullable().optional(),
  successThreshold: z.number().min(0).max(1).optional(),
  extractFields: z.array(z.string()).optional(),
  transformRules: z.record(z.string(), z.unknown()).nullable().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  // Optional and only ever validated against the server-resolved org — never
  // used as the source of truth.
  organizationId: z.string().min(1).optional(),
  stages: z.array(stageSchema).min(1),
});

// POST /api/v1/compositions — create a composition with N stages
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const data = createSchema.parse(body);

    if (data.organizationId && data.organizationId !== organizationId) {
      return NextResponse.json({ error: "organization_mismatch" }, { status: 403 });
    }

    const orders = data.stages.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      return NextResponse.json({ error: "duplicate stage order" }, { status: 400 });
    }

    const composition = await db.composition.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId,
        createdBy: session.user.id,
        stages: {
          create: data.stages.map((s) => ({
            order: s.order,
            promptId: s.promptId,
            fallbackPromptId: s.fallbackPromptId ?? null,
            successThreshold: s.successThreshold ?? 0.5,
            extractFields: s.extractFields ?? [],
            transformRules:
              s.transformRules == null
                ? Prisma.DbNull
                : (s.transformRules as Prisma.InputJsonValue),
          })),
        },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    log.info(
      { op: "composition.create", compositionId: composition.id, stages: composition.stages.length },
      "composition created",
    );

    return NextResponse.json(
      {
        id: composition.id,
        name: composition.name,
        description: composition.description,
        stages: composition.stages,
        createdAt: composition.createdAt,
        createdBy: composition.createdBy,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid input", details: error.issues }, { status: 400 });
    }
    log.error({ op: "composition.create", err: error }, "failed to create composition");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// GET /api/v1/compositions — list compositions in the caller's organization
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");
    if (requestedOrgId && requestedOrgId !== organizationId) {
      return NextResponse.json({ error: "organization_mismatch" }, { status: 403 });
    }

    const compositions = await db.composition.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        stages: { orderBy: { order: "asc" } },
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json({ compositions });
  } catch (error) {
    log.error({ op: "composition.list", err: error }, "failed to list compositions");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
