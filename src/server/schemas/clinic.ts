import { z } from "zod";

export const updateClinicSchema = z.object({
  name: z.string().trim().min(1, "REQUIRED").max(120),
  address: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("INVALID_EMAIL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  vatNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  defaultLocale: z.enum(["fr", "en", "ar"]).default("fr"),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
