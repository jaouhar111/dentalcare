"use server";

import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";
import type { PlatformUser } from "./super-admin-users-types";

/**
 * Cross-tenant user list — every account on the platform, joined with
 * its clinic name. Cap 500 rows; at that scale we'll add pagination.
 */
export async function getPlatformUsers(): Promise<Result<PlatformUser[]>> {
  await requireRole([UserRole.SUPER_ADMIN]);

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      clinic: { select: { id: true, name: true, slug: true } },
    },
  });
  return ok(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      clinicId: u.clinic.id,
      clinicName: u.clinic.name,
      clinicSlug: u.clinic.slug ?? "—",
    })),
  );
}
