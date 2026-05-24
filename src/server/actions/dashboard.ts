"use server";

// NOTE: `unstable_cache` was removed because Next.js's data cache serialises
// the return value via JSON, which loses Date types — `formatDate()` then
// receives a string and throws `RangeError: Invalid time value`. The
// dashboard recomputes on every request (~1s); re-introducing the cache
// later requires converting Dates to ISO strings before storing.

import {
  AppointmentStatus,
  InstallmentStatus,
  InvoiceStatus,
  RecallStatus,
  UserRole,
  WaitlistStatus,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;

/**
 * Dashboard payload — matches `docs/mockups/dashboard.html`.
 *
 * Heavy aggregations are run in a single `Promise.all` and cached for 60s
 * with `unstable_cache` keyed on `clinicId + role` so concurrent staff users
 * share the work.
 */

export interface KpiBundle {
  revenueThisMonth: number;
  revenueLastMonth: number;
  /// Patients with at least one non-cancelled appointment in the last 6 months.
  activePatients: number;
  newPatientsThisMonth: number;
  apptsThisWeek: number;
  apptsThisWeekConfirmed: number;
  apptsThisWeekPending: number;
  /// booked-minutes / available-minutes for current week, 0..100.
  occupancyPct: number;
}

export interface MonthlyRevenuePoint {
  /// "YYYY-MM" key.
  key: string;
  monthIndex: number; // 0..11
  year: number;
  value: number;
  /// True for the current calendar month — UI highlights it.
  isCurrent: boolean;
}

export interface TopTreatment {
  code: string;
  name: string;
  count: number;
  pct: number;
}

export interface TodayAppointment {
  id: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  patientName: string;
  dentistName: string;
  reason: string | null;
  status: AppointmentStatus;
}

export interface DashboardAlert {
  id: string;
  kind: "overdue-plans" | "low-stock" | "recalls" | "open-invoices";
  count: number;
  /// Detail items (max 3) — patient last names or item names.
  details: string[];
}

export interface DashboardData {
  role: UserRole;
  kpi: KpiBundle;
  monthlyRevenue: MonthlyRevenuePoint[];
  topTreatments: TopTreatment[];
  todayAppointments: TodayAppointment[];
  alerts: DashboardAlert[];
  generatedAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * The cabinet's wall-clock timezone. Vercel serverless runs in UTC so
 * `new Date().setHours(0,0,0,0)` would return midnight UTC = 01:00 Maroc
 * (UTC+1, no DST since 2018). The user would see "today's RDV" lag the
 * real Morocco day by up to an hour around midnight.
 *
 * Using `Intl.DateTimeFormat` with this timezone is the only IANA-compliant
 * way to handle the rare Ramadan offset shift without a dependency.
 */
const CLINIC_TIMEZONE = "Africa/Casablanca";

/**
 * Returns the UTC `Date` whose wall-clock value in {@link CLINIC_TIMEZONE}
 * is midnight on the same calendar day as `d` (also interpreted in that TZ).
 */
function startOfDay(d: Date): Date {
  // Format → {year, month, day} as the cabinet sees it.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // "2026-05-18T00:00" interpreted as Morocco time → ISO UTC.
  const moroccoMidnightIso = `${get("year")}-${get("month")}-${get("day")}T00:00:00`;
  // The TZ-naïve string is parsed as UTC; correct by re-anchoring through Intl.
  // For Morocco UTC+1 the result is exactly 23:00 UTC the previous day.
  const utcGuess = new Date(moroccoMidnightIso + "Z");
  const utcWall = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);
  const hh = Number(utcWall.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(utcWall.find((p) => p.type === "minute")?.value ?? 0);
  // `utcGuess` is +N hours past the actual local midnight — subtract.
  return new Date(utcGuess.getTime() - (hh * 60 + mm) * 60_000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  // ISO weeks start on Monday — use UTC accessors so the timezone we already
  // pinned in startOfDay is honoured.
  const dow = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TIMEZONE, weekday: "short" }).format(d) +
      " ",
  )
    ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TIMEZONE, weekday: "short" })
          .format(d)
          .toLowerCase(),
      )
    : out.getUTCDay();
  return addDays(out, dow === 0 ? -6 : 1 - dow);
}

function startOfMonth(d: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return startOfDay(new Date(`${get("year")}-${get("month")}-01T00:00:00Z`));
}

// ─── Cached compute ─────────────────────────────────────────────────────────

async function computeDashboard(clinicId: string, role: UserRole): Promise<DashboardData> {
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(addDays(monthStart, -1));
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const [
    paymentsThisMonth,
    paymentsLastMonth,
    totalPatients,
    activePatientsList,
    newPatientsThisMonth,
    apptsThisWeekAgg,
    apptsThisWeekConfirmed,
    apptsThisWeekPending,
    workingSchedules,
    absencesThisWeek,
    paymentsByMonth,
    topTreatmentsAgg,
    todayAppts,
    overdueInstallments,
    overdueInstallmentNames,
    lowStockSamples,
    recallsThisWeek,
    recallsThisWeekKinds,
    openInvoicesCount,
    apptDurations,
  ] = await Promise.all([
    db.payment.aggregate({
      where: { clinicId, receivedAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { clinicId, receivedAt: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
    db.patient.count({ where: { clinicId, deletedAt: null } }),
    db.appointment.findMany({
      where: {
        clinicId,
        startAt: { gte: sixMonthsAgo },
        status: { not: AppointmentStatus.CANCELLED },
      },
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    db.patient.count({
      where: { clinicId, createdAt: { gte: monthStart }, deletedAt: null },
    }),
    db.appointment.count({
      where: {
        clinicId,
        startAt: { gte: weekStart, lt: weekEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
    }),
    db.appointment.count({
      where: {
        clinicId,
        startAt: { gte: weekStart, lt: weekEnd },
        status: AppointmentStatus.CONFIRMED,
      },
    }),
    db.appointment.count({
      where: {
        clinicId,
        startAt: { gte: weekStart, lt: weekEnd },
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    db.workingSchedule.findMany({
      where: { dentist: { clinicId, isActive: true } },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    db.dentistAbsence.findMany({
      where: {
        dentist: { clinicId },
        startAt: { lt: weekEnd },
        endAt: { gt: weekStart },
      },
      select: { startAt: true, endAt: true },
    }),
    db.payment.findMany({
      where: { clinicId, receivedAt: { gte: twelveMonthsAgo } },
      select: { receivedAt: true, amount: true },
    }),
    db.treatmentApplication.groupBy({
      by: ["catalogItemId"],
      where: { clinicId, createdAt: { gte: sixMonthsAgo } },
      _count: { _all: true },
      orderBy: { _count: { catalogItemId: "desc" } },
      take: 5,
    }),
    db.appointment.findMany({
      where: { clinicId, startAt: { gte: today, lt: addDays(today, 1) } },
      orderBy: { startAt: "asc" },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        dentist: { select: { firstName: true, lastName: true } },
      },
    }),
    db.paymentPlanInstallment.count({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lt: today },
        plan: { clinicId },
      },
    }),
    db.paymentPlanInstallment.findMany({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lt: today },
        plan: { clinicId },
      },
      take: 3,
      include: { plan: { include: { patient: { select: { lastName: true } } } } },
    }),
    db.stockItem.findMany({
      where: { clinicId, isActive: true, lowStockAt: { not: null } },
      include: { movements: { select: { quantity: true } } },
    }),
    db.recallReminder.count({
      where: {
        clinicId,
        status: RecallStatus.PENDING,
        dueDate: { gte: today, lt: addDays(today, 7) },
      },
    }),
    db.recallReminder.findMany({
      where: {
        clinicId,
        status: RecallStatus.PENDING,
        dueDate: { gte: today, lt: addDays(today, 7) },
      },
      take: 3,
      select: { patient: { select: { lastName: true } } },
    }),
    db.invoice.count({
      where: { clinicId, status: { in: [InvoiceStatus.EMITTED, InvoiceStatus.PARTIAL] } },
    }),
    db.appointment.findMany({
      where: {
        clinicId,
        startAt: { gte: weekStart, lt: weekEnd },
        status: { not: AppointmentStatus.CANCELLED },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  // ─── Monthly revenue (12 months) ────────────────────────────────────────
  const monthlyMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }
  for (const p of paymentsByMonth) {
    const key = `${p.receivedAt.getFullYear()}-${String(p.receivedAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount));
  }
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRevenue: MonthlyRevenuePoint[] = Array.from(monthlyMap.entries()).map(([key, value]) => {
    const [y, m] = key.split("-").map((s) => parseInt(s, 10));
    return {
      key,
      year: y!,
      monthIndex: (m ?? 1) - 1,
      value: Math.round(value),
      isCurrent: key === currentKey,
    };
  });

  // ─── Occupancy ──────────────────────────────────────────────────────────
  function toMin(s: string): number {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    return (h ?? 0) * 60 + (m ?? 0);
  }
  let totalAvailableMin = 0;
  for (const ws of workingSchedules) {
    totalAvailableMin += Math.max(0, toMin(ws.endTime) - toMin(ws.startTime));
  }
  for (const abs of absencesThisWeek) {
    const clipStart = abs.startAt > weekStart ? abs.startAt : weekStart;
    const clipEnd = abs.endAt < weekEnd ? abs.endAt : weekEnd;
    if (clipEnd > clipStart) {
      totalAvailableMin -= Math.round((clipEnd.getTime() - clipStart.getTime()) / 60_000);
    }
  }
  totalAvailableMin = Math.max(1, totalAvailableMin);
  let bookedMin = 0;
  for (const a of apptDurations) {
    bookedMin += Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000);
  }
  const occupancyPct = Math.min(100, Math.round((bookedMin / totalAvailableMin) * 100));

  // ─── Top treatments (resolve names) ─────────────────────────────────────
  const totalApps = topTreatmentsAgg.reduce((s, r) => s + r._count._all, 0);
  const catalogItems = totalApps
    ? await db.treatmentCatalogItem.findMany({
        where: { id: { in: topTreatmentsAgg.map((r) => r.catalogItemId) } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const byId = new Map(catalogItems.map((c) => [c.id, c]));
  const topTreatments: TopTreatment[] = topTreatmentsAgg.map((r) => {
    const c = byId.get(r.catalogItemId);
    return {
      code: c?.code ?? "—",
      name: c?.name ?? "—",
      count: r._count._all,
      pct: totalApps > 0 ? Math.round((r._count._all / totalApps) * 100) : 0,
    };
  });

  // ─── Today's appointments ───────────────────────────────────────────────
  const todayAppointments: TodayAppointment[] = todayAppts.map((a) => ({
    id: a.id,
    startAt: a.startAt,
    endAt: a.endAt,
    durationMin: Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000),
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    dentistName: `${a.dentist.firstName} ${a.dentist.lastName}`,
    reason: a.reason,
    status: a.status,
  }));

  // ─── Alerts ─────────────────────────────────────────────────────────────
  const alerts: DashboardAlert[] = [];
  if (overdueInstallments > 0) {
    alerts.push({
      id: "overdue-plans",
      kind: "overdue-plans",
      count: overdueInstallments,
      details: overdueInstallmentNames.map((i) => i.plan.patient.lastName),
    });
  }
  const lowItems = lowStockSamples.filter((s) => {
    const qty = s.movements.reduce((a, m) => a + m.quantity, 0);
    return s.lowStockAt !== null && qty <= s.lowStockAt;
  });
  if (lowItems.length > 0) {
    alerts.push({
      id: "low-stock",
      kind: "low-stock",
      count: lowItems.length,
      details: lowItems.slice(0, 3).map((s) => s.name),
    });
  }
  if (recallsThisWeek > 0) {
    alerts.push({
      id: "recalls",
      kind: "recalls",
      count: recallsThisWeek,
      details: recallsThisWeekKinds.map((r) => r.patient.lastName),
    });
  }
  if (openInvoicesCount > 0) {
    alerts.push({
      id: "open-invoices",
      kind: "open-invoices",
      count: openInvoicesCount,
      details: [],
    });
  }

  const kpi: KpiBundle = {
    revenueThisMonth: Math.round(Number(paymentsThisMonth._sum.amount ?? 0)),
    revenueLastMonth: Math.round(Number(paymentsLastMonth._sum.amount ?? 0)),
    activePatients: activePatientsList.length === 0 ? totalPatients : activePatientsList.length,
    newPatientsThisMonth,
    apptsThisWeek: apptsThisWeekAgg,
    apptsThisWeekConfirmed,
    apptsThisWeekPending,
    occupancyPct,
  };

  return {
    role,
    kpi,
    monthlyRevenue,
    topTreatments,
    todayAppointments,
    alerts,
    generatedAt: new Date(),
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const user = await requireRole([...ANY_STAFF]);
  return computeDashboard(user.clinicId, user.role);
}

// ─── Notifications (topbar dropdown) ────────────────────────────────────────

export interface NotificationItem {
  id: string;
  kind: "overdue-plans" | "low-stock" | "recalls" | "open-invoices" | "waitlist";
  count: number;
  /// Translation key under "Notifications.items".
  titleKey: string;
  href: string;
}

async function computeNotifications(clinicId: string): Promise<NotificationItem[]> {
  const today = startOfDay(new Date());
  const [overduePlans, lowStockSamples, recallsDue, waitlist, overdueInvoices] = await Promise.all([
    db.paymentPlanInstallment.count({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lt: today },
        plan: { clinicId },
      },
    }),
    db.stockItem.findMany({
      where: { clinicId, isActive: true, lowStockAt: { not: null } },
      include: { movements: { select: { quantity: true } } },
    }),
    db.recallReminder.count({
      where: {
        clinicId,
        status: RecallStatus.PENDING,
        dueDate: { lte: addDays(today, 7) },
      },
    }),
    db.waitlistEntry.count({
      where: { clinicId, status: { in: [WaitlistStatus.WAITING, WaitlistStatus.PROPOSED] } },
    }),
    db.invoice.count({
      where: {
        clinicId,
        status: { in: [InvoiceStatus.EMITTED, InvoiceStatus.PARTIAL] },
        dueDate: { lt: today },
      },
    }),
  ]);

  const lowCount = lowStockSamples.filter((s) => {
    const qty = s.movements.reduce((a, m) => a + m.quantity, 0);
    return s.lowStockAt !== null && qty <= s.lowStockAt;
  }).length;

  const items: NotificationItem[] = [];
  if (overduePlans > 0) {
    items.push({
      id: "overdue-plans",
      kind: "overdue-plans",
      count: overduePlans,
      titleKey: "overduePlans",
      href: "/invoices?status=OPEN",
    });
  }
  if (lowCount > 0) {
    items.push({
      id: "low-stock",
      kind: "low-stock",
      count: lowCount,
      titleKey: "lowStock",
      href: "/stock?filter=low",
    });
  }
  if (recallsDue > 0) {
    items.push({
      id: "recalls",
      kind: "recalls",
      count: recallsDue,
      titleKey: "recallsDue",
      href: "/recalls",
    });
  }
  if (waitlist > 0) {
    items.push({
      id: "waitlist",
      kind: "waitlist",
      count: waitlist,
      titleKey: "waitlist",
      href: "/waitlist",
    });
  }
  if (overdueInvoices > 0) {
    items.push({
      id: "open-invoices",
      kind: "open-invoices",
      count: overdueInvoices,
      titleKey: "openInvoices",
      href: "/invoices?status=OPEN",
    });
  }
  return items;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const user = await requireRole([...ANY_STAFF]);
  return computeNotifications(user.clinicId);
}
