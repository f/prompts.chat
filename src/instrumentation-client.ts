// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Patterns to ignore - typically from browser extensions or third-party scripts
const ignoreErrors = [
  // Browser extension errors
  /MetaMask/i,
  /ethereum/i,
  /tronlink/i,
  /tron/i,
  /webkit\.messageHandlers/i,
  /disconnected port/i,
  /__firefox__/i,
  // DOM manipulation errors often caused by extensions
  /removeChild.*not a child/i,
  /parentNode.*null/i,
  // Third-party/extension scripts
  /CONFIG.*not defined/i,
  /Can't find variable: CONFIG/i,
];

Sentry.init({
  // Set from NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN at build time (see src/lib/build-config.ts)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Disable Sentry in development and when no DSN is configured
  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Filter out browser extension and third-party script errors
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || "";
    const type = event.exception?.values?.[0]?.type || "";
    const fullMessage = `${type}: ${message}`;

    // Check if error matches any ignore pattern
    if (ignoreErrors.some((pattern) => pattern.test(fullMessage))) {
      return null;
    }

    // Filter out errors from browser extension scripts
    const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
    const hasExtensionFrame = frames.some((frame) => {
      const filename = frame.filename || "";
      return (
        filename.includes("extension://") ||
        filename.includes("moz-extension://") ||
        filename.includes("chrome-extension://")
      );
    });

    if (hasExtensionFrame) {
      return null;
    }

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
