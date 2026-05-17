import { z } from "zod";
import { RadiographKind, TreatmentPhotoStage } from "@prisma/client";

// ─── Medical notes ──────────────────────────────────────────────────────────

export const createMedicalNoteSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  body: z.string().trim().min(1, "REQUIRED").max(5000),
});
export type CreateMedicalNoteInput = z.infer<typeof createMedicalNoteSchema>;

export const updateMedicalNoteSchema = createMedicalNoteSchema.extend({
  id: z.string().min(1),
});
export type UpdateMedicalNoteInput = z.infer<typeof updateMedicalNoteSchema>;

// ─── Radiographs ────────────────────────────────────────────────────────────

export const createRadiographSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  kind: z.nativeEnum(RadiographKind).default(RadiographKind.PANORAMIC),
  /// yyyy-mm-dd from <input type="date">.
  takenAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateRadiographInput = z.infer<typeof createRadiographSchema>;

// ─── Treatment photos ───────────────────────────────────────────────────────

export const createTreatmentPhotoSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  appointmentId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  stage: z.nativeEnum(TreatmentPhotoStage).default(TreatmentPhotoStage.BEFORE),
  caption: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateTreatmentPhotoInput = z.infer<typeof createTreatmentPhotoSchema>;
