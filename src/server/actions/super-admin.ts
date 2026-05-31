"use server";

import { revalidatePath } from "next/cache";
import { SubscriptionPlan, SubscriptionStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import type {
  PlatformActivityEntry,
  PlatformOverview,
  PlatformClinic,
  PlatformSignupSpark,
} from "./super-admin-types";

/**
 * Aggregates the metrics shown on the /super-admin dashboard:
 *  - One row per clinic with subscription status + days remaining
 *  - Counts of patients, future appointments, recent AI conversations
 *  - Totals for the KPI strip at the top
 *
 * One round-trip per metric (patients / appointments / conversations)
 * with a `groupBy clinicId` so we stay at O(1) queries regardless of
 * how many cabinets are on the platform.
 */
export async function getPlatformOverview(): Promise<Result<PlatformOverview>> {
  await requireRole([UserRole.SUPER_ADMIN]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    clinics,
    patients,
    future,
    ai,
    recentAppts,
    recentTurns,
    recentSubs,
    signups30,
    appts7,
    ai7,
    appts30Rows,
    turns30Rows,
  ] = await Promise.all([
    db.clinic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.patient.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ["clinicId"],
      where: {
        startAt: { gt: now },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      _count: { _all: true },
    }),
    db.aIConversation.groupBy({
      by: ["clinicId"],
      where: { lastActivityAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    // Recent activity buckets — capped at a handful of rows per type so
    // the timeline stays focused.
    db.appointment.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        clinicId: true,
        source: true,
        clinic: { select: { name: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
    db.auditLog.findMany({
      where: {
        action: "ai.conversation.turn",
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, clinicId: true },
    }),
    db.auditLog.findMany({
      where: {
        action: { in: ["clinic.signup", "superadmin.subscription.set"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        createdAt: true,
        clinicId: true,
        action: true,
        payloadJson: true,
      },
    }),
    // Signups per day for the 30-day sparkline.
    db.clinic.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.appointment.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    db.aIConversation.count({
      where: { lastActivityAt: { gte: sevenDaysAgo } },
    }),
    // 30-day daily-count series for the dashboard charts. We pull just
    // the createdAt column and bucket in JS — keeps the queries cheap
    // even at 50k+ rows (Postgres can hand back the column at a few
    // ms / 1k rows, indexing on createdAt).
    db.appointment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.auditLog.findMany({
      where: {
        action: "ai.conversation.turn",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    }),
  ]);

  const patientsByClinic = new Map(patients.map((p) => [p.clinicId, p._count._all]));
  const futureByClinic = new Map(future.map((f) => [f.clinicId, f._count._all]));
  const aiByClinic = new Map(ai.map((a) => [a.clinicId, a._count._all]));

  const rows: PlatformClinic[] = clinics.map((c) => {
    const daysRemaining =
      c.trialEndsAt && c.subscriptionStatus === SubscriptionStatus.TRIAL
        ? Math.max(0, Math.ceil((c.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
        : null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug ?? "—",
      email: c.email ?? "—",
      phone: c.phone ?? "—",
      subscriptionStatus: c.subscriptionStatus,
      trialDaysRemaining: daysRemaining,
      patients: patientsByClinic.get(c.id) ?? 0,
      futureAppointments: futureByClinic.get(c.id) ?? 0,
      aiConversations7d: aiByClinic.get(c.id) ?? 0,
      createdAt: c.createdAt,
    };
  });

  // Build the recent-activity timeline from the per-type buckets.
  const clinicNameById = new Map(clinics.map((c) => [c.id, c.name]));
  const activity: PlatformActivityEntry[] = [];
  for (const a of recentAppts) {
    activity.push({
      id: `appt-${a.id}`,
      type: "appointment.created",
      clinicId: a.clinicId,
      clinicName: a.clinic.name,
      summary: `${a.patient.firstName} ${a.patient.lastName} — ${a.source === "AI_WHATSAPP" ? "RDV via IA" : "RDV créé"}`,
      at: a.createdAt,
    });
  }
  for (const t of recentTurns) {
    activity.push({
      id: `turn-${t.id}`,
      type: "ai.conversation.turn",
      clinicId: t.clinicId,
      clinicName: clinicNameById.get(t.clinicId) ?? "—",
      summary: "Tour de conversation IA WhatsApp",
      at: t.createdAt,
    });
  }
  for (const s of recentSubs) {
    if (s.action === "clinic.signup") {
      const payload = (s.payloadJson ?? {}) as { name?: string };
      activity.push({
        id: `signup-${s.id}`,
        type: "clinic.signup",
        clinicId: s.clinicId,
        clinicName: clinicNameById.get(s.clinicId) ?? payload.name ?? "—",
        summary: `Nouveau cabinet « ${payload.name ?? clinicNameById.get(s.clinicId) ?? "—"} »`,
        at: s.createdAt,
      });
    } else {
      const payload = (s.payloadJson ?? {}) as { from?: string; to?: string };
      activity.push({
        id: `sub-${s.id}`,
        type: "subscription.changed",
        clinicId: s.clinicId,
        clinicName: clinicNameById.get(s.clinicId) ?? "—",
        summary: `Abonnement : ${payload.from ?? "?"} → ${payload.to ?? "?"}`,
        at: s.createdAt,
      });
    }
  }
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());

  // 30-day daily buckets — one slot per day (even when zero) so the
  // sparkline draws a full month-wide x-axis. Shared helper so the
  // three series (signups, RDV, AI turns) all align on the same dates.
  function bucketize(rows: { createdAt: Date }[]): PlatformSignupSpark[] {
    const map = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 86_400_000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, 0);
    }
    for (const r of rows) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}-${String(r.createdAt.getDate()).padStart(2, "0")}`;
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }
  const signups30d = bucketize(signups30);
  const appointmentsCreated30d = bucketize(appts30Rows);
  const aiTurns30d = bucketize(turns30Rows);

  return ok({
    clinics: rows,
    totals: {
      clinicsTotal: rows.length,
      trialing: rows.filter((c) => c.subscriptionStatus === SubscriptionStatus.TRIAL).length,
      active: rows.filter((c) => c.subscriptionStatus === SubscriptionStatus.ACTIVE).length,
      pastDue: rows.filter((c) => c.subscriptionStatus === SubscriptionStatus.PAST_DUE).length,
      cancelled: rows.filter((c) => c.subscriptionStatus === SubscriptionStatus.CANCELLED).length,
      patientsTotal: rows.reduce((s, c) => s + c.patients, 0),
      futureAppointmentsTotal: rows.reduce((s, c) => s + c.futureAppointments, 0),
      appointmentsLast7d: appts7,
      aiConversationsLast7d: ai7,
    },
    recentActivity: activity.slice(0, 12),
    signups30d,
    appointmentsCreated30d,
    aiTurns30d,
  });
}

/**
 * Bumps a clinic's subscription status. Used by the dashboard quick-
 * actions ("Activate", "Extend trial", "Mark past-due"). Audit-logged.
 */
export async function setClinicSubscription(args: {
  clinicId: string;
  status: SubscriptionStatus;
  /// When set on a TRIAL, extend the trial by N days from now.
  extendDays?: number;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: args.clinicId },
    select: { id: true, name: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable");

  const trialEndsAt =
    args.status === SubscriptionStatus.TRIAL && args.extendDays
      ? new Date(Date.now() + args.extendDays * 86_400_000)
      : args.status === SubscriptionStatus.ACTIVE
        ? null
        : clinic.trialEndsAt;

  await db.clinic.update({
    where: { id: clinic.id },
    data: { subscriptionStatus: args.status, trialEndsAt },
  });

  await audit({
    clinicId: clinic.id,
    userId: user.id,
    action: "superadmin.subscription.set",
    entity: "Clinic",
    entityId: clinic.id,
    payload: {
      from: clinic.subscriptionStatus,
      to: args.status,
      extendDays: args.extendDays ?? null,
    },
  });

  revalidatePath("/super-admin");
  return ok({ id: clinic.id });
}

/**
 * Switch a cabinet's plan tier (Starter / Pro / Cabinet+). The plan is
 * orthogonal to status — a TRIAL can be on PRO, an ACTIVE on STARTER,
 * etc. The dashboard's paywall keys off `subscriptionStatus`, not
 * `plan`; the plan only controls which features are exposed and which
 * monthly amount Stripe charges once wired.
 */
export async function setClinicPlan(args: {
  clinicId: string;
  plan: SubscriptionPlan;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([UserRole.SUPER_ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: args.clinicId },
    select: { id: true, plan: true },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable");
  if (clinic.plan === args.plan) {
    return ok({ id: clinic.id });
  }

  await db.clinic.update({
    where: { id: clinic.id },
    data: { plan: args.plan },
  });

  await audit({
    clinicId: clinic.id,
    userId: user.id,
    action: "superadmin.plan.set",
    entity: "Clinic",
    entityId: clinic.id,
    payload: { from: clinic.plan, to: args.plan },
  });

  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/clinics/${clinic.id}`);
  return ok({ id: clinic.id });
}
