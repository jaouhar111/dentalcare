import type {
  AppointmentSource,
  AppointmentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";

export interface ClinicDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
  logoUrl: string | null;
  defaultLocale: string;
  subscriptionStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  /// Per-cabinet feature overrides (P2-10). `null` = use the plan default.
  featureOverrides: {
    aiReceptionist: boolean | null;
    voiceNotes: boolean | null;
    recalls: boolean | null;
    paymentPlans: boolean | null;
  };
  openwaSessionId: string | null;
  createdAt: Date;
  totals: {
    patients: number;
    activeEmployees: number;
    upcomingAppointments: number;
    aiConversations: number;
    pendingRecalls: number;
  };
  /// Rolling 30-day activity (created/active in the window), not totals.
  usage30d: {
    appointmentsCreated: number;
    aiConversations: number;
    aiTurns: number;
    invoicesEmitted: number;
  };
  recentPatients: Array<{
    id: string;
    name: string;
    phone: string;
    createdAt: Date;
  }>;
  employees: Array<{
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>;
  recentAppointments: Array<{
    id: string;
    startAt: Date;
    status: AppointmentStatus;
    patientName: string;
    dentistName: string;
    reason: string | null;
    source: AppointmentSource;
  }>;
}
