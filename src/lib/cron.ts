import { NextResponse } from "next/server";

/** Compares secrets without leaking the position of the first mismatch through timing */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (typeof provided !== "string") return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

/**
 * Authorizes a scheduler call that carries `Authorization: Bearer <CRON_SECRET>`,
 * which Vercel Cron sends on its own and GitHub Actions or curl can send.
 * Returns an error response to send back, or null when the call may proceed.
 */
export function authorizeCronHeader(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  const providedSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!secretsMatch(providedSecret, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Authorizes a scheduler that can only send a plain GET to a path, such as
 * Spacefast crons, by a token in the last path segment. The token is a separate
 * `CRON_PATH_TOKEN` because it ends up in the scheduler's config and logs.
 * Unset, these routes do not exist.
 */
export function authorizeCronPathToken(token: string): NextResponse | null {
  const pathToken = process.env.CRON_PATH_TOKEN;
  if (!pathToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!secretsMatch(token, pathToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
