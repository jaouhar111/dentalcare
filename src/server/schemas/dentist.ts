import { z } from "zod";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";

const phoneSchema = z
  .string()
  .max(40)
  .optional()
  .transform((v, ctx) => {
    if (!v || v.trim() === "") return undefined;
    const normalized = normalizeMoroccanPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "INVALID_PHONE" });
      return z.NEVER;
    }
    return normalized;
  });

/** Hex like `#0891B2`, case-insensitive. Stored uppercase. */
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "INVALID_COLOR")
  .transform((v) => v.toUpperCase());

/** "HH:MM" 24-hour clock. */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "INVALID_TIME");

export const dentistBaseSchema = z.object({
  firstName: z.string().trim().min(1, "REQUIRED").max(80),
  lastName: z.string().trim().min(1, "REQUIRED").max(80),
  specialty: z.string().trim().max(120).optional(),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("INVALID_EMAIL")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  color: colorSchema.default("#0891B2"),
  photoUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const createDentistSchema = dentistBaseSchema;
export type CreateDentistInput = z.infer<typeof createDentistSchema>;

export const updateDentistSchema = dentistBaseSchema.extend({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type UpdateDentistInput = z.infer<typeof updateDentistSchema>;

const scheduleRangeSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((v) => v.startTime < v.endTime, { message: "RANGE_INVERTED" });

export const setScheduleSchema = z.object({
  dentistId: z.string().min(1),
  schedules: z.array(scheduleRangeSchema).max(50),
});
export type SetScheduleInput = z.infer<typeof setScheduleSchema>;

export const addAbsenceSchema = z
  .object({
    dentistId: z.string().min(1),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => new Date(v.startAt) < new Date(v.endAt), {
    message: "RANGE_INVERTED",
    path: ["endAt"],
  });
export type AddAbsenceInput = z.infer<typeof addAbsenceSchema>;
