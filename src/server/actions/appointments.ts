"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  markStatusSchema,
  updateAppointmentSchema,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type ListAppointmentsInput,
  type MarkStatusInput,
  type UpdateAppointmentInput,
} from "@/server/schemas/appointment";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;

function zodFieldsFromError(error: unknown): Record<string, string[]> {
  if (!(error instanceof Object) || !("issues" in error)) return {};
  const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> })
    .issues;
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/** Status set that participates in conflict checks (active appointments). */
const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.RESCHEDULE_REQUESTED,
];

/**
 * Returns `null` if the slot is free (or only collides with `excludeId`).
 * Otherwise returns the conflicting appointment id.
 */
async function findConflict(args: {
  clinicId: string;
  dentistId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}): Promise<string | null> {
  const conflict = await db.appointment.findFirst({
    where: {
      clinicId: args.clinicId,
      dentistId: args.dentistId,
      status: { in: BLOCKING_STATUSES },
      ...(args.excludeId ? { NOT: { id: args.excludeId } } : {}),
      // overlap: NOT (other.endAt <= startAt OR other.startAt >= endAt)
      startAt: { lt: args.endAt },
      endAt: { gt: args.startAt },
    },
    select: { id: true },
  });
  return conflict?.id ?? null;
}

/**
 * `"HH:MM"` → minutes since midnight, for comparing schedule slots.
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Verifies the `[startAt, endAt)` range is inside one of the dentist's
 * working-hour ranges AND not inside any absence.
 * Returns a string code on failure or `null` on success.
 */
async function findWorkingHoursIssue(args: {
  dentistId: string;
  startAt: Date;
  endAt: Date;
}): Promise<"OUT_OF_HOURS" | "DURING_ABSENCE" | null> {
  // Check absences first (cheap).
  const absent = await db.dentistAbsence.findFirst({
    where: {
      dentistId: args.dentistId,
      startAt: { lt: args.endAt },
      endAt: { gt: args.startAt },
    },
    select: { id: true },
  });
  if (absent) return "DURING_ABSENCE";

  // Working hours: day-of-week + start/end time on local day.
  const dayOfWeek = args.startAt.getDay(); // 0=Sun..6=Sat
  const minutesStart = args.startAt.getHours() * 60 + args.startAt.getMinutes();
  const minutesEnd = args.endAt.getHours() * 60 + args.endAt.getMinutes();

  // Same-day rule: cannot straddle midnight. (We enforce duration ≤120 min
  // anyway, so this is implicit, but explicit guard is clearer.)
  if (args.startAt.toDateString() !== args.endAt.toDateString()) {
    return "OUT_OF_HOURS";
  }

  const schedules = await db.workingSchedule.findMany({
    where: { dentistId: args.dentistId, dayOfWeek },
    select: { startTime: true, endTime: true },
  });

  if (schedules.length === 0) return "OUT_OF_HOURS";

  const within = schedules.some(
    (s) => timeToMinutes(s.startTime) <= minutesStart && timeToMinutes(s.endTime) >= minutesEnd,
  );
  return within ? null : "OUT_OF_HOURS";
}

// ─── List ────────────────────────────────────────────────────────────────────

export interface AppointmentListItem {
  id: string;
  patientId: string;
  patientName: string;
  dentistId: string;
  dentistName: string;
  dentistColor: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  reason: string | null;
  cancellationReason: string | null;
  confirmationReceivedAt: Date | null;
}

export async function listAppointments(
  raw: ListAppointmentsInput,
): Promise<Result<AppointmentListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = listAppointmentsSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid range", zodFieldsFromError(parsed.error));
  }
  const { from, to, dentistIds } = parsed.data;

  // Defense in depth: a DENTIST user can only ever see their own appointments,
  // regardless of any `dentistIds` filter sent from the client. ADMIN +
  // RECEPTIONIST keep the unrestricted view they need for the front-desk
  // calendar.
  const dentistScope =
    user.role === UserRole.DENTIST && user.dentistId
      ? [user.dentistId]
      : dentistIds && dentistIds.length > 0
        ? dentistIds
        : null;

  const rows = await db.appointment.findMany({
    where: {
      clinicId: user.clinicId,
      startAt: { gte: new Date(from), lt: new Date(to) },
      ...(dentistScope ? { dentistId: { in: dentistScope } } : {}),
      // Hide RDV whose patient was soft-deleted — they pollute the calendar
      // and break the edit flow because `getPatient` refuses to load them.
      patient: { deletedAt: null },
    },
    orderBy: { startAt: "asc" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      dentist: { select: { id: true, firstName: true, lastName: true, color: true } },
    },
  });

  return ok(
    rows.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      dentistId: a.dentistId,
      dentistName: `${a.dentist.firstName} ${a.dentist.lastName}`,
      dentistColor: a.dentist.color,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
      reason: a.reason,
      cancellationReason: a.cancellationReason,
      confirmationReceivedAt: a.confirmationReceivedAt,
    })),
  );
}

export async function getAppointment(id: string) {
  const user = await requireRole([...ANY_STAFF]);
  return db.appointment.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      dentist: { select: { id: true, firstName: true, lastName: true, color: true } },
    },
  });
}

/**
 * Next strictly future appointment for a patient — used on the patient detail
 * card. Returns `null` if none. An appointment that has already started but
 * not yet ended is NOT returned here; it surfaces in the "Recent" list with
 * its display status auto-promoted to IN_PROGRESS by the caller.
 */
export async function getNextPatientAppointment(patientId: string) {
  const user = await requireRole([...ANY_STAFF]);
  return db.appointment.findFirst({
    where: {
      clinicId: user.clinicId,
      patientId,
      startAt: { gte: new Date() },
      status: { in: BLOCKING_STATUSES },
    },
    orderBy: { startAt: "asc" },
    include: {
      dentist: { select: { firstName: true, lastName: true, color: true } },
    },
  });
}

/**
 * Most recent appointments for a patient — anything whose start time has
 * passed (the appointment is happening now or already happened). The render
 * layer is responsible for promoting "scheduled past" rows to COMPLETED /
 * IN_PROGRESS via {@link effectiveAppointmentStatus}.
 */
export async function getRecentPatientAppointments(patientId: string, limit = 5) {
  const user = await requireRole([...ANY_STAFF]);
  const rows = await db.appointment.findMany({
    where: {
      clinicId: user.clinicId,
      patientId,
      startAt: { lt: new Date() },
    },
    orderBy: { startAt: "desc" },
    take: limit,
    include: {
      dentist: { select: { firstName: true, lastName: true, color: true } },
    },
  });

  // Annotate each appointment with the count of attached clinical notes.
  // Done as a single grouped query rather than N+1 per appointment.
  const ids = rows.map((r) => r.id);
  const noteCounts =
    ids.length > 0
      ? await db.medicalNote.groupBy({
          by: ["appointmentId"],
          where: { appointmentId: { in: ids } },
          _count: { _all: true },
        })
      : [];
  const countByApptId = new Map<string, number>();
  for (const c of noteCounts) {
    if (c.appointmentId) countByApptId.set(c.appointmentId, c._count._all);
  }
  return rows.map((r) => ({ ...r, noteCount: countByApptId.get(r.id) ?? 0 }));
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createAppointment(
  raw: CreateAppointmentInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = createAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid appointment", zodFieldsFromError(parsed.error));
  }
  const { patientId, dentistId, startAt, durationMin, reason, notes, catalogItemId } =
    parsed.data;

  // Validate patient + dentist belong to this clinic (defense-in-depth — the
  // tenant extension already filters but explicit lookup gives nicer errors).
  const [patient, dentist, catalogItem] = await Promise.all([
    db.patient.findFirst({
      where: { id: patientId, clinicId: user.clinicId, deletedAt: null },
      select: { id: true },
    }),
    db.dentist.findFirst({
      where: { id: dentistId, clinicId: user.clinicId, isActive: true },
      select: { id: true },
    }),
    catalogItemId
      ? db.treatmentCatalogItem.findFirst({
          where: { id: catalogItemId, clinicId: user.clinicId, isActive: true },
          select: { id: true, defaultPrice: true, requiresTooth: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found", { patientId: ["NOT_FOUND"] });
  if (!dentist) return fail("DENTIST_NOT_FOUND", "Dentist not found", { dentistId: ["NOT_FOUND"] });
  if (catalogItemId && !catalogItem) {
    return fail("INVALID_INPUT", "Treatment not found", { catalogItemId: ["NOT_FOUND"] });
  }

  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const hoursIssue = await findWorkingHoursIssue({ dentistId, startAt: start, endAt: end });
  if (hoursIssue) return fail(hoursIssue, "Outside working hours / during absence");

  const conflict = await findConflict({
    clinicId: user.clinicId,
    dentistId,
    startAt: start,
    endAt: end,
  });
  if (conflict) return fail("CONFLICT", "Another appointment overlaps this slot");

  // Create the appointment and (optionally) link a PLANNED treatment
  // application in the same transaction so the dentist sees the intended
  // act in the séance editor and recall pipeline knows what to fire on
  // COMPLETED.
  const created = await db.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        clinicId: user.clinicId,
        patientId,
        dentistId,
        startAt: start,
        endAt: end,
        reason: reason ?? null,
        notes: notes ?? null,
        createdById: user.id,
      },
      select: { id: true },
    });
    if (catalogItem) {
      await tx.treatmentApplication.create({
        data: {
          clinicId: user.clinicId,
          patientId,
          dentistId,
          appointmentId: appt.id,
          catalogItemId: catalogItem.id,
          status: "PLANNED",
          unitPrice: catalogItem.defaultPrice,
          createdById: user.id,
        },
      });
    }
    return appt;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "appointment.create",
    entity: "Appointment",
    entityId: created.id,
    payload: {
      patientId,
      dentistId,
      startAt: start.toISOString(),
      durationMin,
      ...(catalogItem ? { catalogItemId: catalogItem.id } : {}),
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok(created);
}

// ─── Update / move ───────────────────────────────────────────────────────────

export async function updateAppointment(
  raw: UpdateAppointmentInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = updateAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid appointment", zodFieldsFromError(parsed.error));
  }
  const { id, patientId, dentistId, startAt, durationMin, reason, notes } = parsed.data;

  const existing = await db.appointment.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true },
  });
  if (!existing) return fail("NOT_FOUND", "Appointment not found");
  if (existing.status === AppointmentStatus.COMPLETED) {
    return fail("FORBIDDEN", "Completed appointments cannot be modified");
  }

  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const hoursIssue = await findWorkingHoursIssue({ dentistId, startAt: start, endAt: end });
  if (hoursIssue) return fail(hoursIssue, "Outside working hours / during absence");

  const conflict = await findConflict({
    clinicId: user.clinicId,
    dentistId,
    startAt: start,
    endAt: end,
    excludeId: id,
  });
  if (conflict) return fail("CONFLICT", "Another appointment overlaps this slot");

  await db.appointment.update({
    where: { id },
    data: {
      patientId,
      dentistId,
      startAt: start,
      endAt: end,
      reason: reason ?? null,
      notes: notes ?? null,
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "appointment.update",
    entity: "Appointment",
    entityId: id,
    payload: { patientId, dentistId, startAt: start.toISOString(), durationMin },
  });

  revalidatePath("/appointments");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id });
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelAppointment(
  raw: CancelAppointmentInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = cancelAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const { id, reason } = parsed.data;

  const existing = await db.appointment.findFirst({
    where: { id, clinicId: user.clinicId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      dentistId: true,
      dentist: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true } },
    },
  });
  if (!existing) return fail("NOT_FOUND", "Appointment not found");
  if (existing.status === AppointmentStatus.CANCELLED) {
    return ok({ id });
  }
  if (existing.status === AppointmentStatus.COMPLETED) {
    return fail("FORBIDDEN", "Completed appointments cannot be cancelled");
  }

  const now = new Date();
  const isLate = existing.startAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const isFutureSlot = existing.startAt.getTime() > now.getTime();

  await db.appointment.update({
    where: { id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: now,
      cancellationReason: reason ?? null,
      cancelledLate: isLate,
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "appointment.cancel",
    entity: "Appointment",
    entityId: id,
    payload: { reason, late: isLate },
  });

  // Phase 4.8 — auto-match against the waitlist for FUTURE cancelled slots.
  // Best-effort: a failure here must not roll back the cancel itself.
  if (isFutureSlot) {
    try {
      const { proposeSlotToWaitlist } = await import("./waitlist");
      await proposeSlotToWaitlist({
        clinicId: user.clinicId,
        dentistId: existing.dentistId,
        dentistName: `${existing.dentist.firstName} ${existing.dentist.lastName}`,
        clinicName: existing.clinic.name,
        startAt: existing.startAt,
        endAt: existing.endAt,
      });
    } catch (err) {
      console.error("[appointments] auto-match waitlist failed", { id, err });
    }
  }

  revalidatePath("/appointments");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  revalidatePath("/waitlist");
  return ok({ id });
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function markStatus(raw: MarkStatusInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = markStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid status", zodFieldsFromError(parsed.error));
  }
  const { id, status } = parsed.data;

  const existing = await db.appointment.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true },
  });
  if (!existing) return fail("NOT_FOUND", "Appointment not found");

  await db.appointment.update({
    where: { id },
    data: {
      status,
      ...(status === AppointmentStatus.CONFIRMED && !existing.status.startsWith("CONFIRMED")
        ? { confirmationReceivedAt: new Date() }
        : {}),
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: `appointment.status.${status}`,
    entity: "Appointment",
    entityId: id,
  });

  revalidatePath("/appointments");
  revalidatePath("/[locale]", "page"); // dashboard KPIs
  return ok({ id });
}

// ─── Confirmation token (used by reminder links) ─────────────────────────────

export async function confirmByToken(token: string): Promise<Result<{ id: string }>> {
  // No auth: this is called from the public confirmation page (link in email/WhatsApp).
  const appointment = await db.appointment.findUnique({
    where: { confirmationToken: token },
    select: { id: true, clinicId: true, status: true, startAt: true },
  });
  if (!appointment || appointment.status === AppointmentStatus.CANCELLED) {
    return fail("INVALID_TOKEN", "Link invalid or appointment cancelled");
  }
  if (appointment.startAt < new Date()) {
    return fail("PAST", "Appointment already passed");
  }

  await db.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CONFIRMED,
      confirmationReceivedAt: new Date(),
    },
  });

  await audit({
    clinicId: appointment.clinicId,
    action: "appointment.confirm.token",
    entity: "Appointment",
    entityId: appointment.id,
  });

  return ok({ id: appointment.id });
}
