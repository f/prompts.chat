import { createHmac } from "crypto";

/**
 * Derives the pseudonymous id sent to Google Analytics as `user_id`.
 *
 * HMAC-SHA256 keyed with the server's auth secret, so it cannot be reversed
 * to the database id (or brute-forced from it) without that secret. Returns
 * null when analytics is not configured or no secret is available, in which
 * case no `user_id` is sent at all.
 */
export function getAnalyticsUserId(userId: string | null | undefined): string | null {
  if (!userId || !process.env.GOOGLE_ANALYTICS_ID) return null;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(`ga-user-id:${userId}`)
    .digest("hex")
    .slice(0, 32);
}
