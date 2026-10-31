import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeTeamWrite, parseTeamBody } from "@/lib/bots/team-api";
import { canEditTeam, deleteTeam, getTeam, teamToJson, updateTeam } from "@/lib/bots/teams";
import { getBaseUrl } from "@/lib/seo";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const notFound = () => NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 });
const forbidden = () => NextResponse.json({ error: "forbidden", message: "You can only change your own teams" }, { status: 403 });

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const session = await auth();
  const team = await getTeam({ slug }, session?.user ? { id: session.user.id, role: session.user.role } : null);
  if (!team) return notFound();
  return NextResponse.json(teamToJson(team, getBaseUrl()), { headers: { "X-Robots-Tag": "noindex" } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const team = await getTeam({ slug }, authorized.user);
    if (!team) return notFound();
    if (!canEditTeam(team, authorized.user)) return forbidden();
    const parsed = await parseTeamBody(request);
    if ("response" in parsed) return parsed.response;

    const result = await updateTeam(authorized.user, team.id, parsed.input);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ id: result.data.id, slug: result.data.slug });
  } catch (error) {
    console.error("Update bot team error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const team = await getTeam({ slug }, authorized.user);
    if (!team) return notFound();
    if (!canEditTeam(team, authorized.user)) return forbidden();

    await deleteTeam(team.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete bot team error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
