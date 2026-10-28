import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidApiKeyFormat } from "@/lib/api-key";

export function getRequestApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  return request.headers.get("x-api-key") || bearer || request.headers.get("prompts-api-key");
}

/**
 * The signed-in user, or else an admin authenticated by API key, for endpoints that
 * any user can call from the UI and admins can also call from scripts. Keys of
 * non-admin users are not accepted.
 */
export async function getSessionOrAdminApiKeyUser(request: Request): Promise<{ id: string; role: string } | null> {
  const session = await auth();
  if (session?.user?.id) {
    return { id: session.user.id, role: session.user.role ?? "USER" };
  }
  const apiKey = getRequestApiKey(request);
  if (!apiKey || !isValidApiKeyFormat(apiKey)) return null;
  const user = await db.user.findUnique({ where: { apiKey }, select: { id: true, role: true } });
  return user?.role === "ADMIN" ? user : null;
}

/**
 * Authenticates an admin by session, or by an admin user's API key so that
 * scripts and scheduled routines can call admin endpoints. The role is read
 * from the database so a demoted admin's session or key stops working at once.
 */
export async function requireAdmin(
  request: Request
): Promise<{ userId: string; response?: never } | { userId?: never; response: NextResponse }> {
  const session = await auth();
  let user: { id: string; role: string } | null = null;

  if (session?.user?.id) {
    user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
  } else {
    const apiKey = getRequestApiKey(request);
    if (apiKey && isValidApiKeyFormat(apiKey)) {
      user = await db.user.findUnique({ where: { apiKey }, select: { id: true, role: true } });
    }
  }

  if (!user) {
    return {
      response: NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  if (user.role !== "ADMIN") {
    return {
      response: NextResponse.json(
        { error: "forbidden", message: "Admin access required" },
        { status: 403 }
      ),
    };
  }
  return { userId: user.id };
}
