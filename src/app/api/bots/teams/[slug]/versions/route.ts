import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTeamVersions } from "@/lib/bots/team-changes";
import { getTeam } from "@/lib/bots/teams";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** The team's versions, newest first; members the viewer may not see are left out of each snapshot */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
    const team = await getTeam({ slug }, viewer);
    if (!team) return NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 });
    return NextResponse.json(await listTeamVersions(team.id, viewer));
  } catch (error) {
    console.error("List team versions error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
