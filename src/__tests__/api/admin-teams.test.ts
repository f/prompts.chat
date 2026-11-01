import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/admin/teams/route";
import { PATCH, DELETE } from "@/app/api/admin/teams/[id]/route";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    botTeam: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));

const params = { params: Promise.resolve({ id: "team-1" }) };

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/teams/team-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin teams API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin" });
    vi.mocked(db.botTeam.findMany).mockResolvedValue([]);
    vi.mocked(db.botTeam.count).mockResolvedValue(0);
    vi.mocked(db.botTeam.findUnique).mockResolvedValue({ id: "team-1", slug: "crew", title: "Crew" } as never);
  });

  it("rejects non-admins", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    });
    expect((await GET(new Request("http://localhost/api/admin/teams"))).status).toBe(403);
    expect((await PATCH(jsonRequest("PATCH", { isUnlisted: true }), params)).status).toBe(403);
    expect((await DELETE(new Request("http://localhost/api/admin/teams/team-1"), params)).status).toBe(403);
    expect(db.botTeam.update).not.toHaveBeenCalled();
  });

  it("lists every team, unlisted ones included, newest first with pagination", async () => {
    vi.mocked(db.botTeam.count).mockResolvedValue(42);
    const response = await GET(new Request("http://localhost/api/admin/teams?page=2&perPage=20"));
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 42, totalPages: 3 });
    const args = vi.mocked(db.botTeam.findMany).mock.calls[0][0]!;
    expect(args).toMatchObject({ skip: 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], where: {} });
  });

  it("filters unlisted teams and searches titles", async () => {
    await GET(new Request("http://localhost/api/admin/teams?filter=unlisted&search=crew"));
    expect(vi.mocked(db.botTeam.findMany).mock.calls[0][0]!.where).toMatchObject({
      isUnlisted: true,
      OR: expect.arrayContaining([{ title: { contains: "crew", mode: "insensitive" } }]),
    });
  });

  it("unlists and relists a team", async () => {
    vi.mocked(db.botTeam.update).mockResolvedValue({ id: "team-1", slug: "crew", isUnlisted: true, unlistedAt: new Date() } as never);
    const response = await PATCH(jsonRequest("PATCH", { isUnlisted: true }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, isUnlisted: true, message: "Team unlisted" });
    expect(vi.mocked(db.botTeam.update).mock.calls[0][0].data).toMatchObject({ isUnlisted: true });

    vi.mocked(db.botTeam.update).mockResolvedValue({ id: "team-1", slug: "crew", isUnlisted: false, unlistedAt: null } as never);
    await PATCH(jsonRequest("PATCH", { isUnlisted: false }), params);
    expect(vi.mocked(db.botTeam.update).mock.calls[1][0].data).toEqual({ isUnlisted: false, unlistedAt: null });
  });

  it("validates the PATCH body", async () => {
    expect((await PATCH(jsonRequest("PATCH", {}), params)).status).toBe(400);
    expect((await PATCH(jsonRequest("PATCH", { isUnlisted: true, title: "x" }), params)).status).toBe(400);
  });

  it("404 for unknown teams", async () => {
    vi.mocked(db.botTeam.findUnique).mockResolvedValue(null);
    expect((await PATCH(jsonRequest("PATCH", { isUnlisted: true }), params)).status).toBe(404);
    expect((await DELETE(new Request("http://localhost/api/admin/teams/team-1"), params)).status).toBe(404);
  });

  it("deletes a team", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/teams/team-1"), params);
    expect(response.status).toBe(200);
    expect(db.botTeam.delete).toHaveBeenCalledWith({ where: { id: "team-1" } });
  });
});
