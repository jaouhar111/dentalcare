import type { UserRole } from "@prisma/client";

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
}
