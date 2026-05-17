import type { InstallmentStatus, PaymentPlanStatus } from "@prisma/client";

/**
 * Types shared between the `"use server"` payment-plan module and the UI.
 *
 * `displayStatus` is a derived field — the DB only persists terminal states
 * (PENDING / PAID / CANCELLED). OVERDUE is computed at fetch time by comparing
 * `dueDate` to the current date, so we never need to backfill statuses.
 */

export type InstallmentDisplayStatus = InstallmentStatus | "OVERDUE";

export interface InstallmentLite {
  id: string;
  sequence: number;
  dueDate: Date;
  amount: number;
  status: InstallmentStatus;
  displayStatus: InstallmentDisplayStatus;
  paidAt: Date | null;
  reminderJ3SentAt: Date | null;
  reminderJ1SentAt: Date | null;
}

export interface PaymentPlanDetail {
  id: string;
  invoiceId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  installmentsCount: number;
  totalAmount: number;
  remainingAmount: number;
  status: PaymentPlanStatus;
  startDate: Date;
  notes: string | null;
  /// Number of installments past due and still unpaid.
  overdueCount: number;
  installments: InstallmentLite[];
  createdAt: Date;
}
