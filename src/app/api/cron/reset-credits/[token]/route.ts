import { authorizeCronPathToken } from "@/lib/cron";
import { resetCredits } from "../reset";

/** GET /api/cron/reset-credits/<CRON_PATH_TOKEN>, for schedulers that only send a plain GET */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return authorizeCronPathToken(token) ?? resetCredits();
}
