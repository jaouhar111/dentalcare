"use server";

import { AIConversationStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";

/**
 * Daily aggregate of WhatsApp / AI activity for the 14-day sparkline.
 * Computed in-memory from a single `findMany` rather than per-day
 * `groupBy` (faster on small ranges, no SQL date_trunc gymnastics).
 */
export interface MonitoringPoint {
  /// YYYY-MM-DD UTC-anchored key — sortable, locale-safe.
  date: string;
  conversations: number;
  turns: number;
}

export interface MonitoringSnapshot {
  /// Aggregate counters at the moment of the snapshot.
  totals: {
    conversations24h: number;
    turns24h: number;
    handoverRate24h: number; // 0-100 — share of conversations that ended HANDED_OFF
    sendFailures24h: number;
    webhookErrors24h: number;
    activeClinics: number;
    /// Clinics with `whatsappPhoneId` set AND `aiEnabled = true`.
    aiEnabledClinics: number;
    /// Clinics that have explicitly disabled the AI receptionist.
    aiDisabledClinics: number;
  };
  /// Bot reply latency (ms) — p50 / p95 / p99. Null when no samples
  /// in the window (e.g. dev environment with no traffic).
  latency: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
    samples: number;
  };
  /// 14-day activity histogram for the sparkline.
  activity14d: MonitoringPoint[];
  /// Latest webhook / send failures — top 10 most recent.
  recentErrors: Array<{
    id: string;
    clinicId: string;
    clinicName: string;
    action: string;
    payload: unknown;
    at: Date;
  }>;
  generatedAt: Date;
}

/**
 * Loads the full monitoring snapshot for the super-admin's
 * `/super-admin/monitoring` page.
 *
 * Every query is independent and runs in parallel; the heaviest one
 * is the 14-day conversation list (~hundreds of rows on a healthy
 * platform). The audit-log query is the only one that could grow
 * unboundedly — it's capped at the last 24 h of error rows.
 */
export async function getMonitoringSnapshot(): Promise<
  Result<MonitoringSnapshot>
> {
  await requireRole([UserRole.SUPER_ADMIN]);
  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    conversations24h,
    convs14d,
    handedOff24h,
    sendFailures,
    webhookErrors,
    activeClinicsCount,
    aiEnabledClinics,
    aiDisabledClinics,
    latencySamples,
    recentErrors,
  ] = await Promise.all([
    db.aIConversation.count({
      where: { lastActivityAt: { gte: day1 } },
    }),
    db.aIConversation.findMany({
      where: { lastActivityAt: { gte: day14 } },
      select: {
        id: true,
        lastActivityAt: true,
        totalTurns: true,
      },
    }),
    db.aIConversation.count({
      where: {
        status: AIConversationStatus.HANDED_OFF,
        handedOffAt: { gte: day1 },
      },
    }),
    db.auditLog.count({
      where: {
        action: { in: ["ai.conversation.send_failed", "ai.conversation.failed"] },
        createdAt: { gte: day1 },
      },
    }),
    db.auditLog.count({
      where: {
        action: { in: ["whatsapp.webhook.invalid_signature"] },
        createdAt: { gte: day1 },
      },
    }),
    db.clinic.count({
      where: { subscriptionStatus: { in: ["TRIAL", "ACTIVE"] } },
    }),
    db.clinic.count({
      where: { aiEnabled: true, whatsappPhoneId: { not: null } },
    }),
    db.clinic.count({ where: { aiEnabled: false } }),
    // Latency samples — pull last 200 audit rows for AI conversation turns
    // that carry the latency in their payload (`payloadJson.ms`). Done as
    // a raw findMany because Prisma's groupBy doesn't support percentile
    // aggregates.
    db.auditLog.findMany({
      where: {
        action: "ai.conversation.turn",
        createdAt: { gte: day1 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { payloadJson: true },
    }),
    // AuditLog has no clinic relation declared in schema — resolve the
    // clinic name in a follow-up `findMany` so this stays a single
    // round-trip per dimension.
    db.auditLog.findMany({
      where: {
        action: {
          in: [
            "ai.conversation.send_failed",
            "ai.conversation.failed",
            "whatsapp.webhook.invalid_signature",
            "ai.conversation.disabled_handoff",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        clinicId: true,
        action: true,
        payloadJson: true,
        createdAt: true,
      },
    }),
  ]);

  // Hydrate clinic names for the recent-errors panel — one extra query
  // for the distinct clinicIds in the result set.
  const clinicIds = Array.from(new Set(recentErrors.map((r) => r.clinicId)));
  const clinicNames = clinicIds.length
    ? await db.clinic.findMany({
        where: { id: { in: clinicIds } },
        select: { id: true, name: true },
      })
    : [];
  const clinicNameMap = new Map(clinicNames.map((c) => [c.id, c.name]));

  // ─── Daily histogram (14 days) ────────────────────────────────────────
  const histo = new Map<string, { conversations: number; turns: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(day14.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    histo.set(key, { conversations: 0, turns: 0 });
  }
  for (const c of convs14d) {
    const key = c.lastActivityAt.toISOString().slice(0, 10);
    const slot = histo.get(key);
    if (slot) {
      slot.conversations += 1;
      slot.turns += c.totalTurns;
    }
  }
  const activity14d: MonitoringPoint[] = Array.from(histo.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // ─── Latency percentiles ──────────────────────────────────────────────
  const latencies = latencySamples
    .map((r) => {
      const p = r.payloadJson as { ms?: number } | null;
      return typeof p?.ms === "number" ? p.ms : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const pick = (arr: number[], pct: number): number | null => {
    if (arr.length === 0) return null;
    const idx = Math.min(arr.length - 1, Math.floor((pct / 100) * arr.length));
    return arr[idx] ?? null;
  };

  const totalTurns24h = activity14d
    .slice(-1)
    .reduce((s, p) => s + p.turns, 0);

  const handoverRate24h =
    conversations24h > 0
      ? Math.round((handedOff24h / conversations24h) * 100)
      : 0;

  return ok({
    totals: {
      conversations24h,
      turns24h: totalTurns24h,
      handoverRate24h,
      sendFailures24h: sendFailures,
      webhookErrors24h: webhookErrors,
      activeClinics: activeClinicsCount,
      aiEnabledClinics,
      aiDisabledClinics,
    },
    latency: {
      p50: pick(latencies, 50),
      p95: pick(latencies, 95),
      p99: pick(latencies, 99),
      samples: latencies.length,
    },
    activity14d,
    recentErrors: recentErrors.map((r) => ({
      id: r.id,
      clinicId: r.clinicId,
      clinicName: clinicNameMap.get(r.clinicId) ?? "—",
      action: r.action,
      payload: r.payloadJson,
      at: r.createdAt,
    })),
    generatedAt: new Date(),
  });
}
