import type { UserRole } from "@prisma/client";

/**
 * Types shared between the `"use server"` users module and the UI. Kept in
 * a sibling file because Next.js rejects type/interface exports from
 * `"use server"` files.
 */
export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
