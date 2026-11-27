import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTeam, getTeamInstallOptions } from "@/lib/bots/teams";
import { getBaseUrl } from "@/lib/seo";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** The team's install prompts and commands per platform, for the install dialog of a team card */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const session = await auth();
  const team = await getTeam({ slug }, session?.user ? { id: session.user.id, role: session.user.role } : null);
  if (!team) return NextResponse.json({ error: "not_found", message: "Team not found" }, { status: 404 });
  return NextResponse.json(
    { options: getTeamInstallOptions(team, getBaseUrl()) },
    { headers: { "X-Robots-Tag": "noindex" } }
  );
}
