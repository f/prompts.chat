import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { authorizeTeamWrite, parseTeamBody } from "@/lib/bots/team-api";
import { createTeamChangeRequest, listTeamChangeRequests, TEAM_CHANGE_REASON_MAX_LENGTH } from "@/lib/bots/team-changes";
import { getTeam } from "@/lib/bots/teams";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const notFound = () => NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 });

const reasonSchema = z.object({ reason: z.string().trim().max(TEAM_CHANGE_REASON_MAX_LENGTH).nullish() });

/** Change requests of a team the viewer may see, newest first */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    const team = await getTeam({ slug }, session?.user ? { id: session.user.id, role: session.user.role } : null);
    if (!team) return notFound();
    return NextResponse.json(await listTeamChangeRequests(team.id));
  } catch (error) {
    console.error("List team change requests error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}

/** Proposes changes to someone else's team. Body: the whole team as for PUT, plus an optional `reason` */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const team = await getTeam({ slug }, authorized.user);
    if (!team) return notFound();

    const parsed = await parseTeamBody(request.clone());
    if ("response" in parsed) return parsed.response;
    const reason = reasonSchema.safeParse(await request.json().catch(() => null));
    if (!reason.success) {
      return NextResponse.json(
        { error: "validation_error", message: reason.error.issues[0]?.message ?? "Invalid reason", details: reason.error.issues },
        { status: 400 }
      );
    }

    const result = await createTeamChangeRequest(authorized.user, team, parsed.input, reason.data.reason ?? null);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Create team change request error:", error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
