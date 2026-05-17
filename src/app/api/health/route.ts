import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { isCloudinaryConfigured } from "@/lib/cloudinary/client";
import { isEmailConfigured } from "@/lib/email/client";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public health check for uptime monitors (UptimeRobot, BetterStack, etc.).
 *
 *   200 → healthy   — DB roundtrip succeeded; service dependencies inspected.
 *   503 → degraded  — DB ping failed; the rest of the response details which
 *                     subsystem is unavailable so on-call can triage.
 *
 * No auth: the endpoint exposes only boolean configuration flags + a build
 * sha; no patient or session data is reachable from here.
 */
export async function GET() {
  const checks = {
    db: false as boolean,
    email: isEmailConfigured(),
    cloudinary: isCloudinaryConfigured(),
    sentry: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
    redis: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  };

  try {
    // Cheap roundtrip — picks up DB pool exhaustion, connection refusal,
    // and credentials rotation issues without scanning real tables.
    await db.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    checks.db = false;
  }

  const ok = checks.db; // DB is the only hard requirement
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      region: process.env.VERCEL_REGION ?? "local",
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
