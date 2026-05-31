/**
 * Types for the `/reminders-queue` admin page. Lives in a sibling file
 * because "use server" modules can only export async functions.
 */

import type { AppointmentStatus, RecallKind } from "@prisma/client";

export interface UpcomingAppointmentReminder {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  dentistName: string;
  startAt: Date;
  /// startAt - 24h. When the Inngest function (or cron) fires.
  reminderAt: Date;
  status: AppointmentStatus;
  reminderSentAt: Date | null;
  source: string;
}

export interface UpcomingRecall {
  id: string;
  patientName: string;
  patientPhone: string;
  kind: RecallKind;
  dueDate: Date;
  reason: string | null;
}

export interface SendFailure {
  id: string;
  createdAt: Date;
  action: string;
  entity: string;
  entityId: string | null;
  errorPreview: string;
  /// Best-effort patient name (resolved from payload when present).
  context: string | null;
}

export interface RemindersQueueData {
  upcomingAppointments: UpcomingAppointmentReminder[];
  upcomingRecalls: UpcomingRecall[];
  recentFailures: SendFailure[];
  totals: {
    appointmentsTotal: number;
    appointmentsAlreadySent: number;
    recallsTotal: number;
    failuresTotal: number;
  };
}
