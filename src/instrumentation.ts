import type { Instrumentation } from "next";

// PCHAT_SENTRY_SERVER is inlined at build time (next.config.ts), so on hosts
// without server-side Sentry these imports are dropped from the server bundle.
export async function register() {
  if (process.env.PCHAT_SENTRY_SERVER !== "1") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.PCHAT_SENTRY_SERVER !== "1") return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
