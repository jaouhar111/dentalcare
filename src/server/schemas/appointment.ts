import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

export const APPOINTMENT_DURATIONS = [15, 30, 45, 60, 75, 90, 120] as const;
export type AppointmentDuration = (typeof APPOINTMENT_DURATIONS)[number];

/** Inner shape — extended separately by create vs update. */
const appointmentShape = z.object({
  patientId: z.string().min(1, "REQUIRED"),
  dentistId: z.string().min(1, "REQUIRED"),
  /** ISO date-time. Local-tz times from <input type="datetime-local"> are converted before submit. */
  startAt: z.string().datetime("INVALID_DATE"),
  durationMin: z.coerce
    .number()
    .int()
    .refine((v) => APPOINTMENT_DURATIONS.includes(v as AppointmentDuration), {
      message: "INVALID_DURATION",
    }),
  reason: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  /**
   * Optional catalog item linked to this séance. On create, the action
   * spawns a PLANNED `TreatmentApplication` so the dentist sees the
   * intended act in the séance editor and the recall pipeline knows
   * what to fire when the act is later marked COMPLETED.
   */
  catalogItemId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const validDateRefine = (v: { startAt: string }) => !Number.isNaN(Date.parse(v.startAt));

export const createAppointmentSchema = appointmentShape.refine(validDateRefine, {
  message: "INVALID_DATE",
  path: ["startAt"],
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = appointmentShape
  .extend({ id: z.string().min(1) })
  .refine(validDateRefine, { message: "INVALID_DATE", path: ["startAt"] });
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const markStatusSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(AppointmentStatus),
});
export type MarkStatusInput = z.infer<typeof markStatusSchema>;

export const listAppointmentsSchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    dentistIds: z.array(z.string().min(1)).optional(),
  })
  .refine((v) => new Date(v.from) < new Date(v.to), { message: "RANGE_INVERTED", path: ["to"] });
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>;
