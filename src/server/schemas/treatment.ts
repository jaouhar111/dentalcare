import { z } from "zod";
import { ToothSurface, TreatmentApplicationStatus } from "@prisma/client";

// ─── Catalog ────────────────────────────────────────────────────────────────

export const catalogItemBaseSchema = z.object({
  /// Short alphanumeric code — uppercased to keep the catalog readable.
  code: z
    .string()
    .trim()
    .min(1, "REQUIRED")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "INVALID_CODE")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "REQUIRED").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  defaultPrice: z.coerce.number().nonnegative().max(9_999_999.99),
  defaultDurationMin: z.coerce.number().int().min(5).max(480).default(30),
  requiresTooth: z.coerce.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "INVALID_COLOR")
    .default("#0891B2"),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(99999).default(100),
});

export const createCatalogItemSchema = catalogItemBaseSchema;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;

export const updateCatalogItemSchema = catalogItemBaseSchema.extend({
  id: z.string().min(1),
});
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;

// ─── Application ────────────────────────────────────────────────────────────

/**
 * Schema for "apply a treatment from the catalog to a patient (and optionally
 * a specific appointment/tooth)". `unitPrice` is captured at submission time
 * so subsequent catalog price changes don't mutate history.
 *
 * Discount fields are mutually exclusive — enforced at .refine() below.
 */
export const createApplicationSchema = z
  .object({
    patientId: z.string().min(1),
    catalogItemId: z.string().min(1),
    appointmentId: z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    dentistId: z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    /// FDI permanent dentition: quadrant 1-4, tooth 1-8. Validated here.
    toothNumber: z.coerce
      .number()
      .int()
      .refine(
        (v) => {
          const quadrant = Math.floor(v / 10);
          const tooth = v % 10;
          return quadrant >= 1 && quadrant <= 4 && tooth >= 1 && tooth <= 8;
        },
        { message: "INVALID_TOOTH" },
      )
      .optional()
      .or(z.nan().transform(() => undefined)),
    surfaces: z.array(z.nativeEnum(ToothSurface)).max(6).default([]),
    status: z.nativeEnum(TreatmentApplicationStatus).default(TreatmentApplicationStatus.PLANNED),
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
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => !(v.discountPct !== undefined && v.discountAmount !== undefined), {
    message: "DISCOUNT_EXCLUSIVE",
    path: ["discountAmount"],
  });
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationSchema = z
  .object({
    id: z.string().min(1),
    appointmentId: z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    dentistId: z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    toothNumber: z.coerce
      .number()
      .int()
      .refine(
        (v) => {
          const quadrant = Math.floor(v / 10);
          const tooth = v % 10;
          return quadrant >= 1 && quadrant <= 4 && tooth >= 1 && tooth <= 8;
        },
        { message: "INVALID_TOOTH" },
      )
      .optional()
      .or(z.nan().transform(() => undefined)),
    surfaces: z.array(z.nativeEnum(ToothSurface)).max(6).default([]),
    status: z.nativeEnum(TreatmentApplicationStatus),
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
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => !(v.discountPct !== undefined && v.discountAmount !== undefined), {
    message: "DISCOUNT_EXCLUSIVE",
    path: ["discountAmount"],
  });
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
