/**
 * Database connection settings, resolved from the environment so the same
 * build can run on Node (Vercel, Docker, `next start`) and on worker isolates
 * (Spacefast, Cloudflare) without code changes.
 */

type Env = Record<string, string | undefined>;

/**
 * - `prisma`: Prisma's built-in query engine over TCP. Needs Node.
 * - `neon`: Neon's serverless driver. Queries go over HTTPS `fetch`, interactive
 *   transactions over a short-lived WebSocket. Works in worker isolates, which
 *   cannot open TCP sockets.
 */
export type DatabaseDriver = "prisma" | "neon";

const DATABASE_DRIVERS: readonly DatabaseDriver[] = ["prisma", "neon"];

/**
 * Some hosts withhold `DATABASE_URL` from server code by name (Spacefast drops
 * it before it reaches a worker), so `PCHAT_DATABASE_URL` takes precedence.
 */
export function getDatabaseUrl(env: Env = process.env): string | undefined {
  return env.PCHAT_DATABASE_URL || env.DATABASE_URL || undefined;
}

/** True inside a Cloudflare-style worker isolate (Spacefast Functions, Workers) */
export function isWorkerRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export function getDatabaseDriver(env: Env = process.env, worker: boolean = isWorkerRuntime()): DatabaseDriver {
  const configured = env.PCHAT_DB_DRIVER?.trim().toLowerCase();
  if (configured) {
    if (!(DATABASE_DRIVERS as readonly string[]).includes(configured)) {
      throw new Error(`PCHAT_DB_DRIVER must be one of ${DATABASE_DRIVERS.join(", ")}; got "${env.PCHAT_DB_DRIVER}"`);
    }
    return configured as DatabaseDriver;
  }
  return worker ? "neon" : "prisma";
}
