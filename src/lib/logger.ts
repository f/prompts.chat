import pino, { type Logger } from "pino";

// Structured logger for Vyaxis Prompts.
//
// Design (Step 2, Path 1 — complements the existing Sentry stack, does not replace it):
// - Emits JSON to stdout. Vercel auto-captures stdout into runtime logs, and Vercel
//   Drains (Pro) can export it to any OTel-compatible backend.
// - Pino is also Fastify's native logger, so this module ports to the extracted
//   Prompts Service with no rewrite.
// - Redacts known-sensitive fields defensively (the User model carries password/apiKey).
//
// What this adds that Sentry does not: request-scoped correlation IDs for queryable,
// structured operation logs (recommendation latency, chain execution timing, etc.).

const isProd = process.env.NODE_ENV === "production";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: {
    service: "vyaxis-prompts",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  },
  formatters: {
    // Emit the level as a string label ("info") instead of the numeric code.
    level: (label: string) => ({ level: label }),
  },
  redact: {
    paths: [
      "password",
      "*.password",
      "apiKey",
      "*.apiKey",
      "token",
      "*.token",
      "authorization",
      "*.authorization",
    ],
    censor: "[redacted]",
  },
});

// Create a request-scoped child logger bound to a correlation id.
// The id is set on the inbound request by src/proxy.ts (header `x-request-id`)
// and read back in route handlers via request.headers.get("x-request-id").
export function requestLogger(requestId: string | null | undefined): Logger {
  return logger.child({ requestId: requestId ?? "unknown" });
}
