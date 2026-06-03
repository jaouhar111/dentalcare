"use server";

import {
  AppointmentSource,
  AppointmentStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";

/**
 * Phase 12 — Stage A
 *
 * Cabinet BI snapshot — the four numbers that prove the AI Receptionist
 * is worth its monthly subscription :
 *
 *   1. RDV créés par l'IA (count + share of total) — booking volume
 *   2. Revenus générés par l'IA (sum of payments for AI-sourced RDV)
 *   3. Temps économisé (msg IA × 90s ÷ 60 = hours saved)
 *   4. Patients récupérés hors horaires (RDV created 22h-8h)
 *
 * Plus secondary signals : top 5 questions (Stage B) and the
 * 24×7 heatmap (Stage C), which are surfaced in the same payload to
 * keep the page render a single round-trip.
 *
 * Window defaults to "this month" (1st of current month → now).
 * Caller can pass a custom range for the period selector.
 */

const ANY_STAFF = [
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.RECEPTIONIST,
] as const;

const AVG_MS_SAVED_PER_AI_TURN = 90_000; // 90 s ≈ time secretary would spend
const OFF_HOURS_START = 22; // 22:00 local
const OFF_HOURS_END = 8; // 08:00 local

export interface InsightsPeriod {
  label: string;
  from: Date;
  to: Date;
}

export interface CabinetInsights {
  period: InsightsPeriod;
  totals: {
    appointmentsCreated: number;
    appointmentsCreatedByAI: number;
    aiBookingShareRate: number; // 0-100
    revenueFromAI: number; // MAD
    aiTurnsCount: number;
    timeSavedHours: number; // rounded to 1 decimal
    offHoursAppointments: number;
    offHoursShareRate: number; // 0-100
  };
  /// Day-of-week × hour-of-day heatmap of inbound patient messages.
  /// `grid[dayOfWeek][hour]` = count. dayOfWeek 0=Sun..6=Sat.
  heatmap: number[][];
  /// Top 5 user messages, grouped by their first-three-words signature.
  /// Sorted by count desc.
  topQuestions: Array<{ signature: string; example: string; count: number }>;
  /// Total counts for the period — handy for the page header.
  totalConversations: number;
}

/** Builds the period for "this month". Caller can override. */
function thisMonthPeriod(): InsightsPeriod {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return {
    label: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    from,
    to: now,
  };
}

/**
 * Returns the full BI bundle for the caller's clinic over `period`
 * (defaults to current month). Read-only. Auth-gated for the UI page.
 */
export async function getCabinetInsights(args?: {
  from?: Date;
  to?: Date;
}): Promise<Result<CabinetInsights>> {
  const me = await requireRole([...ANY_STAFF]);
  const period: InsightsPeriod = args?.from
    ? {
        label:
          args.from.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          }) +
          " → " +
          (args.to ?? new Date()).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          }),
        from: args.from,
        to: args.to ?? new Date(),
      }
    : thisMonthPeriod();

  return ok(await computeCabinetInsightsInternal(me.clinicId, period));
}

/**
 * Auth-less variant — for the monthly-report Inngest cron which runs as
 * a system task. Takes `clinicId` explicitly. UI callers MUST go
 * through `getCabinetInsights` so the role gate runs.
 */
export async function computeInsightsForReport(
  clinicId: string,
  from: Date,
  to: Date,
  label: string,
): Promise<CabinetInsights> {
  return computeCabinetInsightsInternal(clinicId, { from, to, label });
}

async function computeCabinetInsightsInternal(
  clinicId: string,
  period: InsightsPeriod,
): Promise<CabinetInsights> {

  // ── Parallel fetch — independent queries for each metric ───────────
  const [
    apptsTotal,
    apptsByAI,
    aiRevenueRows,
    aiTurnsCount,
    offHoursRows,
    conversationRows,
    turnPayloadRows,
  ] = await Promise.all([
    // 1. Total RDV created in period
    db.appointment.count({
      where: {
        clinicId,
        createdAt: { gte: period.from, lte: period.to },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    // 2. RDV created by the AI (source = AI_WHATSAPP)
    db.appointment.count({
      where: {
        clinicId,
        createdAt: { gte: period.from, lte: period.to },
        source: AppointmentSource.AI_WHATSAPP,
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    // 3. Payments linked to AI-sourced appointments (sum amount)
    db.payment.findMany({
      where: {
        clinicId,
        receivedAt: { gte: period.from, lte: period.to },
        invoice: {
          patient: {
            appointments: {
              some: {
                source: AppointmentSource.AI_WHATSAPP,
                clinicId,
              },
            },
          },
        },
      },
      select: { amount: true },
    }),
    // 4. Total AI turns — used to compute time saved
    db.auditLog.count({
      where: {
        clinicId,
        action: "ai.conversation.turn",
        createdAt: { gte: period.from, lte: period.to },
      },
    }),
    // 5. Off-hours appointments — created during 22h-8h Casablanca local
    db.appointment.findMany({
      where: {
        clinicId,
        createdAt: { gte: period.from, lte: period.to },
        source: AppointmentSource.AI_WHATSAPP,
      },
      select: { createdAt: true },
    }),
    // 6. AI conversation lastActivityAt — for heatmap
    db.aIConversation.findMany({
      where: {
        clinicId,
        lastActivityAt: { gte: period.from, lte: period.to },
      },
      select: { lastActivityAt: true },
    }),
    // 7. Recent turns with payload — for top-questions clustering
    //    Capped at 500 so a chatty cabinet doesn't bloat the query.
    db.auditLog.findMany({
      where: {
        clinicId,
        action: "ai.conversation.turn",
        createdAt: { gte: period.from, lte: period.to },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { payloadJson: true },
    }),
  ]);

  // ── Money — Decimal | number | bigint → Number ─────────────────────
  const revenueFromAI = aiRevenueRows.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  // ── Off-hours filter (Casablanca local = UTC+1 year-round) ─────────
  const offHoursCount = offHoursRows.filter((a) => {
    // a.createdAt is UTC. Casablanca = UTC+1, so local hour = (UTC + 1) mod 24.
    const localHour = (a.createdAt.getUTCHours() + 1) % 24;
    return localHour >= OFF_HOURS_START || localHour < OFF_HOURS_END;
  }).length;

  // ── Heatmap — 7 days × 24 hours of inbound message activity ─────────
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );
  for (const c of conversationRows) {
    const local = new Date(c.lastActivityAt.getTime() + 60 * 60 * 1000); // +1h
    const dow = local.getUTCDay();
    const hour = local.getUTCHours();
    if (heatmap[dow]) heatmap[dow][hour] = (heatmap[dow][hour] ?? 0) + 1;
  }

  // ── Top questions clustering ───────────────────────────────────────
  // V1 : take first 3 normalised words. Good enough to bucket
  // "vous etes ouvert", "vous etes ouverts mardi", "vous etes ouverts demain"
  // together (signature = "vous etes ouvert"). Sophisticated NLP grouping
  // can ship in Phase 12.1 if needed.
  const sigCounts = new Map<
    string,
    { signature: string; example: string; count: number }
  >();
  for (const row of turnPayloadRows) {
    const p = row.payloadJson as { userMessage?: string } | null;
    const msg = (p?.userMessage ?? "").trim();
    if (msg.length < 3) continue;
    const normalised = msg
      .toLowerCase()
      // Strip leading audio marker emoji.
      .replace(/^🎙️\s*/u, "")
      // Collapse accents to ASCII for stable bucketing.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[?!.,'"`]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (normalised.length === 0) continue;
    const signature = normalised.slice(0, 3).join(" ");
    const existing = sigCounts.get(signature);
    if (existing) {
      existing.count += 1;
    } else {
      sigCounts.set(signature, { signature, example: msg, count: 1 });
    }
  }
  const topQuestions = [...sigCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const aiBookingShareRate =
    apptsTotal > 0 ? Math.round((apptsByAI / apptsTotal) * 100) : 0;
  const offHoursShareRate =
    apptsByAI > 0 ? Math.round((offHoursCount / apptsByAI) * 100) : 0;

  return {
    period,
    totals: {
      appointmentsCreated: apptsTotal,
      appointmentsCreatedByAI: apptsByAI,
      aiBookingShareRate,
      revenueFromAI: Math.round(revenueFromAI),
      aiTurnsCount,
      timeSavedHours:
        Math.round((aiTurnsCount * AVG_MS_SAVED_PER_AI_TURN) / 3_600_000 * 10) /
        10,
      offHoursAppointments: offHoursCount,
      offHoursShareRate,
    },
    heatmap,
    topQuestions,
    totalConversations: conversationRows.length,
  };
}
