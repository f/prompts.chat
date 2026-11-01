import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { deleteTeam, setTeamUnlisted, teamModerationSchema } from "@/lib/bots/teams";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const notFound = () => NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 });

// PATCH - Unlist or relist a team. Body: { isUnlisted: boolean }
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  try {
    const { id } = await params;
    const parsed = teamModerationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid body", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const team = await db.botTeam.findUnique({ where: { id }, select: { id: true } });
    if (!team) return notFound();

    const updated = await setTeamUnlisted(id, parsed.data.isUnlisted);
    return NextResponse.json({
      success: true,
      ...updated,
      message: updated.isUnlisted ? "Team unlisted" : "Team relisted",
    });
  } catch (error) {
    console.error("Admin moderate team error:", error);
    return NextResponse.json({ error: "server_error", message: "Failed to update team" }, { status: 500 });
  }
}

// DELETE - Delete a team; its bots stay as they are
export async function DELETE(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  try {
    const { id } = await params;
    const team = await db.botTeam.findUnique({ where: { id }, select: { id: true, slug: true, title: true } });
    if (!team) return notFound();

    await deleteTeam(id);
    return NextResponse.json({ success: true, message: "Team deleted successfully", deletedTeam: team });
  } catch (error) {
    console.error("Admin delete team error:", error);
    return NextResponse.json({ error: "server_error", message: "Failed to delete team" }, { status: 500 });
  }
}
