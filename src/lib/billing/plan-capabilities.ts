/**
 * Single source of truth for what each subscription plan can do.
 *
 * Used by:
 *   - Server actions that create new dentists/users/patients (entity caps)
 *   - The AI Receptionist settings page (feature gate)
 *   - The AI webhook handler (voice-note gate)
 *   - The recalls + payment-plan cron jobs (skip STARTER clinics)
 *
 * Design choices:
 *   - Limits are stored as `number`, with `Infinity` for "unlimited".
 *     Easier than juggling `null | number` everywhere.
 *   - The lookup table is per-plan rather than per-feature so adding a
 *     new tier is one row, not a sweep across N feature blocks.
 *   - Feature gates and entity caps share the same module so a future
 *     `getPlanCapabilities(plan)` snapshot has both in one read.
 */

import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export interface PlanLimits {
  /// Max number of Dentist rows for the cabinet.
  dentists: number;
  /// Max number of User rows (employees that log in).
  users: number;
  /// Max number of Patient rows.
  patients: number;
}

export interface PlanFeatures {
  /// AI Receptionist (the WhatsApp bot). When false, the AIReceptionist
  /// settings page locks the toggle and the webhook handler silently
  /// drops inbound patient messages (or replies with a transfer text).
  aiReceptionist: boolean;
  /// Voice-note round-trip (transcribe + TTS reply). When false, the
  /// handler still transcribes inbound audio so the AI can read it,
  /// but the reply is always text.
  voiceNotes: boolean;
  /// Automatic recalls (scaling + checkups). When false, the recalls
  /// cron skips this cabinet.
  recalls: boolean;
  /// Patient payment plans + relances. When false, the create-plan UI
  /// is hidden and the cron skips this cabinet's installments.
  paymentPlans: boolean;
}

export interface PlanCapabilities extends PlanLimits, PlanFeatures {}

const STARTER: PlanCapabilities = {
  dentists: 1,
  users: 1,
  patients: 100,
  aiReceptionist: false,
  voiceNotes: false,
  recalls: false,
  paymentPlans: false,
};

const PRO: PlanCapabilities = {
  dentists: 3,
  users: 5,
  patients: Infinity,
  aiReceptionist: true,
  voiceNotes: false,
  recalls: true,
  paymentPlans: true,
};

const CABINET_PLUS: PlanCapabilities = {
  dentists: Infinity,
  users: Infinity,
  patients: Infinity,
  aiReceptionist: true,
  voiceNotes: true,
  recalls: true,
  paymentPlans: true,
};

const LOOKUP: Record<SubscriptionPlan, PlanCapabilities> = {
  STARTER,
  PRO,
  CABINET_PLUS,
};

/**
 * Return the capabilities the clinic is currently allowed to use.
 *
 * The lookup respects the lifecycle:
 *   - `subscriptionStatus = TRIAL`  → full capabilities of `plan` (the
 *     point of a trial is to taste the product). Default `plan = PRO`
 *     means a fresh signup gets Pro features for 14 days.
 *   - `subscriptionStatus = ACTIVE` → full capabilities of `plan`.
 *   - `subscriptionStatus = PAST_DUE` → still allowed, with a UI nag.
 *     We don't lock revenue-generating features on a missed payment;
 *     the trial-expiring / dunning emails carry that.
 *   - `subscriptionStatus = CANCELLED` → demote to STARTER so the
 *     cabinet still has read-only access to its data but loses premium
 *     write capabilities. The right product behaviour for churn-with-
 *     grace. (Trial expiration without payment runs through a separate
 *     dunning state machine that ends up setting CANCELLED.)
 */
/**
 * Per-cabinet feature overrides (P2-10). `null`/`undefined` for a key =
 * use the plan default; a boolean forces that feature on/off regardless
 * of plan. Only feature flags can be overridden — entity caps stay
 * plan-bound.
 */
export interface FeatureOverrides {
  aiReceptionist?: boolean | null;
  voiceNotes?: boolean | null;
  recalls?: boolean | null;
  paymentPlans?: boolean | null;
}

export function capabilitiesFor(args: {
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  featureOverrides?: FeatureOverrides | null;
}): PlanCapabilities {
  const base =
    args.subscriptionStatus === SubscriptionStatus.CANCELLED
      ? STARTER
      : LOOKUP[args.plan];
  const ov = args.featureOverrides;
  if (!ov) return base;
  return {
    ...base,
    aiReceptionist: ov.aiReceptionist ?? base.aiReceptionist,
    voiceNotes: ov.voiceNotes ?? base.voiceNotes,
    recalls: ov.recalls ?? base.recalls,
    paymentPlans: ov.paymentPlans ?? base.paymentPlans,
  };
}

/**
 * Build {@link FeatureOverrides} from a clinic row's `feature*` columns.
 * Pass the result to `capabilitiesFor({ ..., featureOverrides })` at every
 * feature gate so per-cabinet overrides take effect consistently.
 */
export function featureOverridesOf(c: {
  featureAiReceptionist?: boolean | null;
  featureVoiceNotes?: boolean | null;
  featureRecalls?: boolean | null;
  featurePaymentPlans?: boolean | null;
}): FeatureOverrides {
  return {
    aiReceptionist: c.featureAiReceptionist ?? null,
    voiceNotes: c.featureVoiceNotes ?? null,
    recalls: c.featureRecalls ?? null,
    paymentPlans: c.featurePaymentPlans ?? null,
  };
}

/**
 * Friendly label for the plan — used by the UI when surfacing a
 * "Upgrade to <X>" CTA without hardcoding strings everywhere.
 */
export function planLabel(plan: SubscriptionPlan): string {
  switch (plan) {
    case SubscriptionPlan.STARTER:
      return "Starter";
    case SubscriptionPlan.PRO:
      return "Pro";
    case SubscriptionPlan.CABINET_PLUS:
      return "Cabinet+";
  }
}

/**
 * Return the lowest plan that unlocks a given feature — used by the UI
 * to show "Disponible à partir de <plan>" when locking a control.
 */
export function minimumPlanFor(
  feature: keyof PlanFeatures,
): SubscriptionPlan {
  if (CABINET_PLUS[feature] && !PRO[feature]) return SubscriptionPlan.CABINET_PLUS;
  if (PRO[feature] && !STARTER[feature]) return SubscriptionPlan.PRO;
  return SubscriptionPlan.STARTER;
}
