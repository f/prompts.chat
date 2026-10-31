import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeam } from "@/lib/bots/teams";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** Signs in the voter and finds a team they can see; the error response otherwise */
async function authorizeVote(
  slug: string
): Promise<{ response: NextResponse } | { userId: string; teamId: string }> {
  const session = await auth();
  if (!session?.user) {
    return { response: NextResponse.json({ error: "unauthorized", message: "You must be logged in" }, { status: 401 }) };
  }
  const user = { id: session.user.id, role: session.user.role };
  const team = await getTeam({ slug }, user);
  if (!team || team.members.length === 0) {
    return { response: NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 }) };
  }
  return { userId: user.id, teamId: team.id };
}

const voteCount = (teamId: string) => db.botTeamVote.count({ where: { teamId } });

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const authorized = await authorizeVote((await params).slug);
    if ("response" in authorized) return authorized.response;
    const { userId, teamId } = authorized;
    await db.botTeamVote.upsert({
      where: { userId_teamId: { userId, teamId } },
      create: { userId, teamId },
      update: {},
    });
    return NextResponse.json({ voted: true, voteCount: await voteCount(teamId) });
  } catch (error) {
    console.error("Team vote error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const authorized = await authorizeVote((await params).slug);
    if ("response" in authorized) return authorized.response;
    const { userId, teamId } = authorized;
    await db.botTeamVote.deleteMany({ where: { userId, teamId } });
    return NextResponse.json({ voted: false, voteCount: await voteCount(teamId) });
  } catch (error) {
    console.error("Team unvote error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
