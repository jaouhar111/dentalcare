import { z } from "zod";
import { StockMovementType } from "@prisma/client";

export const stockItemBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "REQUIRED")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "INVALID_CODE")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "REQUIRED").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  unit: z.string().trim().min(1).max(20).default("unité"),
  lowStockAt: z.coerce
    .number()
    .int()
    .min(0)
    .max(99_999)
    .optional()
    .or(z.nan().transform(() => undefined)),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isActive: z.coerce.boolean().default(true),
  /// Optional starting quantity recorded as an OPENING movement at creation.
  openingQuantity: z.coerce
    .number()
    .int()
    .min(0)
    .max(99_999)
    .optional()
    .or(z.nan().transform(() => undefined)),
});

export const createStockItemSchema = stockItemBaseSchema;
export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;

export const updateStockItemSchema = stockItemBaseSchema
  .omit({ openingQuantity: true })
  .extend({ id: z.string().min(1) });
export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;

export const recordMovementSchema = z.object({
  itemId: z.string().min(1),
  type: z.nativeEnum(StockMovementType),
  /// Positive integer; the action layer flips the sign for outgoing types.
  quantity: z.coerce.number().int().min(1).max(99_999),
  unitPrice: z.coerce
    .number()
    .nonnegative()
    .max(9_999_999.99)
    .optional()
    .or(z.nan().transform(() => undefined)),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type RecordMovementInput = z.infer<typeof recordMovementSchema>;
