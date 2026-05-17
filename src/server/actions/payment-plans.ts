"use server";

import { revalidatePath } from "next/cache";
import {
  InstallmentStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentPlanStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  cancelPlanSchema,
  createPlanSchema,
  type CancelPlanInput,
  type CreatePlanInput,
} from "@/server/schemas/payment-plan";
import type {
  InstallmentDisplayStatus,
  InstallmentLite,
  PaymentPlanDetail,
} from "./payment-plans-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;

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

/** Adds N months to a date, clamping the day when the target month is shorter. */
function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const targetMonth = out.getMonth() + n;
  out.setMonth(targetMonth);
  // If `setMonth` rolled over (e.g. Jan 31 + 1 = Mar 3), back up to the last
  // day of the intended month.
  if (out.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    out.setDate(0);
  }
  return out;
}

function computeDisplayStatus(
  status: InstallmentStatus,
  dueDate: Date,
): InstallmentDisplayStatus {
  if (status !== InstallmentStatus.PENDING) return status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today ? "OVERDUE" : InstallmentStatus.PENDING;
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getPaymentPlanForInvoice(
  invoiceId: string,
): Promise<Result<PaymentPlanDetail | null>> {
  const user = await requireRole([...ANY_STAFF]);
  const plan = await db.paymentPlan.findFirst({
    where: { invoiceId, clinicId: user.clinicId },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      patient: { select: { firstName: true, lastName: true, phone: true } },
    },
  });
  if (!plan) return ok(null);

  const installments: InstallmentLite[] = plan.installments.map((i) => ({
    id: i.id,
    sequence: i.sequence,
    dueDate: i.dueDate,
    amount: Number(i.amount),
    status: i.status,
    displayStatus: computeDisplayStatus(i.status, i.dueDate),
    paidAt: i.paidAt,
    reminderJ3SentAt: i.reminderJ3SentAt,
    reminderJ1SentAt: i.reminderJ1SentAt,
  }));
  const remaining = installments
    .filter((i) => i.status !== InstallmentStatus.PAID && i.status !== InstallmentStatus.CANCELLED)
    .reduce((s, i) => s + i.amount, 0);
  const overdueCount = installments.filter((i) => i.displayStatus === "OVERDUE").length;

  return ok({
    id: plan.id,
    invoiceId: plan.invoiceId,
    patientId: plan.patientId,
    patientName: `${plan.patient.firstName} ${plan.patient.lastName}`,
    patientPhone: plan.patient.phone,
    installmentsCount: plan.installmentsCount,
    totalAmount: Number(plan.totalAmount),
    remainingAmount: remaining,
    status: plan.status,
    startDate: plan.startDate,
    notes: plan.notes,
    overdueCount,
    installments,
    createdAt: plan.createdAt,
  });
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createPaymentPlan(
  raw: CreatePlanInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid plan", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id: data.invoiceId, clinicId: user.clinicId },
    include: {
      paymentPlan: { select: { id: true } },
      payments: { select: { amount: true } },
    },
  });
  if (!inv) return fail("INVOICE_NOT_FOUND", "Invoice not found");
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
    return fail("INVOICE_NOT_PAYABLE", "Invoice must be emitted to attach a plan");
  }
  if (inv.paymentPlan) {
    return fail("PLAN_EXISTS", "Invoice already has a payment plan");
  }

  const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(inv.total) - paid;
  const downPayment = Math.min(data.downPayment ?? 0, remaining);
  const planTotal = remaining - downPayment;
  if (planTotal <= 0.005) {
    return fail("NOTHING_TO_PLAN", "Invoice is already (almost) paid");
  }

  // Spread the plan total across N installments. We round each installment to
  // 2 decimals and adjust the last one to absorb the rounding remainder.
  const baseAmount = Math.floor((planTotal * 100) / data.installmentsCount) / 100;
  const amounts = Array.from({ length: data.installmentsCount }, (_, i) =>
    i === data.installmentsCount - 1
      ? Math.round((planTotal - baseAmount * (data.installmentsCount - 1)) * 100) / 100
      : baseAmount,
  );
  const startDate = new Date(`${data.startDate}T12:00:00`);

  const planId = await db.$transaction(async (tx) => {
    const plan = await tx.paymentPlan.create({
      data: {
        clinicId: user.clinicId,
        patientId: inv.patientId,
        invoiceId: inv.id,
        installmentsCount: data.installmentsCount,
        totalAmount: planTotal,
        status: PaymentPlanStatus.ACTIVE,
        startDate,
        notes: data.notes ?? null,
        createdById: user.id,
        installments: {
          create: amounts.map((amount, i) => ({
            sequence: i + 1,
            dueDate: addMonths(startDate, i),
            amount,
            status: InstallmentStatus.PENDING,
          })),
        },
      },
      select: { id: true },
    });

    // If a down-payment was provided, record it as a Payment now.
    if (downPayment > 0.005) {
      await tx.payment.create({
        data: {
          clinicId: user.clinicId,
          invoiceId: inv.id,
          amount: downPayment,
          method: PaymentMethod.CASH,
          notes: "Acompte plan de paiement",
          createdById: user.id,
        },
      });
      // Update invoice status to PARTIAL if needed.
      const newPaid = paid + downPayment;
      const total = Number(inv.total);
      const next: InvoiceStatus =
        newPaid >= total ? InvoiceStatus.PAID :
        newPaid > 0 ? InvoiceStatus.PARTIAL : inv.status;
      if (next !== inv.status) {
        await tx.invoice.update({ where: { id: inv.id }, data: { status: next } });
      }
    }
    return plan.id;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "PaymentPlan",
    entityId: planId,
    payload: {
      invoiceId: inv.id,
      installments: data.installmentsCount,
      downPayment,
    },
  });

  revalidatePath(`/[locale]/invoices/${inv.id}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  return ok({ id: planId });
}

export async function cancelPaymentPlan(
  raw: CancelPlanInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = cancelPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const plan = await db.paymentPlan.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, invoiceId: true, patientId: true, status: true },
  });
  if (!plan) return fail("NOT_FOUND", "Plan not found");
  if (plan.status !== PaymentPlanStatus.ACTIVE) {
    return fail("ALREADY_CLOSED", "Plan is not active");
  }

  await db.$transaction(async (tx) => {
    await tx.paymentPlan.update({
      where: { id: data.id },
      data: { status: PaymentPlanStatus.CANCELLED },
    });
    // Cancel only unpaid installments — paid ones are historical.
    await tx.paymentPlanInstallment.updateMany({
      where: { planId: data.id, status: InstallmentStatus.PENDING },
      data: { status: InstallmentStatus.CANCELLED },
    });
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "cancel",
    entity: "PaymentPlan",
    entityId: data.id,
    payload: { reason: data.reason },
  });

  revalidatePath(`/[locale]/invoices/${plan.invoiceId}`, "page");
  revalidatePath(`/[locale]/patients/${plan.patientId}`, "page");
  return ok({ id: data.id });
}

/**
 * Lists all payment plans for a patient (active + closed) with their summary.
 * Used by the "Plans paiement" tab on the patient detail page.
 */
export async function listPaymentPlansForPatient(
  patientId: string,
): Promise<Result<PaymentPlanDetail[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const plans = await db.paymentPlan.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { createdAt: "desc" },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      patient: { select: { firstName: true, lastName: true, phone: true } },
      invoice: { select: { number: true } },
    },
  });

  return ok(
    plans.map((plan) => {
      const installments: InstallmentLite[] = plan.installments.map((i) => ({
        id: i.id,
        sequence: i.sequence,
        dueDate: i.dueDate,
        amount: Number(i.amount),
        status: i.status,
        displayStatus: computeDisplayStatus(i.status, i.dueDate),
        paidAt: i.paidAt,
        reminderJ3SentAt: i.reminderJ3SentAt,
        reminderJ1SentAt: i.reminderJ1SentAt,
      }));
      const remaining = installments
        .filter(
          (i) => i.status !== InstallmentStatus.PAID && i.status !== InstallmentStatus.CANCELLED,
        )
        .reduce((s, i) => s + i.amount, 0);
      const overdueCount = installments.filter((i) => i.displayStatus === "OVERDUE").length;
      return {
        id: plan.id,
        invoiceId: plan.invoiceId,
        patientId: plan.patientId,
        patientName: `${plan.patient.firstName} ${plan.patient.lastName}`,
        patientPhone: plan.patient.phone,
        installmentsCount: plan.installmentsCount,
        totalAmount: Number(plan.totalAmount),
        remainingAmount: remaining,
        status: plan.status,
        startDate: plan.startDate,
        notes: plan.notes,
        overdueCount,
        installments,
        createdAt: plan.createdAt,
      };
    }),
  );
}

/**
 * Lists all overdue installments — used by the cron and by an admin view.
 * "Overdue" = PENDING + dueDate < today.
 */
export async function listOverdueInstallments() {
  const user = await requireRole([...ANY_STAFF]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.paymentPlanInstallment.findMany({
    where: {
      status: InstallmentStatus.PENDING,
      dueDate: { lt: today },
      plan: { clinicId: user.clinicId, status: PaymentPlanStatus.ACTIVE },
    },
    include: {
      plan: {
        include: {
          patient: { select: { firstName: true, lastName: true, phone: true } },
          invoice: { select: { number: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}
