"use server";

import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";

/**
 * Impersonation (support). A SUPER_ADMIN can temporarily act as a
 * cabinet user to reproduce their context. Implemented with a DB marker
 * (`User.impersonatedUserId`) that the auth `session` callback reads to
 * swap the effective identity — no token re-issue, and any failure
 * falls back to the real identity. Both start and stop are audited.
 *
 * The client performs a full navigation after each call so the new
 * session is picked up everywhere (middleware + layout + page).
 */
export async function startImpersonation(args: {
  userId: string;
}): Promise<Result<{ redirectTo: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  if (args.userId === me.id) {
    return fail("FORBIDDEN", "Vous ne pouvez pas vous impersonner vous-même.");
  }
  const target = await db.user.findUnique({
    where: { id: args.userId },
    select: { id: true, role: true, isActive: true, clinicId: true, email: true },
  });
  if (!target) return fail("NOT_FOUND", "Utilisateur introuvable.");
  if (target.role === UserRole.SUPER_ADMIN) {
    return fail("FORBIDDEN", "Impossible d'impersonner un super-admin.");
  }
  if (!target.isActive) {
    return fail("FORBIDDEN", "Ce compte est désactivé.");
  }

  await db.user.update({
    where: { id: me.id },
    data: { impersonatedUserId: target.id },
  });
  await audit({
    clinicId: target.clinicId,
    userId: me.id,
    action: "superadmin.impersonate.start",
    entity: "User",
    entityId: target.id,
    payload: { email: target.email },
  });
  return ok({ redirectTo: "/dashboard" });
}

/**
 * Stop impersonating and restore the real super-admin session. Reads the
 * impersonator id from the (impersonated) session rather than requiring
 * SUPER_ADMIN — during impersonation the effective role is the target's.
 */
export async function stopImpersonation(): Promise<Result<{ redirectTo: string }>> {
  const session = await auth();
  const impersonatorId = session?.impersonator?.id;
  if (!impersonatorId) {
    return fail("FORBIDDEN", "Aucune impersonation en cours.");
  }
  await db.user.update({
    where: { id: impersonatorId },
    data: { impersonatedUserId: null },
  });
  await audit({
    clinicId: session.user.clinicId,
    userId: impersonatorId,
    action: "superadmin.impersonate.stop",
    entity: "User",
    entityId: session.user.id,
    payload: {},
  });
  return ok({ redirectTo: "/super-admin" });
}
