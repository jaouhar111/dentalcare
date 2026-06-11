import type { SubInvoiceStatus, SubscriptionPlan } from "@prisma/client";

/** A subscription invoice row for the clinic detail billing panel. */
export interface SubscriptionInvoiceRow {
  id: string;
  plan: SubscriptionPlan;
  amount: number;
  period: string;
  status: SubInvoiceStatus;
  issuedAt: Date;
  paidAt: Date | null;
}
