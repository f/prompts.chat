import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeTeamWrite, parseTeamBody } from "@/lib/bots/team-api";
import { createTeam, listTeams, teamSummaryJson } from "@/lib/bots/teams";
import { getBaseUrl } from "@/lib/seo";

const MAX_TEAMS = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const session = await auth();
  const { teams, total } = await listTeams({
    q: searchParams.get("q") ?? undefined,
    categorySlug: searchParams.get("category") || undefined,
    tagSlugs: (searchParams.get("tag") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    take: Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_TEAMS) : MAX_TEAMS,
    viewer: session?.user ? { id: session.user.id, role: session.user.role } : null,
  });
  const baseUrl = getBaseUrl();
  return NextResponse.json(
    { total, teams: teams.map((team) => teamSummaryJson(team, baseUrl)) },
    { headers: { "X-Robots-Tag": "noindex" } }
  );
}

export async function POST(request: Request) {
  try {
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const parsed = await parseTeamBody(request);
    if ("response" in parsed) return parsed.response;

    const result = await createTeam(authorized.user, parsed.input);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ id: result.data.id, slug: result.data.slug }, { status: 201 });
  } catch (error) {
    console.error("Create bot team error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
