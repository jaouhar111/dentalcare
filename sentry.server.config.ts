/**
 * Sentry init for Node.js runtime (Server Components, Route Handlers, Server
 * Actions, cron jobs).
 *
 * When `NEXT_PUBLIC_SENTRY_DSN` is unset, Sentry SDK initialises with no DSN
 * and silently drops events — so the app still runs in dev without a Sentry
 * account.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Performance: 10% of transactions traced — enough to spot slow paths
  // without ballooning quota.
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Scrub Cookies + Authorization headers from event payloads. The default
  // already strips passwords, but tokens routinely sneak in via cookies.
  sendDefaultPii: false,
  // Avoid double-reporting "expected" failures like 401/404 — those are
  // user errors, not bugs. Server Actions still log them through the
  // existing `audit()` channel.
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
});
