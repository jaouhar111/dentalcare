"use server";

import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";

/**
 * Per-plan monthly MAD revenue mapping. Mirrors the landing page
 * pricing cards — keep in sync with `plan-picker.tsx`.
 */
const PLAN_MAD: Record<SubscriptionPlan, number> = {
  STARTER: 0,
  PRO: 499,
  CABINET_PLUS: 999,
};

export interface SubscriptionRow {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  monthlyAmount: number;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  createdAt: Date;
}

export interface SubscriptionsOverview {
  rows: SubscriptionRow[];
  totals: {
    clinics: number;
    trialing: number;
    active: number;
    pastDue: number;
    cancelled: number;
    /// Sum of monthlyAmount across ACTIVE clinics — current MRR.
    mrrActive: number;
    /// Projected MRR if every TRIAL converts on their current plan.
    mrrProjectedIfTrialsConvert: number;
    /// Trial → active conversion rate over the lifetime of the platform.
    /// `null` when there's nothing to compute against (no resolved trials).
    conversionRate: number | null;
  };
  perPlan: Record<
    SubscriptionPlan,
    { clinics: number; mrr: number }
  >;
}

/**
 * Aggregates everything the /super-admin/subscriptions page needs in
 * one DB round-trip per metric:
 *   - one row per clinic with plan, status, days-left
 *   - sums grouped by status + plan for the KPI strip
 *
 * Computed-in-memory, not at the DB level, because the row set is
 * small (one row per cabinet) and Prisma's `groupBy` with multiple
 * dimensions doesn't compose well with the MRR aggregate we need.
 */
export async function getSubscriptionsOverview(): Promise<
  Result<SubscriptionsOverview>
> {
  await requireRole([UserRole.SUPER_ADMIN]);
  const now = new Date();

  const clinics = await db.clinic.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      subscriptionStatus: true,
      plan: true,
      trialEndsAt: true,
      createdAt: true,
    },
  });

  const rows: SubscriptionRow[] = clinics.map((c) => {
    const monthlyAmount = PLAN_MAD[c.plan];
    const trialDaysRemaining =
      c.subscriptionStatus === SubscriptionStatus.TRIAL && c.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((c.trialEndsAt.getTime() - now.getTime()) / 86_400_000),
          )
        : null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug ?? "—",
      email: c.email,
      status: c.subscriptionStatus,
      plan: c.plan,
      monthlyAmount,
      trialEndsAt: c.trialEndsAt,
      trialDaysRemaining,
      createdAt: c.createdAt,
    };
  });

  const totals = {
    clinics: rows.length,
    trialing: 0,
    active: 0,
    pastDue: 0,
    cancelled: 0,
    mrrActive: 0,
    mrrProjectedIfTrialsConvert: 0,
    conversionRate: null as number | null,
  };
  const perPlan: Record<
    SubscriptionPlan,
    { clinics: number; mrr: number }
  > = {
    STARTER: { clinics: 0, mrr: 0 },
    PRO: { clinics: 0, mrr: 0 },
    CABINET_PLUS: { clinics: 0, mrr: 0 },
  };

  for (const r of rows) {
    perPlan[r.plan].clinics += 1;
    if (r.status === SubscriptionStatus.ACTIVE) {
      totals.active += 1;
      totals.mrrActive += r.monthlyAmount;
      perPlan[r.plan].mrr += r.monthlyAmount;
    } else if (r.status === SubscriptionStatus.TRIAL) {
      totals.trialing += 1;
      totals.mrrProjectedIfTrialsConvert += r.monthlyAmount;
    } else if (r.status === SubscriptionStatus.PAST_DUE) {
      totals.pastDue += 1;
      totals.mrrActive += r.monthlyAmount; // still counted — billing in retry
    } else {
      totals.cancelled += 1;
    }
  }

  // Conversion: among "decided" cabinets (anyone that left TRIAL
  // either to ACTIVE or to CANCELLED), what share went to ACTIVE?
  const decided = totals.active + totals.pastDue + totals.cancelled;
  totals.conversionRate =
    decided > 0
      ? (totals.active + totals.pastDue) / (decided)
      : null;

  return ok({ rows, totals, perPlan });
}
