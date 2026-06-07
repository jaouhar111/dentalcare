"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetUserPasswordInput,
  type UpdateUserInput,
} from "@/server/schemas/user";
import type { UserListItem } from "./users-types";

const ADMIN_ONLY = [UserRole.ADMIN] as const;

function zodFieldsFromError(error: unknown): Record<string, string[]> {
  if (!(error instanceof Object) || !("issues" in error)) return {};
  const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

export async function listUsers(): Promise<Result<UserListItem[]>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const rows = await db.user.findMany({
    where: { clinicId: user.clinicId },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });
  return ok(
    rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  );
}

export async function createUser(raw: CreateUserInput): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ADMIN_ONLY]);
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid user", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  // Email is globally unique (multi-clinic invitations). Surface a clean
  // error instead of letting the DB constraint blow up.
  const dup = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (dup) return fail("DUPLICATE_EMAIL", "Email already in use", { email: ["DUPLICATE"] });

  // Plan cap — Starter = 1 user, Pro = 5, Cabinet+ = unlimited.
  const [clinic, currentCount] = await Promise.all([
    db.clinic.findUnique({
      where: { id: me.clinicId },
      select: { plan: true, subscriptionStatus: true },
    }),
    db.user.count({ where: { clinicId: me.clinicId } }),
  ]);
  if (clinic) {
    const { capabilitiesFor, planLabel } = await import(
      "@/lib/billing/plan-capabilities"
    );
    const caps = capabilitiesFor({
      plan: clinic.plan,
      subscriptionStatus: clinic.subscriptionStatus,
    });
    if (currentCount >= caps.users) {
      return fail(
        "PLAN_LIMIT",
        `Votre plan ${planLabel(clinic.plan)} est limité à ${caps.users} utilisateur${caps.users > 1 ? "s" : ""}. Passez à un plan supérieur pour en inviter davantage.`,
      );
    }
  }

  const passwordHash = await hashPassword(data.password);
  const created = await db.user.create({
    data: {
      clinicId: me.clinicId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      isActive: data.isActive,
      passwordHash,
    },
    select: { id: true },
  });

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "create",
    entity: "User",
    entityId: created.id,
    payload: { email: data.email, role: data.role },
  });
  revalidatePath("/[locale]/users", "page");
  return ok({ id: created.id });
}

export async function updateUser(raw: UpdateUserInput): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ADMIN_ONLY]);
  const parsed = updateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid user", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.user.findFirst({
    where: { id: data.id, clinicId: me.clinicId },
    select: { id: true, role: true },
  });
  if (!existing) return fail("NOT_FOUND", "User not found");

  // Safety guard: don't let the only active admin downgrade or deactivate
  // themselves — that would lock out the clinic.
  if (data.id === me.id && (data.role !== UserRole.ADMIN || !data.isActive)) {
    const otherAdmins = await db.user.count({
      where: {
        clinicId: me.clinicId,
        role: UserRole.ADMIN,
        isActive: true,
        NOT: { id: me.id },
      },
    });
    if (otherAdmins === 0) {
      return fail("LAST_ADMIN", "Cannot demote or disable the last active admin");
    }
  }

  await db.user.update({
    where: { id: data.id },
    data: { fullName: data.fullName, role: data.role, isActive: data.isActive },
  });

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "update",
    entity: "User",
    entityId: data.id,
  });
  revalidatePath("/[locale]/users", "page");
  return ok({ id: data.id });
}

export async function resetUserPassword(
  raw: ResetUserPasswordInput,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ADMIN_ONLY]);
  const parsed = resetUserPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid password", zodFieldsFromError(parsed.error));
  }
  const existing = await db.user.findFirst({
    where: { id: parsed.data.id, clinicId: me.clinicId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "User not found");

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({
    where: { id: parsed.data.id },
    data: { passwordHash },
  });

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "resetPassword",
    entity: "User",
    entityId: parsed.data.id,
  });
  return ok({ id: parsed.data.id });
}
