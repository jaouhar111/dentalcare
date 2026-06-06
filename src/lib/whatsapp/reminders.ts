/**
 * Reminder helpers — single source of truth for "send the J-1 WhatsApp
 * notice for an appointment". Both paths use this:
 *
 *  - `/api/cron/appointment-reminders` (legacy daily Vercel cron)
 *  - `appointmentJ1Reminder` Inngest function (event-driven, scheduled
 *    at create time, durable through restarts)
 *
 * Idempotence: returns `{ ok: false, reason: "ALREADY_SENT" }` if the
 * appointment row already has `reminderSentAt`. Inngest can retry the
 * step without double-sending.
 */

import { randomBytes } from "node:crypto";
import { AppointmentStatus, CommunicationChannel } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendText } from "./client";
import { buildAppointmentReminder } from "./templates";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export type ReminderResult =
  | { ok: true; messageId?: string; mocked?: boolean; channel: "whatsapp" | "email" }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "ALREADY_SENT"
        | "CANCELLED_OR_DONE"
        | "STARTAT_DRIFT"
        | "SEND_FAILED";
      detail?: string;
    };

/**
 * Sends (or no-ops) the J-1 reminder for one appointment.
 *
 * Why the `STARTAT_DRIFT` check: Inngest schedules the wake based on
 * the startAt captured at appointment creation. If staff later moved the
 * RDV to a different day, firing the reminder at the original time would
 * confuse the patient. We compare on-wake startAt to "tomorrow window"
 * and skip if it slid out. (Future: re-schedule via `appointment.updated`
 * event when we wire it up.)
 */
export async function sendJ1ReminderForAppointment(
  appointmentId: string,
): Promise<ReminderResult> {
  const a = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clinicId: true,
      startAt: true,
      status: true,
      reminderSentAt: true,
      confirmationToken: true,
      reason: true,
      patient: {
        select: { firstName: true, phone: true, preferredChannel: true, preferredLocale: true },
      },
      dentist: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true, openwaSessionId: true } },
    },
  });
  if (!a) return { ok: false, reason: "NOT_FOUND" };
  if (a.reminderSentAt) return { ok: false, reason: "ALREADY_SENT" };
  if (
    a.status !== AppointmentStatus.SCHEDULED &&
    a.status !== AppointmentStatus.CONFIRMED
  ) {
    return { ok: false, reason: "CANCELLED_OR_DONE", detail: a.status };
  }

  // Drift guard: only fire if the appointment is between now+1h and now+48h.
  // Tighter than just "tomorrow" so a re-scheduled RDV moved to later weeks
  // doesn't get the wrong reminder. The Inngest sleep aims for startAt-24h
  // so on a healthy wake the gap is ~24h.
  const now = new Date();
  const hoursAhead = (a.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursAhead < 1 || hoursAhead > 48) {
    return {
      ok: false,
      reason: "STARTAT_DRIFT",
      detail: `startAt is ${hoursAhead.toFixed(1)}h from now`,
    };
  }

  // Lazy-mint the confirmation token if absent. Used by the patient's
  // single-click confirm/reschedule link (delivered via the template).
  const token = a.confirmationToken ?? randomBytes(32).toString("base64url");
  if (!a.confirmationToken) {
    await db.appointment.update({
      where: { id: a.id },
      data: { confirmationToken: token },
    });
  }

  const locale = (a.patient.preferredLocale as Locale) ?? "fr";
  const dateStr = formatDate(a.startAt, locale);
  const timeStr = `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`;

  if (a.patient.preferredChannel === CommunicationChannel.WHATSAPP) {
    const body = buildAppointmentReminder({
      patientFirstName: a.patient.firstName,
      date: dateStr,
      time: timeStr,
      dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
      clinicName: a.clinic.name,
      locale,
    });
    const sent = await sendText({
      to: a.patient.phone,
      body,
      sessionId: a.clinic.openwaSessionId,
    });
    if (!sent.ok) {
      await audit({
        clinicId: a.clinicId,
        action: "appointment.reminder.failed",
        entity: "Appointment",
        entityId: a.id,
        payload: { error: sent.error },
      });
      return { ok: false, reason: "SEND_FAILED", detail: sent.error };
    }
    await markSent(a.id, a.clinicId, "whatsapp");
    return {
      ok: true,
      channel: "whatsapp",
      messageId: "messageId" in sent ? sent.messageId : undefined,
      mocked: "mocked" in sent ? sent.mocked : undefined,
    };
  }

  // Email path — Phase 11.x will wire Resend. For now we just stamp
  // reminderSentAt + log so the audit story stays coherent.
  const link = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/${locale}/confirm-appointment?token=${token}`;
  console.log(`[reminder:email-mock] ${a.patient.phone} ${dateStr} ${timeStr} ${link}`);
  await markSent(a.id, a.clinicId, "email");
  return { ok: true, channel: "email", mocked: true };
}

async function markSent(appointmentId: string, clinicId: string, channel: "whatsapp" | "email") {
  await db.appointment.update({
    where: { id: appointmentId },
    data: { reminderSentAt: new Date() },
  });
  await audit({
    clinicId,
    action: "appointment.reminder.sent",
    entity: "Appointment",
    entityId: appointmentId,
    payload: { channel, source: "inngest" },
  });
}

/**
 * Same-day morning reminder — sent at 08:00 Casablanca on the day of
 * the appointment, independent of the J-1 reminder. Reuses the
 * existing `APPOINTMENT_REMINDER` template (same params, just fired
 * closer in time), with `morningReminderSentAt` as the idempotence
 * field so a retry within the same day never double-sends and so a
 * J-1 send (which stamps `reminderSentAt`) doesn't block this one.
 *
 * The drift guard accepts a wider window than J-1 (0-18h ahead)
 * because by definition this fires same-day, so an evening RDV is up
 * to ~14h away when this fires at 8am.
 */
export async function sendMorningReminderForAppointment(
  appointmentId: string,
): Promise<ReminderResult> {
  const a = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clinicId: true,
      startAt: true,
      status: true,
      morningReminderSentAt: true,
      confirmationToken: true,
      patient: {
        select: { firstName: true, phone: true, preferredChannel: true, preferredLocale: true },
      },
      dentist: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true, openwaSessionId: true } },
    },
  });
  if (!a) return { ok: false, reason: "NOT_FOUND" };
  if (a.morningReminderSentAt) return { ok: false, reason: "ALREADY_SENT" };
  if (
    a.status !== AppointmentStatus.SCHEDULED &&
    a.status !== AppointmentStatus.CONFIRMED
  ) {
    return { ok: false, reason: "CANCELLED_OR_DONE", detail: a.status };
  }

  // Drift guard: must be later today (0-18h ahead). If the cron fired
  // late or the RDV slid out, skip rather than confuse the patient.
  const now = new Date();
  const hoursAhead = (a.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursAhead < 0 || hoursAhead > 18) {
    return {
      ok: false,
      reason: "STARTAT_DRIFT",
      detail: `startAt is ${hoursAhead.toFixed(1)}h from now`,
    };
  }

  const locale = (a.patient.preferredLocale as Locale) ?? "fr";
  const dateStr = formatDate(a.startAt, locale);
  const timeStr = `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`;

  if (a.patient.preferredChannel === CommunicationChannel.WHATSAPP) {
    const text = buildMorningReminderText({
      firstName: a.patient.firstName,
      timeStr,
      dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
      clinicName: a.clinic.name,
      locale,
    });
    const sent = await sendText({
      to: a.patient.phone,
      body: text,
      sessionId: a.clinic.openwaSessionId,
    });
    if (!sent.ok) {
      await audit({
        clinicId: a.clinicId,
        action: "appointment.morning_reminder.failed",
        entity: "Appointment",
        entityId: a.id,
        payload: { error: sent.error },
      });
      return { ok: false, reason: "SEND_FAILED", detail: sent.error };
    }
    await markMorningSent(a.id, a.clinicId, "whatsapp");
    return {
      ok: true,
      channel: "whatsapp",
      messageId: "messageId" in sent ? sent.messageId : undefined,
      mocked: "mocked" in sent ? sent.mocked : undefined,
    };
  }

  // Email path — not implemented for morning reminders yet, no-op log.
  console.log(`[morning-reminder:skip-email] ${a.patient.phone} ${dateStr} ${timeStr}`);
  await markMorningSent(a.id, a.clinicId, "email");
  return { ok: true, channel: "email", mocked: true };
}

function buildMorningReminderText(args: {
  firstName: string;
  timeStr: string;
  dentistName: string;
  clinicName: string;
  locale: Locale;
}): string {
  if (args.locale === "en") {
    return (
      `Good morning ${args.firstName} ☀️\n\n` +
      `Just a reminder — you have an appointment today at ${args.clinicName}:\n` +
      `🕐 ${args.timeStr}\n` +
      `👩‍⚕️ ${args.dentistName}\n\n` +
      `See you soon!`
    );
  }
  return (
    `Bonjour ${args.firstName} ☀️\n\n` +
    `Petit rappel — vous avez un rendez-vous aujourd'hui au cabinet ${args.clinicName} :\n` +
    `🕐 ${args.timeStr}\n` +
    `👩‍⚕️ ${args.dentistName}\n\n` +
    `À tout à l'heure !`
  );
}

async function markMorningSent(
  appointmentId: string,
  clinicId: string,
  channel: "whatsapp" | "email",
) {
  await db.appointment.update({
    where: { id: appointmentId },
    data: { morningReminderSentAt: new Date() },
  });
  await audit({
    clinicId,
    action: "appointment.morning_reminder.sent",
    entity: "Appointment",
    entityId: appointmentId,
    payload: { channel, source: "inngest" },
  });
}
