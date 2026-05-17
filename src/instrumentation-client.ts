/**
 * Sentry init for the browser. Runs as soon as the client bundle boots.
 *
 * Required by `@sentry/nextjs` v10+ — equivalent to the legacy
 * `sentry.client.config.ts`.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Replay only captures 1% of normal sessions, but 100% of sessions that
  // hit an error — keeps quota low while preserving debugging value.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  integrations: [
    Sentry.replayIntegration({
      // Don't capture text/PII by default — patient names, phone numbers,
      // medical notes are all in the DOM. Replay is for layout/interaction
      // context only.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  ignoreErrors: [
    // ResizeObserver loop warnings are noise from Chrome — they never break
    // anything, but they generate ~95% of frontend events if not filtered.
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
