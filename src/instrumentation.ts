/**
 * Next.js instrumentation entry point.
 *
 * Loads the right Sentry config for whichever runtime is booting (Node for
 * Server Components / Route Handlers, Edge for proxy/middleware). Called
 * once per worker on boot.
 *
 * Doc: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Wire React Server Component errors into Sentry. Without this they only
 * surface in the server console.
 */
export const onRequestError = Sentry.captureRequestError;
