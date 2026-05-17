import { z } from "zod";
import { RecallKind } from "@prisma/client";

export const createRecallSchema = z.object({
  patientId: z.string().min(1),
  kind: z.nativeEnum(RecallKind),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE"),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateRecallInput = z.infer<typeof createRecallSchema>;

export const disableRecallSchema = z.object({
  id: z.string().min(1),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type DisableRecallInput = z.infer<typeof disableRecallSchema>;

export const listRecallsSchema = z.object({
  status: z
    .enum(["PENDING", "SENT", "APPOINTMENT_BOOKED", "DISABLED", "EXPIRED", "OPEN", "all"])
    .default("OPEN"),
  patientId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type ListRecallsInput = z.infer<typeof listRecallsSchema>;
