import type { DentalCondition, ToothSurface } from "@prisma/client";

/**
 * Types shared between the `"use server"` odontogram actions module and the
 * UI components. Kept separate because Next.js's "use server" bundler treats
 * any non-async-function export as a runtime value.
 */

/** Snapshot of one tooth's current (= latest) condition. */
export interface ToothState {
  toothNumber: number;
  condition: DentalCondition;
  surfaces: ToothSurface[];
  note: string | null;
  recordedAt: Date;
  recordedByName: string;
  entryId: string;
}

/** A single history row for the timeline panel of a selected tooth. */
export interface ChartHistoryEntry {
  id: string;
  toothNumber: number;
  condition: DentalCondition;
  surfaces: ToothSurface[];
  note: string | null;
  recordedAt: Date;
  recordedByName: string;
}

/** Proposal returned by `generatePlanFromChart`. */
export interface PlanProposalItem {
  toothNumber: number;
  condition: DentalCondition;
  surfaces: ToothSurface[];
  catalogItemId: string | null;
  catalogCode: string | null;
  catalogName: string | null;
  defaultPrice: number | null;
  /// Human-readable reason ("Carie occlusale → composite simple").
  rationale: string;
}
