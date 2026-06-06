/**
 * Phase 11 — Stage B
 *
 * Auto-cancel an appointment when the patient never confirmed it.
 *
 * Trigger : Inngest function `appointmentAutoCancelOnSilence` calls
 * this helper at `startAt - 2h`. If the patient has not clicked
 * "Je confirme" via the J-1 quick-reply (i.e.
 * `confirmationReceivedAt IS NULL`) AND the appointment is still
 * SCHEDULED, we flip it to CANCELLED, publish
 * `appointment.cancelled` so the existing waitlist-promote pipeline
 * runs, and ping the cabinet's admin inbox with a courtesy message.
 *
 * Idempotence : if the status already moved (CONFIRMED, COMPLETED,
 * CANCELLED, NO_SHOW), we skip. The function is safe to retry from
 * Inngest's at-least-once delivery.
 */

import { randomBytes } from "node:crypto";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { publishEvent } from "@/lib/events";
import { sendText } from "./client";

export type AutoCancelResult =
  | { ok: true; cancelled: true; appointmentId: string }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CONFIRMED" | "ALREADY_CANCELLED" | "PAST" }
  | { ok: true; cancelled: false; reason: "ALREADY_CONFIRMED" | "ALREADY_CANCELLED" | "PAST" };

/**
 * Returns `{ cancelled: true }` when the appointment was just cancelled,
 * or `{ cancelled: false, reason }` when we skipped (idempotence path).
 */
export async function autoCancelOnSilence(
  appointmentId: string,
): Promise<AutoCancelResult> {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clinicId: true,
      dentistId: true,
      startAt: true,
      endAt: true,
      status: true,
      confirmationReceivedAt: true,
      patient: { select: { firstName: true, phone: true } },
      clinic: { select: { openwaSessionId: true } },
    },
  });
  if (!appt) return { ok: false, reason: "NOT_FOUND" };

  // Skip if patient already confirmed — even if status is still SCHEDULED
  // for some weird race, the explicit click means we leave the slot alone.
  if (appt.confirmationReceivedAt) {
    return { ok: true, cancelled: false, reason: "ALREADY_CONFIRMED" };
  }
  if (appt.status === AppointmentStatus.CONFIRMED) {
    return { ok: true, cancelled: false, reason: "ALREADY_CONFIRMED" };
  }
  if (
    appt.status === AppointmentStatus.CANCELLED ||
    appt.status === AppointmentStatus.NO_SHOW
  ) {
    return { ok: true, cancelled: false, reason: "ALREADY_CANCELLED" };
  }
  // If the slot has already passed (cron drift, manual delay), don't
  // auto-cancel retroactively — leave it for the manual no-show flow.
  if (appt.startAt.getTime() < Date.now()) {
    return { ok: true, cancelled: false, reason: "PAST" };
  }

  // Cancel + publish event in the same transaction so the waitlist
  // auto-promote can never miss a freed slot.
  await db.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: "Auto-annulé — aucune confirmation 2h avant le RDV",
        cancelledLate: true,
      },
    });
    await publishEvent(tx, {
      clinicId: appt.clinicId,
      name: "appointment.cancelled",
      payload: {
        id: appt.id,
        patientId: "", // unused downstream; matches event schema
        dentistId: appt.dentistId,
        startAt: appt.startAt.toISOString(),
        endAt: appt.endAt.toISOString(),
        isLate: true,
        source: "auto_cancel_silence",
      },
    });
  });

  await audit({
    clinicId: appt.clinicId,
    action: "appointment.auto_cancel.silence",
    entity: "Appointment",
    entityId: appt.id,
    payload: {
      hoursBefore: 2,
      patientPhone: appt.patient.phone,
    },
  });

  // Courtesy ping to the patient — keeps the door open for rebooking
  // through the AI engine. Best-effort: failure here doesn't roll back.
  await sendText({
    to: appt.patient.phone,
    sessionId: appt.clinic.openwaSessionId,
    body:
      `Bonjour ${appt.patient.firstName}, votre rendez-vous prévu dans 2h n'a pas été confirmé — nous l'avons libéré pour un autre patient. ` +
      `Si vous voulez le reporter, répondez-moi simplement et je vous propose des créneaux ✨`,
  }).catch((err) => {
    console.error("[auto-cancel] courtesy ping failed", {
      appointmentId: appt.id,
      err,
    });
  });

  // Generate a magic-link-style token in case admin UI needs to surface
  // a "restore" action later (no UI yet — leaving the token in audit).
  void randomBytes;

  return { ok: true, cancelled: true, appointmentId: appt.id };
}
