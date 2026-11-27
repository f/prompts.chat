import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { authorizeTeamWrite } from "@/lib/bots/team-api";
import {
  dismissTeamChangeRequest,
  getTeamChangeRequest,
  reviewTeamChangeRequest,
  TEAM_REVIEW_NOTE_MAX_LENGTH,
} from "@/lib/bots/team-changes";
import { getTeam } from "@/lib/bots/teams";

interface RouteParams {
  params: Promise<{ slug: string; changeId: string }>;
}

const notFound = (message = "Team not found") => NextResponse.json({ error: "not_found", message }, { status: 404 });
const serverError = () => NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  reviewNote: z.string().trim().max(TEAM_REVIEW_NOTE_MAX_LENGTH).nullish(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug, changeId } = await params;
    const session = await auth();
    const viewer = session?.user ? { id: session.user.id, role: session.user.role } : null;
    const team = await getTeam({ slug }, viewer);
    if (!team) return notFound();
    const changeRequest = await getTeamChangeRequest(team.id, changeId, viewer);
    if (!changeRequest) return notFound("Change request not found");
    return NextResponse.json(changeRequest);
  } catch (error) {
    console.error("Get team change request error:", error);
    return serverError();
  }
}

/** Approve, reject (with an optional reviewNote) or reopen; the team owner and admins only */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { slug, changeId } = await params;
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const team = await getTeam({ slug }, authorized.user);
    if (!team) return notFound();

    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await reviewTeamChangeRequest(authorized.user, team, changeId, parsed.data.status, parsed.data.reviewNote ?? null);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ success: true, status: result.data.status });
  } catch (error) {
    console.error("Review team change request error:", error);
    return serverError();
  }
}

/** The author dismisses their own pending change request */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { slug, changeId } = await params;
    const authorized = await authorizeTeamWrite(request);
    if ("response" in authorized) return authorized.response;
    const team = await getTeam({ slug }, authorized.user);
    if (!team) return notFound();

    const result = await dismissTeamChangeRequest(authorized.user, team, changeId);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Dismiss team change request error:", error);
    return serverError();
  }
}
