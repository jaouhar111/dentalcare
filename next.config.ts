import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // typedRoutes disabled: the Next.js 16 typed-routes generator corrupts the
  // emitted `.next/.../link.d.ts` when the project path contains accents or
  // spaces (we are at "C:\…\gestion médecin dentaire"). Re-enable after the
  // upstream bug is fixed or once the folder is renamed.

  // Hide the Next.js dev indicator (the "compiling / rendering" badge at the
  // bottom of the screen in dev). It overlaps our own loading spinner and
  // confuses the dentist when they see "rendering…" between clicks.
  devIndicators: false,
};

// Sentry config — wraps the build to upload source maps + tree-shake the SDK.
// Only activates when SENTRY_AUTH_TOKEN is present (CI/Vercel); local dev
// builds skip the upload step automatically.
const sentryEnabled = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN,
);

export default withNextIntl(
  withSentryConfig(nextConfig, {
    // Org + project — required for source-map upload. Read from env at build time.
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    // Skip upload entirely when not properly configured (keeps dev `pnpm build`
    // working without Sentry env vars).
    sourcemaps: { disable: !sentryEnabled },
    // Tunnel ad-blocked Sentry events through a Next.js route — avoids the
    // ~10% of users with uBlock Origin from losing all error reports.
    tunnelRoute: "/monitoring",
    // `disableLogger` + `automaticVercelMonitors` moved under `webpack.*`
    // as required by @sentry/nextjs v10. They no-op with Turbopack (which
    // strips debug logs by default), so dev builds aren't affected.
    webpack: {
      treeshake: { removeDebugLogging: true },
      automaticVercelMonitors: false,
    },
  }),
);
