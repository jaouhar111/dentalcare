"use server";

import { revalidatePath } from "next/cache";
import { SubInvoiceStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { PLAN_PRICING } from "@/lib/billing/plan-pricing";
import { fail, ok, type Result } from "@/lib/utils/result";
import type { SubscriptionInvoiceRow } from "./super-admin-billing-types";

/** Subscription invoices issued to a cabinet (latest first). */
export async function getClinicSubscriptionInvoices(
  clinicId: string,
): Promise<SubscriptionInvoiceRow[]> {
  return db.subscriptionInvoice.findMany({
    where: { clinicId },
    orderBy: { issuedAt: "desc" },
    take: 24,
    select: {
      id: true,
      plan: true,
      amount: true,
      period: true,
      status: true,
      issuedAt: true,
      paidAt: true,
    },
  });
}

/**
 * Issue a subscription invoice for a cabinet's current plan, snapshotting
 * the price at issue time (so a later tariff change leaves history intact).
 * Starter (free) has nothing to bill. Audited.
 */
export async function issueSubscriptionInvoice(args: {
  clinicId: string;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: args.clinicId },
    select: { id: true, plan: true },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable.");
  const price = PLAN_PRICING[clinic.plan];
  if (price.amount <= 0) {
    return fail("INVALID", "Le plan Starter est gratuit — aucune facture à émettre.");
  }
  const period = price.period === "year" ? "an" : "mois";

  const created = await db.subscriptionInvoice.create({
    data: {
      clinicId: clinic.id,
      plan: clinic.plan,
      amount: price.amount,
      period,
      createdById: me.id,
    },
    select: { id: true },
  });
  await audit({
    clinicId: clinic.id,
    userId: me.id,
    action: "superadmin.subscription_invoice.issue",
    entity: "SubscriptionInvoice",
    entityId: created.id,
    payload: { plan: clinic.plan, amount: price.amount, period },
  });
  revalidatePath(`/super-admin/clinics/${clinic.id}`);
  return ok({ id: created.id });
}

/** Mark a subscription invoice as paid. Idempotent, audited. */
export async function markSubscriptionInvoicePaid(args: {
  id: string;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const inv = await db.subscriptionInvoice.findUnique({
    where: { id: args.id },
    select: { id: true, clinicId: true, status: true },
  });
  if (!inv) return fail("NOT_FOUND", "Facture introuvable.");
  if (inv.status === SubInvoiceStatus.PAID) return ok({ id: inv.id });

  await db.subscriptionInvoice.update({
    where: { id: inv.id },
    data: { status: SubInvoiceStatus.PAID, paidAt: new Date() },
  });
  await audit({
    clinicId: inv.clinicId,
    userId: me.id,
    action: "superadmin.subscription_invoice.paid",
    entity: "SubscriptionInvoice",
    entityId: inv.id,
    payload: {},
  });
  revalidatePath(`/super-admin/clinics/${inv.clinicId}`);
  return ok({ id: inv.id });
}
