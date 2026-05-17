import type { InvoiceStatus, PaymentMethod } from "@prisma/client";

/**
 * Types shared between `"use server"` invoice actions and UI consumers.
 * Lives outside `invoices.ts` because the bundler enforces async-function-only
 * exports there.
 */

export interface InvoiceLineLite {
  id: string;
  description: string;
  toothNumber: number | null;
  quantity: number;
  unitPrice: number;
  discountPct: number | null;
  discountAmount: number | null;
  lineTotal: number;
  sortOrder: number;
  treatmentApplicationId: string | null;
}

export interface PaymentLite {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  notes: string | null;
  installmentId: string | null;
  recordedByName: string;
}

export interface InvoiceListItem {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  patientId: string;
  patientName: string;
  emittedAt: Date | null;
  dueDate: Date | null;
  total: number;
  paid: number;
  /// Computed: `total - paid` clamped to [0, total]. Negative would mean
  /// over-payment, which we don't allow at the action layer.
  remaining: number;
  /// `true` when status ∈ {EMITTED, PARTIAL} and now > dueDate.
  isOverdue: boolean;
  createdAt: Date;
}

export interface InvoiceDetail extends InvoiceListItem {
  subtotal: number;
  discountAmount: number;
  notes: string | null;
  voidedAt: Date | null;
  voidedReason: string | null;
  lines: InvoiceLineLite[];
  payments: PaymentLite[];
  patientPhone: string;
  patientCin: string | null;
  patientDob: Date;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicVatNumber: string | null;
  hasPaymentPlan: boolean;
}
