import { z } from "zod";

const itemSchema = z.object({
  drug: z.string().trim().min(1, "REQUIRED").max(200),
  dosage: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  frequency: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  duration: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  instructions: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const createPrescriptionSchema = z.object({
  patientId: z.string().min(1),
  dentistId: z.string().min(1),
  appointmentId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  locale: z.enum(["fr", "en"]).default("fr"),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  items: z.array(itemSchema).min(1, "REQUIRED").max(20),
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export const updatePrescriptionSchema = createPrescriptionSchema.extend({
  id: z.string().min(1),
});
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
