/**
 * Types for the /super-admin dashboard. Sibling to a "use server"
 * module so the action file can stay async-only.
 */
import type { SubscriptionStatus } from "@prisma/client";

export interface PlatformClinic {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  subscriptionStatus: SubscriptionStatus;
  /// Days until trial expiry (only set when status is TRIAL).
  trialDaysRemaining: number | null;
  patients: number;
  futureAppointments: number;
  aiConversations7d: number;
  createdAt: Date;
}

export interface PlatformActivityEntry {
  id: string;
  type:
    | "clinic.signup"
    | "appointment.created"
    | "appointment.cancelled"
    | "ai.conversation.turn"
    | "subscription.changed";
  clinicId: string;
  clinicName: string;
  /// Short human-readable summary ("New cabinet 'Cabinet X' signed up").
  summary: string;
  at: Date;
}

export interface PlatformSignupSpark {
  /// `YYYY-MM-DD` bucket.
  day: string;
  count: number;
}

/// Daily count series for any 30-day metric (signups, RDV, etc.) — same
/// shape as `PlatformSignupSpark`, kept as a separate alias so callers
/// can substitute one for the other without semantic confusion.
export type DailyCountSeries = PlatformSignupSpark[];

export interface PlatformOverview {
  clinics: PlatformClinic[];
  totals: {
    clinicsTotal: number;
    trialing: number;
    active: number;
    pastDue: number;
    cancelled: number;
    patientsTotal: number;
    futureAppointmentsTotal: number;
    appointmentsLast7d: number;
    aiConversationsLast7d: number;
  };
  recentActivity: PlatformActivityEntry[];
  signups30d: PlatformSignupSpark[];
  /// Appointments created per day, last 30 days (across the platform).
  appointmentsCreated30d: DailyCountSeries;
  /// AI conversation turns per day, last 30 days.
  aiTurns30d: DailyCountSeries;
}
