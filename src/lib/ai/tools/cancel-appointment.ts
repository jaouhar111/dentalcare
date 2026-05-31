import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { publishEvent } from "@/lib/events";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * `cancel_appointment` — soft-cancels a RDV.
 *
 * Defensive checks:
 *  - The appointment must belong to the same clinic AS the AI session.
 *  - If `ctx.patientId` is set, the appointment must also belong to that
 *    patient — prevents a model from cancelling someone else's RDV after
 *    being confused by a conversation thread.
 *  - Cancellations within 24h flip `cancelledLate = true` for cabinet
 *    stats (no-show rate proxy).
 */
export function cancelAppointmentTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "cancel_appointment",
    description:
      "Annule un rendez-vous existant. À utiliser uniquement après confirmation explicite du patient.",
    parameters: z.object({
      appointmentId: z.string().min(1).describe("ID du RDV obtenu via `list_my_appointments`."),
      reason: z
        .string()
        .max(200)
        .optional()
        .describe("Raison libre fournie par le patient ex. 'voyage', 'imprévu'."),
    }),
    handler: async (args) => {
      const appt = await db.appointment.findFirst({
        where: {
          id: args.appointmentId,
          clinicId: ctx.clinicId,
          ...(ctx.patientId ? { patientId: ctx.patientId } : {}),
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          patientId: true,
          dentistId: true,
        },
      });
      if (!appt) {
        return { ok: false, error: "NOT_FOUND", message: "Aucun RDV trouvé avec cet ID." };
      }
      if (
        appt.status === AppointmentStatus.CANCELLED ||
        appt.status === AppointmentStatus.COMPLETED
      ) {
        return { ok: false, error: "ALREADY_FINAL", currentStatus: appt.status };
      }

      const now = new Date();
      const isLate = appt.startAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000;

      await db.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledAt: now,
            cancellationReason: args.reason ?? "Annulé via WhatsApp (IA)",
            cancelledLate: isLate,
          },
        });
        await publishEvent(tx, {
          clinicId: ctx.clinicId,
          name: "appointment.cancelled",
          payload: {
            id: appt.id,
            patientId: appt.patientId,
            dentistId: appt.dentistId,
            startAt: appt.startAt.toISOString(),
            endAt: appt.endAt.toISOString(),
            isLate,
            source: "ai_whatsapp",
          },
        });
      });

      await audit({
        clinicId: ctx.clinicId,
        userId: ctx.userId ?? null,
        action: "ai.appointment.cancel",
        entity: "Appointment",
        entityId: appt.id,
        payload: { reason: args.reason ?? null, isLate, source: "ai_whatsapp" },
      });

      return {
        ok: true,
        appointmentId: appt.id,
        message: isLate
          ? "RDV annulé. Note : annulation tardive (< 24h)."
          : "RDV annulé.",
      };
    },
  });
}
