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
  /**
   * Cloudinary delivery URL (or empty to remove). Stored as a plain string
   * — we don't keep the `publicId` separately because the URL itself
   * already contains all we need for delivery + delete-on-replace.
   */
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  defaultLocale: z.enum(["fr", "en"]).default("fr"),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
