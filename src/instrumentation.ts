import type { Instrumentation } from "next";

// PCHAT_SENTRY_SERVER is inlined at build time (next.config.ts). The imports sit
// inside `if` blocks on it, rather than after an early return, so that webpack
// drops them from the server bundle on hosts without server-side Sentry.
export async function register() {
  if (process.env.PCHAT_SENTRY_SERVER === "1") {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      await import("../sentry.edge.config");
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.PCHAT_SENTRY_SERVER === "1") {
    const { captureRequestError } = await import("@sentry/nextjs");
    captureRequestError(...args);
  }
};
