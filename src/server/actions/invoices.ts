"use server";

import { revalidatePath } from "next/cache";
import {
  InvoiceStatus,
  Prisma,
  TreatmentApplicationStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  addLineSchema,
  createInvoiceSchema,
  emitInvoiceSchema,
  listInvoicesSchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
  type AddLineInput,
  type CreateInvoiceInput,
  type EmitInvoiceInput,
  type ListInvoicesInput,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
  type VoidInvoiceInput,
} from "@/server/schemas/invoice";
import type { InvoiceDetail, InvoiceListItem } from "./invoices-types";

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

/**
 * Computes line total = qty * unitPrice - discount (pct preferred over amount
 * when both are present, mirroring the rule enforced by the schema refine).
 */
function lineTotal(input: {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
}): number {
  const gross = input.quantity * input.unitPrice;
  if (input.discountPct != null) return Math.max(0, gross - (gross * input.discountPct) / 100);
  if (input.discountAmount != null) return Math.max(0, gross - input.discountAmount);
  return gross;
}

/// Recomputes subtotal/discount/total for an invoice from its lines and
/// writes them back. Used after every line mutation.
async function refreshInvoiceTotals(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<{ subtotal: number; discount: number; total: number }> {
  const lines = await tx.invoiceLine.findMany({
    where: { invoiceId },
    select: { quantity: true, unitPrice: true, discountPct: true, discountAmount: true, lineTotal: true },
  });
  let subtotal = 0;
  let discount = 0;
  let total = 0;
  for (const l of lines) {
    const gross = l.quantity * Number(l.unitPrice);
    subtotal += gross;
    total += Number(l.lineTotal);
  }
  discount = Math.max(0, subtotal - total);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, discountAmount: discount, total },
  });
  return { subtotal, discount, total };
}

/// Recomputes payment status given the current sum of payments. Run after
/// recordPayment or paymentless transitions to avoid drift.
async function refreshPaymentStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<void> {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, total: true },
  });
  if (!inv) return;
  // Don't touch DRAFT or VOID — they never become PARTIAL/PAID via payments.
  if (inv.status !== InvoiceStatus.EMITTED && inv.status !== InvoiceStatus.PARTIAL && inv.status !== InvoiceStatus.PAID) {
    return;
  }
  const agg = await tx.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const paid = Number(agg._sum.amount ?? 0);
  const total = Number(inv.total);
  let next: InvoiceStatus;
  if (paid >= total && total > 0) next = InvoiceStatus.PAID;
  else if (paid > 0) next = InvoiceStatus.PARTIAL;
  else next = InvoiceStatus.EMITTED;
  if (next !== inv.status) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: next } });
  }
}

// ─── List / detail ──────────────────────────────────────────────────────────

export async function listInvoices(
  raw: ListInvoicesInput = {} as ListInvoicesInput,
): Promise<Result<{ items: InvoiceListItem[]; total: number; page: number; pageSize: number }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = listInvoicesSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid params", zodFieldsFromError(parsed.error));
  }
  const { patientId, status, query, page, pageSize } = parsed.data;

  const where: Prisma.InvoiceWhereInput = { clinicId: user.clinicId };
  if (patientId) where.patientId = patientId;
  // "OPEN" filter helps the dashboard surface unpaid invoices quickly.
  if (status === "OPEN") where.status = { in: [InvoiceStatus.EMITTED, InvoiceStatus.PARTIAL] };
  else if (status !== "all") where.status = status;
  if (query) {
    where.OR = [
      { number: { contains: query, mode: "insensitive" } },
      {
        patient: {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: [{ emittedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        payments: { select: { amount: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);

  const now = new Date();
  const items: InvoiceListItem[] = rows.map((r) => {
    const totalNum = Number(r.total);
    const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    const isOverdue =
      (r.status === InvoiceStatus.EMITTED || r.status === InvoiceStatus.PARTIAL) &&
      r.dueDate !== null &&
      r.dueDate < now;
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      patientId: r.patientId,
      patientName: `${r.patient.firstName} ${r.patient.lastName}`,
      emittedAt: r.emittedAt,
      dueDate: r.dueDate,
      total: totalNum,
      paid,
      remaining: Math.max(0, totalNum - paid),
      isOverdue,
      createdAt: r.createdAt,
    };
  });

  return ok({ items, total, page, pageSize });
}

export async function getInvoice(id: string): Promise<Result<InvoiceDetail>> {
  const user = await requireRole([...ANY_STAFF]);
  const row = await db.invoice.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          cin: true,
          dob: true,
        },
      },
      clinic: {
        select: { name: true, address: true, phone: true, vatNumber: true, logoUrl: true },
      },
      lines: { orderBy: { sortOrder: "asc" } },
      payments: {
        orderBy: { receivedAt: "desc" },
        include: { createdBy: { select: { fullName: true } } },
      },
      paymentPlan: { select: { id: true } },
    },
  });
  if (!row) return fail("NOT_FOUND", "Invoice not found");

  const totalNum = Number(row.total);
  const paid = row.payments.reduce((s, p) => s + Number(p.amount), 0);
  const isOverdue =
    (row.status === InvoiceStatus.EMITTED || row.status === InvoiceStatus.PARTIAL) &&
    row.dueDate !== null &&
    row.dueDate < new Date();

  return ok({
    id: row.id,
    number: row.number,
    status: row.status,
    patientId: row.patientId,
    patientName: `${row.patient.firstName} ${row.patient.lastName}`,
    emittedAt: row.emittedAt,
    dueDate: row.dueDate,
    total: totalNum,
    paid,
    remaining: Math.max(0, totalNum - paid),
    isOverdue,
    createdAt: row.createdAt,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discountAmount),
    notes: row.notes,
    voidedAt: row.voidedAt,
    voidedReason: row.voidedReason,
    lines: row.lines.map((l) => ({
      id: l.id,
      description: l.description,
      toothNumber: l.toothNumber,
      quantity: l.quantity,
      unitPrice: Number(l.unitPrice),
      discountPct: l.discountPct != null ? Number(l.discountPct) : null,
      discountAmount: l.discountAmount != null ? Number(l.discountAmount) : null,
      lineTotal: Number(l.lineTotal),
      sortOrder: l.sortOrder,
      treatmentApplicationId: l.treatmentApplicationId,
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      receivedAt: p.receivedAt,
      notes: p.notes,
      installmentId: p.installmentId,
      recordedByName: p.createdBy.fullName,
    })),
    patientPhone: row.patient.phone,
    patientCin: row.patient.cin,
    patientDob: row.patient.dob,
    clinicName: row.clinic.name,
    clinicAddress: row.clinic.address,
    clinicPhone: row.clinic.phone,
    clinicVatNumber: row.clinic.vatNumber,
    clinicLogoUrl: row.clinic.logoUrl,
    hasPaymentPlan: row.paymentPlan !== null,
  });
}

// ─── Create / mutate ────────────────────────────────────────────────────────

export async function createInvoice(
  raw: CreateInvoiceInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid invoice", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await db.patient.findFirst({
    where: { id: data.patientId, clinicId: user.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  // Load referenced treatment applications so we can seed lines from them.
  const apps = data.fromApplicationIds.length
    ? await db.treatmentApplication.findMany({
        where: {
          id: { in: data.fromApplicationIds },
          clinicId: user.clinicId,
          patientId: data.patientId,
        },
        include: { catalogItem: { select: { name: true } } },
      })
    : [];

  const id = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        clinicId: user.clinicId,
        patientId: data.patientId,
        status: InvoiceStatus.DRAFT,
        notes: data.notes ?? null,
        createdById: user.id,
      },
      select: { id: true },
    });

    // Seed lines from selected treatment applications.
    const seedLines = apps.map((a, i) => {
      const lineGrossPerUnit = Number(a.unitPrice);
      const pct = a.discountPct != null ? Number(a.discountPct) : null;
      const amt = a.discountAmount != null ? Number(a.discountAmount) : null;
      const total = lineTotal({
        quantity: 1,
        unitPrice: lineGrossPerUnit,
        discountPct: pct,
        discountAmount: amt,
      });
      const desc = `${a.catalogItem.name}${a.toothNumber ? ` — dent ${a.toothNumber}` : ""}`;
      return {
        invoiceId: inv.id,
        treatmentApplicationId: a.id,
        description: desc,
        toothNumber: a.toothNumber,
        quantity: 1,
        unitPrice: lineGrossPerUnit,
        discountPct: pct,
        discountAmount: amt,
        lineTotal: total,
        sortOrder: (i + 1) * 10,
      };
    });
    // Append manual extras after the seeded ones.
    const extraLines = data.extraLines.map((l, i) => ({
      invoiceId: inv.id,
      treatmentApplicationId: l.treatmentApplicationId ?? null,
      description: l.description,
      toothNumber: l.toothNumber ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct ?? null,
      discountAmount: l.discountAmount ?? null,
      lineTotal: lineTotal(l),
      sortOrder: (seedLines.length + i + 1) * 10,
    }));

    if (seedLines.length + extraLines.length > 0) {
      await tx.invoiceLine.createMany({ data: [...seedLines, ...extraLines] });
    }

    await refreshInvoiceTotals(tx, inv.id);
    return inv.id;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "Invoice",
    entityId: id,
    payload: { patientId: data.patientId, fromApps: data.fromApplicationIds.length },
  });

  revalidatePath(`/[locale]/invoices`, "page");
  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id });
}

export async function addInvoiceLine(raw: AddLineInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = addLineSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid line", zodFieldsFromError(parsed.error));
  }
  const { invoiceId, line } = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, clinicId: user.clinicId },
    select: { id: true, status: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== InvoiceStatus.DRAFT) {
    return fail("NOT_EDITABLE", "Invoice must be DRAFT to edit lines");
  }

  await db.$transaction(async (tx) => {
    const max = await tx.invoiceLine.aggregate({
      where: { invoiceId },
      _max: { sortOrder: true },
    });
    const nextSort = (max._max.sortOrder ?? 0) + 10;
    await tx.invoiceLine.create({
      data: {
        invoiceId,
        treatmentApplicationId: line.treatmentApplicationId ?? null,
        description: line.description,
        toothNumber: line.toothNumber ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPct: line.discountPct ?? null,
        discountAmount: line.discountAmount ?? null,
        lineTotal: lineTotal(line),
        sortOrder: nextSort,
      },
    });
    await refreshInvoiceTotals(tx, invoiceId);
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "addLine",
    entity: "Invoice",
    entityId: invoiceId,
  });
  revalidatePath(`/[locale]/invoices/${invoiceId}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id: invoiceId });
}

export async function removeInvoiceLine(args: {
  invoiceId: string;
  lineId: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const inv = await db.invoice.findFirst({
    where: { id: args.invoiceId, clinicId: user.clinicId },
    select: { id: true, status: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== InvoiceStatus.DRAFT) {
    return fail("NOT_EDITABLE", "Invoice must be DRAFT to edit lines");
  }

  await db.$transaction(async (tx) => {
    await tx.invoiceLine.delete({ where: { id: args.lineId } });
    await refreshInvoiceTotals(tx, args.invoiceId);
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "removeLine",
    entity: "Invoice",
    entityId: args.invoiceId,
  });
  revalidatePath(`/[locale]/invoices/${args.invoiceId}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id: args.invoiceId });
}

export async function updateInvoice(
  raw: UpdateInvoiceInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = updateInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid invoice", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, status: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== InvoiceStatus.DRAFT) {
    return fail("NOT_EDITABLE", "Invoice must be DRAFT to edit");
  }

  await db.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: data.id } });
    if (data.lines.length > 0) {
      await tx.invoiceLine.createMany({
        data: data.lines.map((l, i) => ({
          invoiceId: data.id,
          treatmentApplicationId: l.treatmentApplicationId ?? null,
          description: l.description,
          toothNumber: l.toothNumber ?? null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct ?? null,
          discountAmount: l.discountAmount ?? null,
          lineTotal: lineTotal(l),
          sortOrder: (i + 1) * 10,
        })),
      });
    }
    await tx.invoice.update({
      where: { id: data.id },
      data: { notes: data.notes ?? null },
    });
    await refreshInvoiceTotals(tx, data.id);
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "Invoice",
    entityId: data.id,
  });
  revalidatePath(`/[locale]/invoices/${data.id}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id: data.id });
}

// ─── Emit / void ────────────────────────────────────────────────────────────

export async function emitInvoice(
  raw: EmitInvoiceInput,
): Promise<Result<{ id: string; number: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = emitInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, status: true, total: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== InvoiceStatus.DRAFT) {
    return fail("ALREADY_EMITTED", "Invoice is not a draft");
  }
  if (Number(inv.total) <= 0) {
    return fail("EMPTY_INVOICE", "Cannot emit an invoice with no positive total");
  }

  const number = await db.$transaction(async (tx) => {
    // Pull next number under an advisory lock (see the SQL function).
    const rows = await tx.$queryRaw<Array<{ next_invoice_number: string }>>(
      Prisma.sql`SELECT next_invoice_number(${user.clinicId}::text) AS next_invoice_number`,
    );
    const n = rows[0]?.next_invoice_number;
    if (!n) throw new Error("Failed to allocate invoice number");

    const emittedAt = new Date();
    const dueDate = data.dueDate
      ? new Date(`${data.dueDate}T12:00:00`)
      : new Date(emittedAt.getTime() + 30 * 86_400_000);
    await tx.invoice.update({
      where: { id: data.id },
      data: {
        status: InvoiceStatus.EMITTED,
        number: n,
        emittedAt,
        dueDate,
      },
    });
    return n;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "emit",
    entity: "Invoice",
    entityId: data.id,
    payload: { number },
  });
  revalidatePath(`/[locale]/invoices/${data.id}`, "page");
  revalidatePath(`/[locale]/invoices`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id: data.id, number });
}

/**
 * Hard-delete a DRAFT invoice + its lines. Only DRAFTs are eligible because
 * emitted invoices have an assigned legal number and a chain of payments
 * that we never want to break — use `voidInvoice` for those instead.
 *
 * Cascades through the schema's `onDelete: Cascade` on InvoiceLine; the
 * parent transaction is implicit (no payments/plans can be linked to a
 * DRAFT by construction).
 */
export async function deleteInvoice(
  id: string,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const inv = await db.invoice.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true, patientId: true, number: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== InvoiceStatus.DRAFT) {
    return fail(
      "NOT_DRAFT",
      "Seules les factures en brouillon peuvent être supprimées. Utilisez « Annuler » pour les autres.",
    );
  }

  await db.invoice.delete({ where: { id } });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "Invoice",
    entityId: id,
    payload: { wasDraft: true, number: inv.number },
  });

  revalidatePath(`/[locale]/invoices`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id });
}

export async function voidInvoice(
  raw: VoidInvoiceInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = voidInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const { id, reason } = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status === InvoiceStatus.VOID) {
    return fail("ALREADY_VOID", "Already voided");
  }
  if (inv.status === InvoiceStatus.PAID) {
    return fail("PAID_NOT_VOIDABLE", "Cannot void a fully paid invoice");
  }

  await db.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.VOID, voidedAt: new Date(), voidedReason: reason },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "void",
    entity: "Invoice",
    entityId: id,
    payload: { reason },
  });
  revalidatePath(`/[locale]/invoices/${id}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id });
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function recordPayment(
  raw: RecordPaymentInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = recordPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid payment", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const inv = await db.invoice.findFirst({
    where: { id: data.invoiceId, clinicId: user.clinicId },
    select: { id: true, status: true, total: true, patientId: true },
  });
  if (!inv) return fail("NOT_FOUND", "Invoice not found");
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID) {
    return fail("INVOICE_NOT_PAYABLE", "Invoice is not in a payable state");
  }

  // Prevent over-payment: clamp at the remaining balance.
  const agg = await db.payment.aggregate({
    where: { invoiceId: data.invoiceId },
    _sum: { amount: true },
  });
  const remaining = Math.max(0, Number(inv.total) - Number(agg._sum.amount ?? 0));
  if (data.amount - remaining > 0.005) {
    return fail("OVERPAYMENT", "Amount exceeds remaining balance", {
      amount: ["OVERPAYMENT"],
    });
  }

  const paymentId = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        clinicId: user.clinicId,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        reference: data.reference ?? null,
        receivedAt: data.receivedAt ? new Date(`${data.receivedAt}T12:00:00`) : new Date(),
        notes: data.notes ?? null,
        installmentId: data.installmentId ?? null,
        createdById: user.id,
      },
      select: { id: true },
    });
    // When linked to an installment, mark it as paid.
    if (data.installmentId) {
      await tx.paymentPlanInstallment.update({
        where: { id: data.installmentId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    await refreshPaymentStatus(tx, data.invoiceId);
    return p.id;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "recordPayment",
    entity: "Invoice",
    entityId: data.invoiceId,
    payload: { paymentId, amount: data.amount, method: data.method },
  });
  revalidatePath(`/[locale]/invoices/${data.invoiceId}`, "page");
  revalidatePath(`/[locale]/patients/${inv.patientId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id: paymentId });
}

export async function deletePayment(args: {
  paymentId: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const payment = await db.payment.findFirst({
    where: { id: args.paymentId, clinicId: user.clinicId },
    select: { id: true, invoiceId: true, installmentId: true },
  });
  if (!payment) return fail("NOT_FOUND", "Payment not found");

  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: args.paymentId } });
    if (payment.installmentId) {
      await tx.paymentPlanInstallment.update({
        where: { id: payment.installmentId },
        data: { status: "PENDING", paidAt: null },
      });
    }
    await refreshPaymentStatus(tx, payment.invoiceId);
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "deletePayment",
    entity: "Payment",
    entityId: args.paymentId,
  });
  revalidatePath(`/[locale]/invoices/${payment.invoiceId}`, "page");
  return ok({ id: args.paymentId });
}

// ─── Helpers for the UI ─────────────────────────────────────────────────────

/**
 * Lifetime billing summary for a single patient — used by the "Solde patient"
 * card in the Info tab. VOID invoices are excluded from billed/paid totals
 * but their orphan payments would be kept (we don't currently allow that, so
 * the aggregation matches the rendered numbers).
 */
export async function getPatientBalance(patientId: string): Promise<
  Result<{
    billed: number;
    paid: number;
    remaining: number;
    overdueCount: number;
    activeInvoiceCount: number;
  }>
> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: user.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const invoices = await db.invoice.findMany({
    where: {
      clinicId: user.clinicId,
      patientId,
      status: { not: InvoiceStatus.VOID },
    },
    select: {
      total: true,
      status: true,
      dueDate: true,
      payments: { select: { amount: true } },
    },
  });

  const now = new Date();
  let billed = 0;
  let paid = 0;
  let overdueCount = 0;
  let activeInvoiceCount = 0;
  for (const inv of invoices) {
    const t = Number(inv.total);
    const p = inv.payments.reduce((s, x) => s + Number(x.amount), 0);
    billed += t;
    paid += p;
    if (inv.status === InvoiceStatus.EMITTED || inv.status === InvoiceStatus.PARTIAL) {
      activeInvoiceCount++;
      if (inv.dueDate && inv.dueDate < now) overdueCount++;
    }
  }
  return ok({
    billed,
    paid,
    remaining: Math.max(0, billed - paid),
    overdueCount,
    activeInvoiceCount,
  });
}

/**
 * Returns the COMPLETED treatment applications for a patient that aren't yet
 * tied to an invoice line. Used by the "Create invoice from treatments"
 * wizard so the user picks pre-billed acts.
 */
export async function listUnbilledTreatmentsForPatient(patientId: string) {
  const user = await requireRole([...ANY_STAFF]);
  const rows = await db.treatmentApplication.findMany({
    where: {
      clinicId: user.clinicId,
      patientId,
      status: TreatmentApplicationStatus.COMPLETED,
      invoiceLines: { none: {} },
    },
    orderBy: { performedAt: "desc" },
    include: { catalogItem: { select: { code: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    catalogCode: r.catalogItem.code,
    catalogName: r.catalogItem.name,
    toothNumber: r.toothNumber,
    performedAt: r.performedAt,
    unitPrice: Number(r.unitPrice),
    discountPct: r.discountPct != null ? Number(r.discountPct) : null,
    discountAmount: r.discountAmount != null ? Number(r.discountAmount) : null,
    lineTotal: lineTotal({
      quantity: 1,
      unitPrice: Number(r.unitPrice),
      discountPct: r.discountPct != null ? Number(r.discountPct) : null,
      discountAmount: r.discountAmount != null ? Number(r.discountAmount) : null,
    }),
  }));
}
