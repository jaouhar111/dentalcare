import type { RecallKind, RecallStatus } from "@prisma/client";

/**
 * Types shared between the `"use server"` recall module and the UI. Lives
 * outside `recalls.ts` because the bundler rejects non-async-function exports.
 */

export interface RecallListItem {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  kind: RecallKind;
  dueDate: Date;
  status: RecallStatus;
  reason: string | null;
  sentAt: Date | null;
  bookedAt: Date | null;
  /// Live-derived: `status === PENDING && dueDate < today + 30d`.
  isApproaching: boolean;
  isOverdue: boolean;
}
