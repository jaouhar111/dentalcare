"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import { requestPasswordResetAction } from "./password-reset";
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

/**
 * Activate / deactivate a user account (support lock-out + recovery).
 * Guards: a super-admin can't touch their own account, and SUPER_ADMIN
 * accounts can't be deactivated from this UI (use the provisioning
 * script). Writes an audit entry on every change.
 */
export async function setUserActive(args: {
  userId: string;
  isActive: boolean;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  if (args.userId === me.id) {
    return fail("FORBIDDEN", "Vous ne pouvez pas modifier votre propre compte.");
  }
  const target = await db.user.findUnique({
    where: { id: args.userId },
    select: { id: true, role: true, isActive: true, clinicId: true, email: true },
  });
  if (!target) return fail("NOT_FOUND", "Utilisateur introuvable.");
  if (target.role === UserRole.SUPER_ADMIN) {
    return fail("FORBIDDEN", "Impossible de désactiver un super-admin depuis cette page.");
  }
  if (target.isActive === args.isActive) return ok({ id: target.id });

  await db.user.update({
    where: { id: target.id },
    data: { isActive: args.isActive },
  });
  await audit({
    clinicId: target.clinicId,
    userId: me.id,
    action: args.isActive ? "superadmin.user.reactivate" : "superadmin.user.deactivate",
    entity: "User",
    entityId: target.id,
    payload: { email: target.email, from: target.isActive, to: args.isActive },
  });
  revalidatePath("/super-admin/users");
  return ok({ id: target.id });
}

/**
 * Trigger a password-reset email for a user (support: "I'm locked out").
 * Reuses the public reset flow so the token + email handling stays in one
 * place. Audited; the email itself never carries the password.
 */
export async function sendUserPasswordReset(args: {
  userId: string;
}): Promise<Result<{ email: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const target = await db.user.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, clinicId: true },
  });
  if (!target) return fail("NOT_FOUND", "Utilisateur introuvable.");

  const res = await requestPasswordResetAction({ email: target.email });
  if (!res.ok) return res;

  await audit({
    clinicId: target.clinicId,
    userId: me.id,
    action: "superadmin.user.passwordResetSent",
    entity: "User",
    entityId: target.id,
    payload: { email: target.email },
  });
  revalidatePath("/super-admin/users");
  return ok({ email: target.email });
}
