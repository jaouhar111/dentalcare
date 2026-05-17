import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

const lineSchema = z
  .object({
    /// When set, the line references an existing TreatmentApplication so the
    /// invoice can trace back to the séance. Pure free-text lines omit it.
    treatmentApplicationId: z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    description: z.string().trim().min(1, "REQUIRED").max(200),
    toothNumber: z.coerce
      .number()
      .int()
      .refine(
        (v) => {
          const q = Math.floor(v / 10);
          const t = v % 10;
          return q >= 1 && q <= 4 && t >= 1 && t <= 8;
        },
        { message: "INVALID_TOOTH" },
      )
      .optional()
      .or(z.nan().transform(() => undefined)),
    quantity: z.coerce.number().int().min(1).max(999).default(1),
    unitPrice: z.coerce.number().nonnegative().max(9_999_999.99),
    discountPct: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .or(z.nan().transform(() => undefined)),
    discountAmount: z.coerce
      .number()
      .min(0)
      .max(9_999_999.99)
      .optional()
      .or(z.nan().transform(() => undefined)),
  })
  .refine((v) => !(v.discountPct !== undefined && v.discountAmount !== undefined), {
    message: "DISCOUNT_EXCLUSIVE",
    path: ["discountAmount"],
  });

export const createInvoiceSchema = z.object({
  patientId: z.string().min(1),
  /// When provided, seeds the first set of lines from these treatment apps.
  fromApplicationIds: z.array(z.string().min(1)).max(50).default([]),
  /// Manual extra lines on top of the seeded ones.
  extraLines: z.array(lineSchema).max(50).default([]),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const addLineSchema = z.object({
  invoiceId: z.string().min(1),
  line: lineSchema,
});
export type AddLineInput = z.infer<typeof addLineSchema>;

export const updateInvoiceSchema = z.object({
  id: z.string().min(1),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /// Replaces all lines atomically. Empty array deletes them all.
  lines: z.array(lineSchema).max(100),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const emitInvoiceSchema = z.object({
  id: z.string().min(1),
  /// Optional explicit due date. Defaults to now + 30 days when missing.
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type EmitInvoiceInput = z.infer<typeof emitInvoiceSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive().max(9_999_999.99),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  reference: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  receivedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /// Optional link to a payment-plan installment (closes it 1-1).
  installmentId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidInvoiceSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1, "REQUIRED").max(300),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

export const listInvoicesSchema = z.object({
  patientId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z
    .enum(["DRAFT", "EMITTED", "PARTIAL", "PAID", "VOID", "OPEN", "all"])
    .default("all"),
  query: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
