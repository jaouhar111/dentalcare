import { z } from "zod";
import { BloodGroup, CommunicationChannel, Gender } from "@prisma/client";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";

const phoneSchema = z
  .string()
  .min(1, "REQUIRED")
  .transform((v, ctx) => {
    const normalized = normalizeMoroccanPhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INVALID_PHONE",
      });
      return z.NEVER;
    }
    return normalized;
  });

const allergiesSchema = z.array(z.string().trim().min(1).max(80)).max(40).default([]);

/** Shared base; create vs update wrap this with different rules around `id`/`clinicId`. */
export const patientBaseSchema = z.object({
  firstName: z.string().trim().min(1, "REQUIRED").max(80),
  lastName: z.string().trim().min(1, "REQUIRED").max(80),
  cin: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("INVALID_EMAIL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /// ISO date string (yyyy-mm-dd) coming from <input type="date">.
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "INVALID_DATE")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "INVALID_DATE" }),
  gender: z
    .nativeEnum(Gender)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  bloodGroup: z
    .nativeEnum(BloodGroup)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  medicalHistory: z.string().trim().max(2000).optional(),
  preferredChannel: z.nativeEnum(CommunicationChannel).default(CommunicationChannel.WHATSAPP),
  preferredLocale: z.enum(["fr", "en", "ar"]).default("fr"),
  photoConsent: z.coerce.boolean().default(false),
  allergies: allergiesSchema,
});

export const createPatientSchema = patientBaseSchema;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = patientBaseSchema.extend({
  id: z.string().min(1),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const listPatientsSchema = z.object({
  query: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).default(1),
  /// Allow small page sizes for autocomplete pickers (1–100).
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListPatientsInput = z.infer<typeof listPatientsSchema>;
