import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Route-level authz tests for /api/v1/compositions: userId comes from the
// session, organizationId is resolved server-side, and cross-org access is
// rejected on every route.

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    composition: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    executionRecord: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/composition", () => ({
  executeComposition: vi.fn(),
}));

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { executeComposition } from "@/lib/composition";
import { POST as createComposition, GET as listCompositions } from "@/app/api/v1/compositions/route";
import { GET as getComposition } from "@/app/api/v1/compositions/[id]/route";
import { GET as getHistory } from "@/app/api/v1/compositions/[id]/history/route";
import { POST as executeRoute } from "@/app/api/v1/compositions/[id]/execute/route";
import { POST as testRoute } from "@/app/api/v1/compositions/[id]/test/route";

const BASE = "http://localhost:3000/api/v1/compositions";

function jsonRequest(url: string, body?: unknown): NextRequest {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

// next-auth's `auth` export is overloaded (session getter + middleware wrapper),
// which breaks vi.mocked's inference — cast once to a plain mock.
const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;

const mockSession = (userId: string) => mockedAuth.mockResolvedValue({ user: { id: userId } });

const mockUserOrg = (organizationId: string | null) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.user.findUnique).mockResolvedValue({ organizationId } as any);

const validStages = [{ order: 1, promptId: "p1" }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/compositions (create)", () => {
  it("returns 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);
    const res = await createComposition(jsonRequest(BASE, { name: "x", stages: validStages }));
    expect(res.status).toBe(401);
  });

  it("rejects a client-supplied organizationId that mismatches the user's org", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    const res = await createComposition(
      jsonRequest(BASE, { name: "x", organizationId: "org2", stages: validStages }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("organization_mismatch");
    expect(db.composition.create).not.toHaveBeenCalled();
  });

  it("derives organizationId and createdBy server-side, ignoring the body for identity", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    vi.mocked(db.composition.create).mockResolvedValue({
      id: "c1",
      name: "x",
      description: null,
      stages: [],
      createdAt: new Date(),
      createdBy: "u1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await createComposition(jsonRequest(BASE, { name: "x", stages: validStages }));
    expect(res.status).toBe(201);
    const createArgs = vi.mocked(db.composition.create).mock.calls[0][0];
    expect(createArgs.data.organizationId).toBe("org1");
    expect(createArgs.data.createdBy).toBe("u1");
  });

  it("falls back to the default internal org for org-less users", async () => {
    mockSession("u1");
    mockUserOrg(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.organization.findUnique).mockResolvedValue({ id: "org_default" } as any);
    vi.mocked(db.composition.create).mockResolvedValue({
      id: "c1",
      name: "x",
      description: null,
      stages: [],
      createdAt: new Date(),
      createdBy: "u1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await createComposition(jsonRequest(BASE, { name: "x", stages: validStages }));
    expect(res.status).toBe(201);
    expect(db.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "internal" } }),
    );
    expect(vi.mocked(db.composition.create).mock.calls[0][0].data.organizationId).toBe(
      "org_default",
    );
  });

  it("returns 403 when the user has no org and the default org is missing", async () => {
    mockSession("u1");
    mockUserOrg(null);
    vi.mocked(db.organization.findUnique).mockResolvedValue(null);
    const res = await createComposition(jsonRequest(BASE, { name: "x", stages: validStages }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("no_organization");
  });
});

describe("GET /api/v1/compositions (list)", () => {
  it("always scopes the query to the caller's organization", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    vi.mocked(db.composition.findMany).mockResolvedValue([]);

    const res = await listCompositions(jsonRequest(BASE));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.composition.findMany).mock.calls[0][0]).toMatchObject({
      where: { organizationId: "org1" },
    });
  });

  it("rejects an organizationId query param for another org", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    const res = await listCompositions(jsonRequest(`${BASE}?organizationId=org2`));
    expect(res.status).toBe(403);
    expect(db.composition.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/compositions/[id]", () => {
  it("returns 404 for another org's composition", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    vi.mocked(db.composition.findUnique).mockResolvedValue({
      id: "c1",
      organizationId: "org2",
      stages: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await getComposition(jsonRequest(`${BASE}/c1`), params("c1"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/compositions/[id]/history", () => {
  it("returns 404 for another org's composition without querying records", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.composition.findUnique).mockResolvedValue({ organizationId: "org2" } as any);

    const res = await getHistory(jsonRequest(`${BASE}/c1/history`), params("c1"));
    expect(res.status).toBe(404);
    expect(db.executionRecord.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/compositions/[id]/execute", () => {
  it("returns 404 for another org's composition and never executes", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.composition.findUnique).mockResolvedValue({ organizationId: "org2" } as any);

    const res = await executeRoute(
      jsonRequest(`${BASE}/c1/execute`, { input: "hi" }),
      params("c1"),
    );
    expect(res.status).toBe(404);
    expect(executeComposition).not.toHaveBeenCalled();
  });

  it("rejects a context.userId that is not the session user", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    const res = await executeRoute(
      jsonRequest(`${BASE}/c1/execute`, { input: "hi", context: { userId: "u2" } }),
      params("c1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("user_mismatch");
    expect(executeComposition).not.toHaveBeenCalled();
  });

  it("rejects a context.organizationId for another org", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    const res = await executeRoute(
      jsonRequest(`${BASE}/c1/execute`, { input: "hi", context: { organizationId: "org2" } }),
      params("c1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("organization_mismatch");
    expect(executeComposition).not.toHaveBeenCalled();
  });

  it("builds the execution context from the session, not the body", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.composition.findUnique).mockResolvedValue({ organizationId: "org1" } as any);
    vi.mocked(executeComposition).mockResolvedValue({
      executionId: "e1",
      status: "success",
      stages: [],
      finalOutput: "out",
      totalTokens: 1,
      totalDuration: 1,
    });

    const res = await executeRoute(
      jsonRequest(`${BASE}/c1/execute`, { input: "hi", context: { sessionId: "s1" } }),
      params("c1"),
    );
    expect(res.status).toBe(200);
    expect(executeComposition).toHaveBeenCalledWith("c1", "hi", {
      organizationId: "org1",
      userId: "u1",
      sessionId: "s1",
    });
  });
});

describe("POST /api/v1/compositions/[id]/test", () => {
  it("returns 404 for another org's composition and never executes", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.composition.findUnique).mockResolvedValue({ organizationId: "org2" } as any);

    const res = await testRoute(
      jsonRequest(`${BASE}/c1/test`, { sampleInputs: ["hi"] }),
      params("c1"),
    );
    expect(res.status).toBe(404);
    expect(executeComposition).not.toHaveBeenCalled();
  });

  it("rejects a context.userId that is not the session user", async () => {
    mockSession("u1");
    mockUserOrg("org1");
    const res = await testRoute(
      jsonRequest(`${BASE}/c1/test`, { sampleInputs: ["hi"], context: { userId: "u2" } }),
      params("c1"),
    );
    expect(res.status).toBe(403);
    expect(executeComposition).not.toHaveBeenCalled();
  });
});
