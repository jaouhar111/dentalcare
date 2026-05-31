import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * `list_my_appointments` — pulls the patient's upcoming + recent past
 * RDV so the model can answer "j'ai un RDV quand déjà ?" and reference
 * a specific appointment when the patient asks to cancel or reschedule.
 *
 * Returns max 5 upcoming + 3 past. Past ones help when the patient says
 * "le dernier RDV", "il y a 2 semaines", etc.
 */
export function listMyAppointmentsTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "list_my_appointments",
    description:
      "Liste les rendez-vous du patient (5 prochains + 3 derniers passés). " +
      "À appeler quand le patient demande à voir / annuler / déplacer un de ses RDV.",
    parameters: z.object({}),
    handler: async () => {
      if (!ctx.patientId) {
        return {
          ok: false,
          error: "PATIENT_UNKNOWN",
          message:
            "Patient non identifié — demande son nom + téléphone et appelle plutôt `get_cabinet_info`.",
        };
      }
      const now = new Date();
      const [upcoming, past] = await Promise.all([
        db.appointment.findMany({
          where: {
            clinicId: ctx.clinicId,
            patientId: ctx.patientId,
            startAt: { gte: now },
            status: {
              in: [
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.RESCHEDULE_REQUESTED,
              ],
            },
          },
          orderBy: { startAt: "asc" },
          take: 5,
          include: {
            dentist: { select: { firstName: true, lastName: true } },
          },
        }),
        db.appointment.findMany({
          where: {
            clinicId: ctx.clinicId,
            patientId: ctx.patientId,
            startAt: { lt: now },
          },
          orderBy: { startAt: "desc" },
          take: 3,
          include: {
            dentist: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);
      return {
        upcoming: upcoming.map((a) => ({
          id: a.id,
          startAt: a.startAt.toISOString(),
          status: a.status,
          dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
          reason: a.reason,
        })),
        past: past.map((a) => ({
          id: a.id,
          startAt: a.startAt.toISOString(),
          status: a.status,
          dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
          reason: a.reason,
        })),
      };
    },
  });
}
