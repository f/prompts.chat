import { NextResponse } from "next/server";
import { getSessionOrAdminApiKeyUser } from "@/lib/admin-auth";
import { authorizeTeamWrite, parseTeamBody } from "@/lib/bots/team-api";
import { createTeam, listTeams, TEAM_SORTS, teamSummaryJson, type TeamSort } from "@/lib/bots/teams";
import { getBaseUrl } from "@/lib/seo";

const MAX_TEAMS = 100;

function positiveInt(value: string | null): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Lists teams. `perPage` (or the older `limit`) and `page` paginate; `sort` is newest, oldest or
 * upvotes. An explicit `sort=newest` orders strictly by creation date, without featured teams first,
 * so moderation routines can scan new teams. Admins (by session or API key) can pass
 * `includeUnlisted=true` to also get unlisted teams and teams without public members.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user = await getSessionOrAdminApiKeyUser(request);
  const perPage = Math.min(positiveInt(searchParams.get("perPage")) ?? positiveInt(searchParams.get("limit")) ?? MAX_TEAMS, MAX_TEAMS);
  const page = positiveInt(searchParams.get("page")) ?? 1;
  const sortParam = searchParams.get("sort");
  const sort = TEAM_SORTS.includes(sortParam as TeamSort) ? (sortParam as TeamSort) : undefined;
  const includeUnlisted = user?.role === "ADMIN" && searchParams.get("includeUnlisted") === "true";

  const { teams, total } = await listTeams({
    q: searchParams.get("q") ?? undefined,
    categorySlug: searchParams.get("category") || undefined,
    tagSlugs: (searchParams.get("tag") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    sort,
    featuredFirst: !sort,
    includeUnlisted,
    skip: (page - 1) * perPage,
    take: perPage,
    viewer: user,
  });
  const baseUrl = getBaseUrl();
  return NextResponse.json(
    {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      teams: teams.map((team) => teamSummaryJson(team, baseUrl)),
    },
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
