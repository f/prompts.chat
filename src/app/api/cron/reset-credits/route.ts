import { NextRequest } from "next/server";
import { authorizeCronHeader } from "@/lib/cron";
import { resetCredits } from "./reset";

/**
 * Cron job endpoint to reset daily generation credits for all users.
 * Should be called daily by any scheduler (Vercel Cron, GitHub Actions, system cron).
 * Schedulers that cannot send headers, such as Spacefast crons, use
 * /api/cron/reset-credits/<CRON_PATH_TOKEN> instead.
 * 
 * Requires CRON_SECRET environment variable for authentication.
 * 
 * Cron Notation: 0 0 * * * (Every day at midnight)
 * 
 * Example cron call:
 * curl -X POST https://your-domain.com/api/cron/reset-credits \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  return authorizeCronHeader(request) ?? resetCredits();
}

// Also support GET for simple health checks / manual triggers via browser
export async function GET(request: NextRequest) {
  return POST(request);
}
