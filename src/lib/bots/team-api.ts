import { NextResponse } from "next/server";
import { getSessionOrAdminApiKeyUser } from "@/lib/admin-auth";
import { botTeamInputSchema, type BotTeamInput } from "@/lib/bots/team-schema";
import { botTeamWriteLimiter } from "@/lib/rate-limit";

type Writer = { id: string; role: string };

/** The signed-in writer within the team write rate limit, or the 401/429 response */
export async function authorizeTeamWrite(request: Request): Promise<{ user: Writer } | { response: NextResponse }> {
  const user = await getSessionOrAdminApiKeyUser(request);
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized", message: "You must be logged in" }, { status: 401 }) };
  }
  const limit = botTeamWriteLimiter.check(`user:${user.id}`);
  if (!limit.allowed) {
    return {
      response: NextResponse.json(
        { error: "rate_limit", message: `Too many team changes. Try again in ${limit.retryAfterSeconds}s.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      ),
    };
  }
  return { user };
}

/** The validated team body, or the 400 response */
export async function parseTeamBody(request: Request): Promise<{ input: BotTeamInput } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: "validation_error", message: "Invalid JSON body" }, { status: 400 }) };
  }
  const parsed = botTeamInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid team", details: parsed.error.issues },
        { status: 400 }
      ),
    };
  }
  return { input: parsed.data };
}
