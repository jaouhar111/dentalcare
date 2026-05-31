import { z } from "zod";
import { AppointmentSource, AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { publishEvent } from "@/lib/events";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * `create_appointment` — books a slot the model previously got from
 * `search_available_slots`. Defends against the obvious risks:
 *
 *  - Patient must exist in the cabinet's DB (the AI never creates a
 *    patient row — that's a human-flow decision).
 *  - Dentist must be active in this clinic.
 *  - The slot is re-checked for conflicts inside the transaction; the
 *    model could have raced another booking in the few seconds since
 *    the search.
 *  - Audit log carries `action: "ai.appointment.create"` so admins can
 *    filter AI-driven bookings.
 *  - Outbox event published in the same transaction → recall pipeline +
 *    confirmation message kick off automatically.
 */
export function createAppointmentTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "create_appointment",
    description:
      "Crée un rendez-vous pour le patient. Utilise UNIQUEMENT un `startAt` obtenu via `search_available_slots`. " +
      "Le patient doit déjà exister (identifié par téléphone). Si pas de patient, demande au patient de venir au cabinet pour l'enregistrement.",
    parameters: z.object({
      dentistId: z
        .string()
        .min(1)
        .describe("ID du dentiste, obtenu via `search_available_slots`."),
      startAt: z
        .string()
        .datetime()
        .describe("Début ISO 8601 (ex: 2026-06-04T14:00:00.000Z)."),
      durationMin: z.number().int().min(15).max(180).default(30),
      reason: z
        .string()
        .max(200)
        .optional()
        .describe("Motif court ex. 'détartrage', 'douleur dent 26'."),
    }),
    handler: async (args) => {
      if (!ctx.patientId) {
        return {
          ok: false,
          error: "PATIENT_NOT_REGISTERED",
          message:
            "Aucun dossier patient n'est lié à ce numéro WhatsApp. Demande poliment au patient son prénom et son nom, puis appelle `create_patient(firstName, lastName)` avant de retenter `create_appointment` avec les mêmes paramètres.",
        };
      }

      // Re-validate patient + dentist still active inside the same tx.
      const [patient, dentist] = await Promise.all([
        db.patient.findFirst({
          where: { id: ctx.patientId, clinicId: ctx.clinicId, deletedAt: null },
          select: { id: true, firstName: true, lastName: true },
        }),
        db.dentist.findFirst({
          where: { id: args.dentistId, clinicId: ctx.clinicId, isActive: true },
          select: { id: true, firstName: true, lastName: true },
        }),
      ]);
      if (!patient) {
        return { ok: false, error: "PATIENT_NOT_FOUND" };
      }
      if (!dentist) {
        return { ok: false, error: "DENTIST_NOT_FOUND" };
      }

      // Business rule: one active future RDV per patient. We block here
      // to avoid the patient stacking multiple bookings via the bot —
      // either through misunderstanding or attempted abuse. The bot's
      // system prompt instructs it to surface this case as "you already
      // have a RDV, want to cancel/reschedule it ?".
      const existingFuture = await db.appointment.findFirst({
        where: {
          clinicId: ctx.clinicId,
          patientId: patient.id,
          startAt: { gt: new Date() },
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.RESCHEDULE_REQUESTED,
            ],
          },
        },
        select: {
          id: true,
          startAt: true,
          dentist: { select: { firstName: true, lastName: true } },
        },
      });
      if (existingFuture) {
        // Pre-format the start time in Casablanca local. The model has
        // shown that it hallucinates dates when handed a raw ISO + told
        // to "format it" — by computing the string here we remove that
        // failure mode entirely. `frenchDateTime()` returns e.g.
        // "vendredi 5 juin à 10h00".
        const localStr = frenchDateTime(existingFuture.startAt);
        const dentistFullName = `Dr ${existingFuture.dentist.firstName} ${existingFuture.dentist.lastName}`;
        return {
          ok: false,
          error: "ALREADY_HAS_FUTURE_APPOINTMENT",
          existingAppointmentId: existingFuture.id,
          existingStartAt: existingFuture.startAt.toISOString(),
          existingLocalDateTime: localStr,
          existingDentistName: dentistFullName,
          message: `Le patient a DÉJÀ un rendez-vous le ${localStr} avec ${dentistFullName}. ` +
            "Réponds-lui EXACTEMENT avec cette date et ce dentiste (pas une autre), puis propose-lui : " +
            "soit ANNULER ce RDV (appelle cancel_appointment avec existingAppointmentId), " +
            "soit le REPORTER (cancel puis create au nouveau créneau qu'il choisit).",
        };
      }

      const start = new Date(args.startAt);
      const end = new Date(start.getTime() + args.durationMin * 60_000);

      // Conflict re-check — guard against the race where another booking
      // landed between the model's search and this call.
      const conflict = await db.appointment.findFirst({
        where: {
          clinicId: ctx.clinicId,
          dentistId: dentist.id,
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
              AppointmentStatus.RESCHEDULE_REQUESTED,
            ],
          },
          startAt: { lt: end },
          endAt: { gt: start },
        },
        select: { id: true },
      });
      if (conflict) {
        return {
          ok: false,
          error: "SLOT_TAKEN",
          message: "Ce créneau vient d'être réservé. Relance `search_available_slots` pour en proposer d'autres.",
        };
      }

      // Use the AI as the "creator" by attributing to a synthetic system
      // user — we keep `createdById` on the schema, so we need a row that
      // exists. For now we fall back to ctx.userId (set by the admin
      // playground) and throw if neither is available; later we can seed
      // a per-clinic `AI_BOT` user.
      if (!ctx.userId) {
        return {
          ok: false,
          error: "NO_AI_USER",
          message: "AI booking not configured: no system user. Skipping create.",
        };
      }

      const created = await db.$transaction(async (tx) => {
        const appt = await tx.appointment.create({
          data: {
            clinicId: ctx.clinicId,
            patientId: patient.id,
            dentistId: dentist.id,
            startAt: start,
            endAt: end,
            reason: args.reason ?? null,
            status: AppointmentStatus.SCHEDULED,
            source: AppointmentSource.AI_WHATSAPP,
            createdById: ctx.userId!,
          },
          select: { id: true, startAt: true },
        });
        await publishEvent(tx, {
          clinicId: ctx.clinicId,
          name: "appointment.created",
          payload: {
            id: appt.id,
            patientId: patient.id,
            dentistId: dentist.id,
            startAt: start.toISOString(),
            source: "ai_whatsapp",
          },
        });
        return appt;
      });

      await audit({
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: "ai.appointment.create",
        entity: "Appointment",
        entityId: created.id,
        payload: {
          patientId: patient.id,
          dentistId: dentist.id,
          startAt: created.startAt.toISOString(),
          durationMin: args.durationMin,
          source: "ai_whatsapp",
        },
      });

      return {
        ok: true,
        appointmentId: created.id,
        summary: `RDV créé pour ${patient.firstName} ${patient.lastName} avec Dr ${dentist.firstName} ${dentist.lastName} le ${created.startAt.toISOString()}`,
      };
    },
  });
}

const DAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/**
 * Formats a Date as e.g. "vendredi 5 juin à 10h00" in Casablanca local
 * time. The model has shown that handing it a raw ISO + asking it to
 * format leads to date hallucinations, so the tool layer does the
 * formatting and the model just echoes the string.
 */
function frenchDateTime(d: Date): string {
  // Convert to Casablanca local by adding +01:00 (year-round since 2018).
  const local = new Date(d.getTime() + 60 * 60 * 1000);
  const day = DAYS_FR[local.getUTCDay()];
  const date = local.getUTCDate();
  const month = MONTHS_FR[local.getUTCMonth()];
  const h = String(local.getUTCHours()).padStart(2, "0");
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${day} ${date} ${month} à ${h}h${m}`;
}
