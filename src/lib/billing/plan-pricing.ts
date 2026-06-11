/**
 * Single source of truth for subscription PRICING.
 *
 * Capabilities (caps + feature gates) live in `plan-capabilities.ts`; this
 * module owns only the money. Every surface that prints a price must read it
 * from here so a tariff change propagates in one edit:
 *   - Public landing pricing cards (`_landing/sections/pricing.tsx`)
 *   - Cabinet settings subscription card (`settings/subscription-card.tsx`)
 *   - Super-admin plan picker (`super-admin/_components/plan-picker.tsx`)
 *
 * Kept free of `@prisma/client` imports on purpose: the landing pricing card
 * is a client component, and pulling the Prisma runtime into that bundle is
 * both unnecessary and wasteful. `PlanKey` mirrors the `SubscriptionPlan`
 * enum string values (Prisma 7 generates it as a string union), so a
 * `SubscriptionPlan` value indexes `PLAN_PRICING` without a cast.
 */

export type PlanKey = "STARTER" | "PRO" | "CABINET_PLUS";

export interface PlanPrice {
  /// Amount in MAD. `0` means free (the Starter tier).
  amount: number;
  /// Billing period the amount is charged over.
  period: "month" | "year";
}

export const PLAN_PRICING: Record<PlanKey, PlanPrice> = {
  STARTER: { amount: 0, period: "month" },
  PRO: { amount: 300, period: "month" },
  CABINET_PLUS: { amount: 3600, period: "year" },
};

/**
 * French-formatted price parts for a plan — used by the FR-only settings and
 * super-admin surfaces, and as the amount source for the localised landing
 * cards (which keep their own translated suffix).
 *
 *   STARTER       → { amount: "0",    suffix: "/ mois" }
 *   PRO           → { amount: "300",  suffix: "MAD / mois" }
 *   CABINET_PLUS  → { amount: "3600", suffix: "MAD / an" }
 */
export function planPricePartsFr(plan: PlanKey): { amount: string; suffix: string } {
  const { amount, period } = PLAN_PRICING[plan];
  const per = period === "month" ? "mois" : "an";
  if (amount === 0) return { amount: "0", suffix: `/ ${per}` };
  return { amount: String(amount), suffix: `MAD / ${per}` };
}

/**
 * Monthly-normalised MAD figure for MRR / revenue maths — annual plans
 * are divided by 12 so a yearly Cabinet+ contributes its monthly share.
 * Used by the super-admin BI + subscriptions revenue aggregates so they
 * never drift from the published prices.
 */
export function planMonthlyMad(plan: PlanKey): number {
  const { amount, period } = PLAN_PRICING[plan];
  return period === "year" ? amount / 12 : amount;
}
