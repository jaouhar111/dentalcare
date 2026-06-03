"use server";

import { AppointmentStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";

/**
 * Phase 11 — Stage E
 *
 * No-show risk detection.
 *
 * A patient is « at risk » if they have **≥ 2 NO_SHOW** appointments
 * in the **last 12 months**. The threshold is intentionally
 * conservative — false-positives (flagging a patient who had one bad
 * day) erode the trust between cabinet and patient. Two repeated
 * no-shows is a genuine behavioural pattern.
 *
 * Where this lights up :
 *   - In the new-appointment form (admin sees a "⚠ Patient à risque" badge)
 *   - In the patient detail page (a summary card on the right rail)
 *   - At pre-booking time (the bot warns the patient if appropriate)
 *
 * No automated CB-deposit yet — that lands with Phase 7 (Billing).
 * For now the cabinet decides whether to ask for it manually.
 */

const ANY_STAFF = [
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.RECEPTIONIST,
] as const;

export interface NoShowRiskAssessment {
  patientId: string;
  patientName: string;
  /// Total NO_SHOW count in the 12-month rolling window.
  noShowCount12m: number;
  /// Cancelled-late count (cancelled < 24h before) — secondary signal.
  cancelledLateCount12m: number;
  /// Total RDV count in the same window — for context.
  totalAppointments12m: number;
  /// Computed level. NONE = perfect or no history. LOW = 1 no-show or
  /// 2+ late cancels. HIGH = 2+ no-shows in 12 months.
  level: "NONE" | "LOW" | "HIGH";
  /// Suggested action for the cabinet's UI to display.
  suggestion: string | null;
}

/**
 * Computes the no-show risk for one patient. Scoped to the caller's
 * clinic — refuses to look at patients from other tenants.
 */
export async function assessPatientNoShowRisk(
  patientId: string,
): Promise<Result<NoShowRiskAssessment>> {
  const me = await requireRole([...ANY_STAFF]);
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: me.clinicId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return fail("NOT_FOUND", "Patient introuvable");

  const oneYearAgo = new Date();
  oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);

  const [noShows, cancelledLate, total] = await Promise.all([
    db.appointment.count({
      where: {
        patientId,
        clinicId: me.clinicId,
        status: AppointmentStatus.NO_SHOW,
        startAt: { gte: oneYearAgo },
      },
    }),
    db.appointment.count({
      where: {
        patientId,
        clinicId: me.clinicId,
        status: AppointmentStatus.CANCELLED,
        cancelledLate: true,
        startAt: { gte: oneYearAgo },
      },
    }),
    db.appointment.count({
      where: {
        patientId,
        clinicId: me.clinicId,
        startAt: { gte: oneYearAgo },
      },
    }),
  ]);

  // Level decision matrix — see the file header for rationale.
  let level: NoShowRiskAssessment["level"] = "NONE";
  let suggestion: string | null = null;
  if (noShows >= 2) {
    level = "HIGH";
    suggestion =
      "Ce patient a manqué 2 RDV ou + en 12 mois. " +
      "Demandez une pré-confirmation 48h à l'avance ou un acompte avant de bloquer un long créneau.";
  } else if (noShows === 1 || cancelledLate >= 2) {
    level = "LOW";
    suggestion =
      "Patient a déjà manqué/annulé tardivement — un rappel WhatsApp 48h à l'avance " +
      "réduit le risque de récidive.";
  }

  return ok({
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    noShowCount12m: noShows,
    cancelledLateCount12m: cancelledLate,
    totalAppointments12m: total,
    level,
    suggestion,
  });
}

/**
 * Bulk variant — used by the appointments list / dashboard to badge
 * multiple patients at once without N round-trips. Returns a map
 * `patientId → assessment` for the requested ids that belong to the
 * caller's clinic.
 */
export async function assessNoShowRiskBulk(
  patientIds: string[],
): Promise<Result<Map<string, NoShowRiskAssessment>>> {
  const me = await requireRole([...ANY_STAFF]);
  if (patientIds.length === 0) return ok(new Map());

  const oneYearAgo = new Date();
  oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);

  // One SQL groupBy per status flavour. The numbers are small enough
  // (≤ a few hundred per cabinet) that an in-memory join wins over
  // any fancier raw query.
  const [patients, noShows, lateCancels, totals] = await Promise.all([
    db.patient.findMany({
      where: {
        id: { in: patientIds },
        clinicId: me.clinicId,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: {
        patientId: { in: patientIds },
        clinicId: me.clinicId,
        status: AppointmentStatus.NO_SHOW,
        startAt: { gte: oneYearAgo },
      },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: {
        patientId: { in: patientIds },
        clinicId: me.clinicId,
        status: AppointmentStatus.CANCELLED,
        cancelledLate: true,
        startAt: { gte: oneYearAgo },
      },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: {
        patientId: { in: patientIds },
        clinicId: me.clinicId,
        startAt: { gte: oneYearAgo },
      },
      _count: { _all: true },
    }),
  ]);

  const noShowMap = new Map(noShows.map((r) => [r.patientId, r._count._all]));
  const lateMap = new Map(lateCancels.map((r) => [r.patientId, r._count._all]));
  const totalMap = new Map(totals.map((r) => [r.patientId, r._count._all]));

  const out = new Map<string, NoShowRiskAssessment>();
  for (const p of patients) {
    const noShowCount = noShowMap.get(p.id) ?? 0;
    const lateCount = lateMap.get(p.id) ?? 0;
    const totalCount = totalMap.get(p.id) ?? 0;
    let level: NoShowRiskAssessment["level"] = "NONE";
    let suggestion: string | null = null;
    if (noShowCount >= 2) {
      level = "HIGH";
      suggestion =
        "Patient avec 2+ no-shows / 12 mois — pré-confirmation 48h recommandée.";
    } else if (noShowCount === 1 || lateCount >= 2) {
      level = "LOW";
      suggestion = "Patient à surveiller — un rappel 48h à l'avance aide.";
    }
    out.set(p.id, {
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      noShowCount12m: noShowCount,
      cancelledLateCount12m: lateCount,
      totalAppointments12m: totalCount,
      level,
      suggestion,
    });
  }

  return ok(out);
}
