import { z } from "zod";
import { WaitlistTimePreference } from "@prisma/client";

export const addToWaitlistSchema = z.object({
  patientId: z.string().min(1, "REQUIRED"),
  /** null = any dentist. */
  dentistId: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  durationMin: z.coerce.number().int().min(15).max(180),
  timePreference: z.nativeEnum(WaitlistTimePreference).default(WaitlistTimePreference.ANY),
  /** yyyy-mm-dd from <input type="date"> */
  notBefore: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notAfter: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reason: z.string().trim().max(200).optional(),
});
export type AddToWaitlistInput = z.infer<typeof addToWaitlistSchema>;
