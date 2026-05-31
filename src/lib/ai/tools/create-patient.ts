import { z } from "zod";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * `create_patient` — registers a new patient record when the WhatsApp
 * number isn't already in the cabinet's DB. The model invokes this
 * AFTER asking the patient for their first + last name (system prompt
 * instructs it to do so politely), and BEFORE `create_appointment`.
 *
 * Defensive checks:
 *  - Refuses if a patient with the same `(clinicId, phone)` already
 *    exists — that would create a duplicate. The handler then mutates
 *    `ctx.patientId` so the next tool calls in the same turn see the
 *    resolved id (important: `create_appointment` reads ctx.patientId).
 *  - Phone is locked to `ctx.patientPhone` (the WhatsApp sender). The
 *    model can't override it from the conversation, which would let a
 *    chatty patient register on someone else's number.
 *  - Date of birth is mandatory in the schema but unknown at this point,
 *    so we default to `1900-01-01` as a sentinel ("unknown DOB"). Staff
 *    can correct it later from the dashboard. This avoids forcing the
 *    bot into a long onboarding interrogation just to take a first RDV.
 *
 * Why the audit log entry: the bot is creating a real patient record,
 * which is sensitive (PII). Cabinet admins must be able to spot any
 * mass-create incident from a buggy iteration or a prompt-injection
 * attempt.
 */
export function createPatientTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "create_patient",
    description:
      "Crée un dossier patient minimal (prénom, nom) lié au numéro WhatsApp de la conversation. " +
      "À appeler UNIQUEMENT si `create_appointment` a échoué avec `PATIENT_NOT_REGISTERED`, " +
      "après avoir demandé poliment au patient son prénom et son nom. Ne JAMAIS appeler proactivement.",
    parameters: z.object({
      firstName: z
        .string()
        .min(1)
        .max(60)
        .describe("Prénom du patient, tel qu'il l'a donné dans le chat."),
      lastName: z
        .string()
        .min(1)
        .max(60)
        .describe("Nom de famille du patient."),
    }),
    handler: async (args) => {
      if (!ctx.patientPhone) {
        return {
          ok: false,
          error: "NO_PHONE_IN_CONTEXT",
          message: "Impossible de créer le patient : numéro de téléphone absent du contexte.",
        };
      }
      if (!ctx.userId) {
        return {
          ok: false,
          error: "NO_AI_USER",
          message: "AI booking not configured: no system user to attribute the create to.",
        };
      }

      // Idempotency check — if a row already exists, just hand it back.
      const existing = await db.patient.findFirst({
        where: {
          clinicId: ctx.clinicId,
          phone: ctx.patientPhone,
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (existing) {
        ctx.patientId = existing.id;
        return {
          ok: true,
          alreadyExists: true,
          patientId: existing.id,
          message: `Patient déjà enregistré (${existing.firstName} ${existing.lastName}).`,
        };
      }

      const firstName = args.firstName.trim();
      const lastName = args.lastName.trim();

      const created = await db.patient.create({
        data: {
          clinicId: ctx.clinicId,
          firstName,
          lastName,
          phone: ctx.patientPhone,
          // Sentinel DOB: 1900-01-01 means "unknown — to be completed
          // by staff". The dashboard renders an "à compléter" badge
          // for any patient whose DOB year is 1900.
          dob: new Date("1900-01-01T00:00:00Z"),
          createdById: ctx.userId,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      // Mutate the context so subsequent tools in the same conversation
      // (e.g. `create_appointment` called right after) see the new id
      // without forcing the model to re-thread it.
      ctx.patientId = created.id;

      await audit({
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: "ai.patient.create",
        entity: "Patient",
        entityId: created.id,
        payload: {
          firstName: created.firstName,
          lastName: created.lastName,
          phone: ctx.patientPhone,
          source: "ai_whatsapp",
        },
      });

      return {
        ok: true,
        patientId: created.id,
        message: `Patient ${created.firstName} ${created.lastName} créé avec succès.`,
      };
    },
  });
}
