import * as Sentry from "@sentry/nextjs";
import { validateEnvironment } from "@/lib/config";

export async function register() {
  // Validate environment variables at startup
  validateEnvironment();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
