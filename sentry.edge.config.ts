/**
 * Sentry init for Edge runtime (proxy.ts, edge route handlers).
 *
 * Edge has a tighter API surface than Node — no fs, no native modules — so
 * the SDK config is intentionally minimal.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
});
