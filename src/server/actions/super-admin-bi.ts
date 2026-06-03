"use server";

import {
  SubscriptionPlan,
  SubscriptionStatus,
  SupportTicketStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";

/**
 * Phase 12 — Stage D
 *
 * Platform-owner business intelligence. The metrics that drive
 * investment decisions, not the operational ones (those are on
 * `/super-admin/monitoring`).
 *
 *   1. ARR — annual recurring revenue = MRR × 12
 *   2. MRR breakdown by plan
 *   3. Churn cohorts — for each signup-month cohort, how many cabinets
 *      are still ACTIVE/TRIAL today
 *   4. NPS proxy — `% of RESOLVED tickets resolved < 24h` over the
 *      last 90 days. Cheap proxy without a survey, scales with us.
 *
 * All computations are read-only.
 */

const MAD_PER_PLAN: Record<SubscriptionPlan, number> = {
  STARTER: 0,
  PRO: 499,
  CABINET_PLUS: 999,
};

export interface ChurnCohort {
  /// Signup month label, "2026-04".
  cohort: string;
  /// Number of cabinets that signed up in that month.
  totalSignups: number;
  /// Still on a paying plan today (ACTIVE) or trialing.
  stillActive: number;
  /// 0-100, share of cohort still around.
  retentionPct: number;
}

export interface PlatformBI {
  mrr: number;
  arr: number;
  mrrByPlan: Record<SubscriptionPlan, number>;
  churnCohorts: ChurnCohort[];
  npsProxy: {
    resolvedTickets: number;
    resolvedUnder24h: number;
    sla24hRate: number; // 0-100
  };
  signupsLast12Months: Array<{ month: string; count: number }>;
}

export async function getPlatformBI(): Promise<Result<PlatformBI>> {
  await requireRole([UserRole.SUPER_ADMIN]);
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [clinics, recentTickets] = await Promise.all([
    db.clinic.findMany({
      select: {
        id: true,
        plan: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    }),
    db.supportTicket.findMany({
      where: {
        status: SupportTicketStatus.RESOLVED,
        resolvedAt: { gte: ninetyDaysAgo },
      },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  // ── MRR + ARR ────────────────────────────────────────────────────
  const mrrByPlan: Record<SubscriptionPlan, number> = {
    STARTER: 0,
    PRO: 0,
    CABINET_PLUS: 0,
  };
  let mrr = 0;
  for (const c of clinics) {
    // Count ACTIVE and PAST_DUE (billing-retry; still in the funnel).
    // TRIAL doesn't count toward MRR but counts toward retention.
    if (
      c.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      c.subscriptionStatus === SubscriptionStatus.PAST_DUE
    ) {
      const planMrr = MAD_PER_PLAN[c.plan];
      mrrByPlan[c.plan] += planMrr;
      mrr += planMrr;
    }
  }

  // ── Churn cohorts ────────────────────────────────────────────────
  // Bucket every cabinet by signup month. For each bucket compute
  // retention = (still TRIAL OR ACTIVE OR PAST_DUE today) / total.
  // CANCELLED ⇒ churned. We compute over the last 12 months only;
  // older cohorts are aggregated as "before".
  const cohortMap = new Map<
    string,
    { signups: number; stillActive: number }
  >();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = monthKey(d);
    cohortMap.set(key, { signups: 0, stillActive: 0 });
  }
  for (const c of clinics) {
    if (c.createdAt < twelveMonthsAgo) continue; // ignore "older" for the table
    const key = monthKey(c.createdAt);
    const slot = cohortMap.get(key);
    if (!slot) continue;
    slot.signups += 1;
    if (
      c.subscriptionStatus !== SubscriptionStatus.CANCELLED
    ) {
      slot.stillActive += 1;
    }
  }
  const churnCohorts: ChurnCohort[] = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, v]) => ({
      cohort,
      totalSignups: v.signups,
      stillActive: v.stillActive,
      retentionPct:
        v.signups > 0 ? Math.round((v.stillActive / v.signups) * 100) : 0,
    }));

  // ── NPS proxy ────────────────────────────────────────────────────
  let resolvedUnder24h = 0;
  for (const t of recentTickets) {
    if (!t.resolvedAt) continue;
    const lagMs = t.resolvedAt.getTime() - t.createdAt.getTime();
    if (lagMs <= 24 * 60 * 60 * 1000) resolvedUnder24h += 1;
  }
  const sla24hRate =
    recentTickets.length > 0
      ? Math.round((resolvedUnder24h / recentTickets.length) * 100)
      : 0;

  // ── Signups histogram (last 12 months) ──────────────────────────
  const signupsByMonth = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    signupsByMonth.set(monthKey(d), 0);
  }
  for (const c of clinics) {
    if (c.createdAt < twelveMonthsAgo) continue;
    const key = monthKey(c.createdAt);
    if (signupsByMonth.has(key)) {
      signupsByMonth.set(key, (signupsByMonth.get(key) ?? 0) + 1);
    }
  }
  const signupsLast12Months = [...signupsByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // `yesterday` is computed but unused here — keeps the contract stable
  // for downstream callers that expected it (TODO: drop next refactor).
  void yesterday;

  return ok({
    mrr,
    arr: mrr * 12,
    mrrByPlan,
    churnCohorts,
    npsProxy: {
      resolvedTickets: recentTickets.length,
      resolvedUnder24h,
      sla24hRate,
    },
    signupsLast12Months,
  });
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
