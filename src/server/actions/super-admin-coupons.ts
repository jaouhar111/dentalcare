"use server";

import { revalidatePath } from "next/cache";
import { CouponType, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import type { CouponRow } from "./super-admin-coupons-types";

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export async function getCoupons(): Promise<CouponRow[]> {
  await requireRole([UserRole.SUPER_ADMIN]);
  return db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      maxRedemptions: true,
      redemptions: true,
      active: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Create a discount coupon. Stored ready for redemption once online
 * billing is wired (P0). Code is normalised to UPPERCASE and unique.
 */
export async function createCoupon(input: {
  code: string;
  type: CouponType;
  value: number;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const code = (input.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return fail("INVALID", "Code invalide (3–32 caractères : A-Z, 0-9, - _).");
  }
  if (!Number.isInteger(input.value) || input.value <= 0) {
    return fail("INVALID", "La valeur doit être un entier positif.");
  }
  if (input.type === CouponType.PERCENT && input.value > 100) {
    return fail("INVALID", "Un pourcentage ne peut pas dépasser 100.");
  }
  if (
    input.maxRedemptions != null &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions <= 0)
  ) {
    return fail("INVALID", "Le nombre max d'utilisations doit être un entier positif.");
  }
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return fail("INVALID", "Date d'expiration invalide.");
    }
  }

  const exists = await db.coupon.findUnique({ where: { code }, select: { id: true } });
  if (exists) return fail("CONFLICT", "Un coupon avec ce code existe déjà.");

  const created = await db.coupon.create({
    data: {
      code,
      type: input.type,
      value: input.value,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt,
      createdById: me.id,
    },
    select: { id: true },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "superadmin.coupon.create",
    entity: "Coupon",
    entityId: created.id,
    payload: { code, type: input.type, value: input.value },
  });
  revalidatePath("/super-admin/coupons");
  return ok({ id: created.id });
}

/** Activate / deactivate a coupon. Audited. */
export async function setCouponActive(args: {
  id: string;
  active: boolean;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const coupon = await db.coupon.findUnique({
    where: { id: args.id },
    select: { id: true, active: true },
  });
  if (!coupon) return fail("NOT_FOUND", "Coupon introuvable.");
  if (coupon.active === args.active) return ok({ id: coupon.id });

  await db.coupon.update({ where: { id: coupon.id }, data: { active: args.active } });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: args.active ? "superadmin.coupon.activate" : "superadmin.coupon.deactivate",
    entity: "Coupon",
    entityId: coupon.id,
    payload: {},
  });
  revalidatePath("/super-admin/coupons");
  return ok({ id: coupon.id });
}
