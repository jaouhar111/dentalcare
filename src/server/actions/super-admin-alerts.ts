"use server";

import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { computePlatformAlerts } from "@/lib/platform/alerts";
import { ok, type Result } from "@/lib/utils/result";
import type { PlatformAlert } from "./super-admin-alerts-types";

/**
 * Active platform alerts for the super-admin dashboard (roadmap P1-6 + P1-8).
 * The derivation lives in `@/lib/platform/alerts` so the dashboard panel and
 * the daily email digest share one source of truth.
 */
export async function getPlatformAlerts(): Promise<Result<PlatformAlert[]>> {
  await requireRole([UserRole.SUPER_ADMIN]);
  return ok(await computePlatformAlerts());
}
