import { z } from "zod";
import { DentalCondition, ToothSurface } from "@prisma/client";

/**
 * FDI permanent dentition validator — quadrants 1-4, tooth positions 1-8.
 * The model can't enforce this via a constraint without a custom check, so
 * every action that takes `toothNumber` runs it through this refine.
 */
const fdiToothNumber = z.coerce
  .number()
  .int()
  .refine(
    (v) => {
      const q = Math.floor(v / 10);
      const t = v % 10;
      return q >= 1 && q <= 4 && t >= 1 && t <= 8;
    },
    { message: "INVALID_TOOTH" },
  );

export const recordEntrySchema = z
  .object({
    patientId: z.string().min(1),
    toothNumber: fdiToothNumber,
    condition: z.nativeEnum(DentalCondition),
    surfaces: z.array(z.nativeEnum(ToothSurface)).max(6).default([]),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    /// Optional ISO date string to backdate the observation; defaults to now.
    recordedAt: z
      .string()
      .datetime()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  /// A healthy tooth shouldn't have surface annotations — keep the data clean.
  .refine((v) => v.condition !== DentalCondition.HEALTHY || v.surfaces.length === 0, {
    message: "HEALTHY_HAS_NO_SURFACES",
    path: ["surfaces"],
  });
export type RecordEntryInput = z.infer<typeof recordEntrySchema>;

export const generatePlanSchema = z.object({
  patientId: z.string().min(1),
  toothNumbers: z.array(fdiToothNumber).min(1).max(32),
});
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
