import type { ToothSurface, TreatmentApplicationStatus } from "@prisma/client";

/**
 * Types shared between `treatments.ts` (the `"use server"` actions module)
 * and the UI components that render their results. Kept separate because
 * Next.js's `"use server"` bundler treats every export as a runtime value.
 */

export interface CatalogItemListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  defaultPrice: number;
  defaultDurationMin: number;
  requiresTooth: boolean;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ApplicationListItem {
  id: string;
  patientId: string;
  appointmentId: string | null;
  catalogItemId: string;
  catalogCode: string;
  catalogName: string;
  catalogColor: string;
  dentistId: string | null;
  dentistName: string | null;
  toothNumber: number | null;
  surfaces: ToothSurface[];
  status: TreatmentApplicationStatus;
  unitPrice: number;
  discountPct: number | null;
  discountAmount: number | null;
  /// Computed at fetch time: `unitPrice - (discountAmount || unitPrice * discountPct / 100)`.
  lineTotal: number;
  notes: string | null;
  performedAt: Date | null;
  createdAt: Date;
}
