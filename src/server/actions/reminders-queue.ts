"use server";

import { AppointmentStatus, RecallStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";
import type {
  RemindersQueueData,
  SendFailure,
  UpcomingAppointmentReminder,
  UpcomingRecall,
} from "./reminders-queue-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;

/// Failure-flagged actions in the audit log we surface as "Échecs récents".
const FAILURE_ACTIONS = [
  "ai.conversation.send_failed",
  "recall.send_failed",
  "appointment.reminder.failed",
] as const;

/**
 * Single round-trip for the `/reminders-queue` admin page. Pulls:
 *  - Upcoming appointments in the next 30 days (so the cabinet sees
 *    what's about to get a J-1 ping).
 *  - PENDING recalls due in the next 60 days.
 *  - Failed WhatsApp sends from the last 7 days (audit log).
 *
 * Scoped to the caller's clinic; cheap because all three tables are
 * indexed on `(clinicId, *)` and we cap at 50 rows each.
 */
export async function getRemindersQueue(): Promise<Result<RemindersQueueData>> {
  const user = await requireRole([...ANY_STAFF]);

  const now = new Date();
  const horizonAppt = new Date(now.getTime() + 30 * 86_400_000);
  const horizonRecall = new Date(now.getTime() + 60 * 86_400_000);
  const failuresFrom = new Date(now.getTime() - 7 * 86_400_000);

  const [appts, recalls, failures] = await Promise.all([
    db.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startAt: { gte: now, lte: horizonAppt },
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        patient: { deletedAt: null },
      },
      orderBy: { startAt: "asc" },
      take: 50,
      select: {
        id: true,
        startAt: true,
        status: true,
        reminderSentAt: true,
        source: true,
        patient: { select: { firstName: true, lastName: true, phone: true } },
        dentist: { select: { firstName: true, lastName: true } },
      },
    }),
    db.recallReminder.findMany({
      where: {
        clinicId: user.clinicId,
        status: RecallStatus.PENDING,
        dueDate: { gte: now, lte: horizonRecall },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        dueDate: true,
        reason: true,
        patient: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    db.auditLog.findMany({
      where: {
        clinicId: user.clinicId,
        action: { in: [...FAILURE_ACTIONS] },
        createdAt: { gte: failuresFrom },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        payloadJson: true,
      },
    }),
  ]);

  const upcomingAppointments: UpcomingAppointmentReminder[] = appts.map((a) => ({
    appointmentId: a.id,
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    patientPhone: a.patient.phone,
    dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
    startAt: a.startAt,
    reminderAt: new Date(a.startAt.getTime() - 24 * 60 * 60 * 1000),
    status: a.status,
    reminderSentAt: a.reminderSentAt,
    source: a.source,
  }));

  const upcomingRecalls: UpcomingRecall[] = recalls.map((r) => ({
    id: r.id,
    patientName: `${r.patient.firstName} ${r.patient.lastName}`,
    patientPhone: r.patient.phone,
    kind: r.kind,
    dueDate: r.dueDate,
    reason: r.reason,
  }));

  const recentFailures: SendFailure[] = failures.map((f) => {
    const p = (f.payloadJson ?? {}) as Record<string, unknown>;
    const error = typeof p.error === "string" ? p.error : "";
    const to = typeof p.to === "string" ? p.to : "";
    return {
      id: f.id,
      createdAt: f.createdAt,
      action: f.action,
      entity: f.entity,
      entityId: f.entityId,
      errorPreview: error.length > 100 ? `${error.slice(0, 100)}…` : error,
      context: to || null,
    };
  });

  return ok({
    upcomingAppointments,
    upcomingRecalls,
    recentFailures,
    totals: {
      appointmentsTotal: upcomingAppointments.length,
      appointmentsAlreadySent: upcomingAppointments.filter((a) => a.reminderSentAt).length,
      recallsTotal: upcomingRecalls.length,
      failuresTotal: recentFailures.length,
    },
  });
}
