/**
 * Recall reminder helpers — single source of truth for "send the
 * follow-up checkup reminder for a RecallReminder row".
 *
 * Two paths feed in:
 *  - `/api/cron/recall-reminders` (daily 09:00 Vercel cron) — sweeps any
 *    PENDING + due rows missed by the orchestrator.
 *  - `recallReminderDueDate` Inngest function — triggered by
 *    `recall.created` events at row insertion, durable sleep until dueDate.
 *
 * Idempotence: a row already SENT / APPOINTMENT_BOOKED / DISABLED /
 * EXPIRED short-circuits with a typed skip code, so an at-least-once
 * Inngest delivery never produces a double-send.
 */

import {
  AppointmentStatus,
  RecallStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendText } from "./client";
import { buildCheckupReminder } from "./templates";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export type RecallSendResult =
  | { ok: true; channel: "whatsapp"; mocked?: boolean; messageId?: string }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "ALREADY_PROCESSED"
        | "NOT_DUE_YET"
        | "APPOINTMENT_ALREADY_BOOKED"
        | "SEND_FAILED";
      detail?: string;
    };

const SLACK_DAYS = 60; // bound on how late after dueDate we still try

export async function sendRecallReminderById(
  recallId: string,
): Promise<RecallSendResult> {
  const r = await db.recallReminder.findUnique({
    where: { id: recallId },
    include: {
      patient: {
        select: { id: true, firstName: true, phone: true, preferredLocale: true },
      },
      clinic: { select: { name: true, phone: true, openwaSessionId: true } },
    },
  });
  if (!r) return { ok: false, reason: "NOT_FOUND" };

  if (r.status !== RecallStatus.PENDING) {
    return { ok: false, reason: "ALREADY_PROCESSED", detail: r.status };
  }
  if (r.sentAt) {
    return { ok: false, reason: "ALREADY_PROCESSED", detail: "sentAt set" };
  }

  // Don't fire more than SLACK_DAYS after dueDate — the cron auto-expires
  // these. Catches a corrupted Inngest sleep that wakes way too late.
  const now = new Date();
  const daysLate = (now.getTime() - r.dueDate.getTime()) / 86_400_000;
  if (daysLate < -1) {
    // Inngest woke too early (clock skew, manual replay) — wait, don't send.
    return { ok: false, reason: "NOT_DUE_YET", detail: `${daysLate.toFixed(1)} days early` };
  }
  if (daysLate > SLACK_DAYS) {
    await db.recallReminder.update({
      where: { id: r.id },
      data: { status: RecallStatus.EXPIRED },
    });
    return { ok: false, reason: "ALREADY_PROCESSED", detail: "expired by slack" };
  }

  // Bonus: if the patient already booked a future RDV on/after dueDate,
  // we treat the recall as fulfilled and skip the message.
  const future = await db.appointment.findFirst({
    where: {
      patientId: r.patientId,
      startAt: { gte: r.dueDate },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
    } satisfies Prisma.AppointmentWhereInput,
    select: { id: true },
  });
  if (future) {
    await db.recallReminder.update({
      where: { id: r.id },
      data: { status: RecallStatus.APPOINTMENT_BOOKED, bookedAt: new Date() },
    });
    return { ok: false, reason: "APPOINTMENT_ALREADY_BOOKED" };
  }

  const loc = (r.patient.preferredLocale ?? "fr") as Locale;
  const checkupType =
    r.reason ?? (r.kind === "SCALING" ? "Détartrage de suivi" : "Contrôle");

  const body = buildCheckupReminder({
    patientFirstName: r.patient.firstName,
    checkupType,
    sinceLast: formatDate(r.dueDate, loc, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    clinicName: r.clinic.name,
    clinicPhone: r.clinic.phone ?? "—",
    locale: loc,
  });
  const send = await sendText({
    to: r.patient.phone,
    body,
    sessionId: r.clinic.openwaSessionId,
  });
  if (!send.ok) {
    await audit({
      clinicId: r.clinicId,
      action: "recall.send_failed",
      entity: "RecallReminder",
      entityId: r.id,
      payload: { error: send.error, channel: "whatsapp" },
    });
    return { ok: false, reason: "SEND_FAILED", detail: send.error };
  }

  await db.recallReminder.update({
    where: { id: r.id },
    data: { status: RecallStatus.SENT, sentAt: new Date() },
  });
  await audit({
    clinicId: r.clinicId,
    action: "recall.sent",
    entity: "RecallReminder",
    entityId: r.id,
    payload: { channel: "whatsapp", source: "inngest" },
  });
  return {
    ok: true,
    channel: "whatsapp",
    mocked: "mocked" in send ? send.mocked : undefined,
    messageId: "messageId" in send ? send.messageId : undefined,
  };
}
