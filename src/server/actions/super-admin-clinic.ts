"use server";

import { AppointmentStatus, RecallStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import type { ClinicDetail } from "./super-admin-clinic-types";

/**
 * Full cabinet snapshot for the /super-admin/clinics/[id] drill-down.
 *
 *  - Cabinet meta (name, slug, contact, subscription)
 *  - Counts: patients, active employees, upcoming RDV, AI conversations
 *  - Last 10 patients (recently created)
 *  - All employees of the clinic
 *  - Last 5 RDV (any status)
 *  - Pending recalls count
 *
 * Cross-tenant by design — caller must be SUPER_ADMIN. We never trust
 * `session.user.clinicId` here; the route param is the source of truth.
 */
export async function getClinicDetail(
  clinicId: string,
): Promise<Result<ClinicDetail>> {
  await requireRole([UserRole.SUPER_ADMIN]);

  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      address: true,
      vatNumber: true,
      logoUrl: true,
      defaultLocale: true,
      subscriptionStatus: true,
      plan: true,
      trialEndsAt: true,
      suspendedAt: true,
      suspendedReason: true,
      featureAiReceptionist: true,
      featureVoiceNotes: true,
      featureRecalls: true,
      featurePaymentPlans: true,
      openwaSessionId: true,
      createdAt: true,
    },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable");

  const now = new Date();
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [
    patientsCount,
    employeesCount,
    upcomingApptsCount,
    aiConvosCount,
    pendingRecallsCount,
    recentPatients,
    employees,
    recentAppts,
    apptsCreated30d,
    aiConvos30d,
    aiTurnsAgg,
    invoices30d,
  ] = await Promise.all([
    db.patient.count({ where: { clinicId, deletedAt: null } }),
    db.user.count({ where: { clinicId, isActive: true } }),
    db.appointment.count({
      where: {
        clinicId,
        startAt: { gt: now },
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      },
    }),
    db.aIConversation.count({ where: { clinicId } }),
    db.recallReminder.count({
      where: { clinicId, status: RecallStatus.PENDING },
    }),
    db.patient.findMany({
      where: { clinicId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    }),
    db.user.findMany({
      where: { clinicId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    db.appointment.findMany({
      where: { clinicId },
      orderBy: { startAt: "desc" },
      take: 8,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        dentist: { select: { firstName: true, lastName: true } },
      },
    }),
    // ── 30-day usage window ──────────────────────────────────────────
    db.appointment.count({ where: { clinicId, createdAt: { gte: day30 } } }),
    db.aIConversation.count({ where: { clinicId, lastActivityAt: { gte: day30 } } }),
    db.aIConversation.aggregate({
      where: { clinicId, lastActivityAt: { gte: day30 } },
      _sum: { totalTurns: true },
    }),
    db.invoice.count({ where: { clinicId, emittedAt: { gte: day30 } } }),
  ]);

  const trialDaysRemaining =
    clinic.subscriptionStatus === "TRIAL" && clinic.trialEndsAt
      ? Math.max(
          0,
          Math.ceil((clinic.trialEndsAt.getTime() - now.getTime()) / 86_400_000),
        )
      : null;

  return ok({
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug ?? "—",
    email: clinic.email,
    phone: clinic.phone,
    address: clinic.address,
    vatNumber: clinic.vatNumber,
    logoUrl: clinic.logoUrl,
    defaultLocale: clinic.defaultLocale,
    subscriptionStatus: clinic.subscriptionStatus,
    plan: clinic.plan,
    trialEndsAt: clinic.trialEndsAt,
    trialDaysRemaining,
    suspendedAt: clinic.suspendedAt,
    suspendedReason: clinic.suspendedReason,
    featureOverrides: {
      aiReceptionist: clinic.featureAiReceptionist,
      voiceNotes: clinic.featureVoiceNotes,
      recalls: clinic.featureRecalls,
      paymentPlans: clinic.featurePaymentPlans,
    },
    openwaSessionId: clinic.openwaSessionId,
    createdAt: clinic.createdAt,
    totals: {
      patients: patientsCount,
      activeEmployees: employeesCount,
      upcomingAppointments: upcomingApptsCount,
      aiConversations: aiConvosCount,
      pendingRecalls: pendingRecallsCount,
    },
    usage30d: {
      appointmentsCreated: apptsCreated30d,
      aiConversations: aiConvos30d,
      aiTurns: aiTurnsAgg._sum.totalTurns ?? 0,
      invoicesEmitted: invoices30d,
    },
    recentPatients: recentPatients.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      createdAt: p.createdAt,
    })),
    employees: employees.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    recentAppointments: recentAppts.map((a) => ({
      id: a.id,
      startAt: a.startAt,
      status: a.status,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
      reason: a.reason,
      source: a.source,
    })),
  });
}
