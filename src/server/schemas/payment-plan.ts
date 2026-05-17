import { z } from "zod";

export const createPlanSchema = z.object({
  invoiceId: z.string().min(1),
  installmentsCount: z.coerce.number().int().min(2).max(36),
  /// First-installment date — subsequent ones are spaced monthly.
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE"),
  /// Optional down payment recorded immediately (deducted from the first
  /// installment so the plan covers exactly `total - downPayment`).
  downPayment: z.coerce
    .number()
    .nonnegative()
    .max(9_999_999.99)
    .optional()
    .or(z.nan().transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const cancelPlanSchema = z.object({
  id: z.string().min(1),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CancelPlanInput = z.infer<typeof cancelPlanSchema>;
