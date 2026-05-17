import { z } from "zod";
import { UserRole } from "@prisma/client";

export const createUserSchema = z.object({
  email: z.string().email("INVALID_EMAIL").toLowerCase().trim(),
  fullName: z.string().trim().min(1, "REQUIRED").max(120),
  role: z.nativeEnum(UserRole),
  /// Initial password — minimum 8 chars. Admin sets it, user changes on first login.
  password: z.string().min(8, "PASSWORD_TOO_SHORT").max(128),
  isActive: z.coerce.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1, "REQUIRED").max(120),
  role: z.nativeEnum(UserRole),
  isActive: z.coerce.boolean(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetUserPasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "PASSWORD_TOO_SHORT").max(128),
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
