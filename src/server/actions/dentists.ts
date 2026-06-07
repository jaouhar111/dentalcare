"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  addAbsenceSchema,
  createDentistSchema,
  setScheduleSchema,
  updateDentistSchema,
  type AddAbsenceInput,
  type CreateDentistInput,
  type SetScheduleInput,
  type UpdateDentistInput,
} from "@/server/schemas/dentist";

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

// ─── List / get ──────────────────────────────────────────────────────────────

export interface DentistListItem {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  color: string;
  isActive: boolean;
  scheduleDayCount: number;
}

export async function listDentists(): Promise<Result<DentistListItem[]>> {
  const user = await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);

  const rows = await db.dentist.findMany({
    where: { clinicId: user.clinicId },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      schedules: { select: { dayOfWeek: true }, distinct: ["dayOfWeek"] },
    },
  });

  return ok(
    rows.map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty,
      phone: d.phone,
      email: d.email,
      color: d.color,
      isActive: d.isActive,
      scheduleDayCount: d.schedules.length,
    })),
  );
}

export async function getDentist(id: string) {
  const user = await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  return db.dentist.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      absences: { orderBy: { startAt: "asc" } },
      user: { select: { id: true, email: true } },
    },
  });
}

// ─── Create / update / toggle ────────────────────────────────────────────────

export async function createDentist(raw: CreateDentistInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = createDentistSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid dentist data", zodFieldsFromError(parsed.error));
  }
  const d = parsed.data;

  // Plan cap — Starter = 1 dentist, Pro = 3, Cabinet+ = unlimited.
  const [clinic, currentCount] = await Promise.all([
    db.clinic.findUnique({
      where: { id: user.clinicId },
      select: { plan: true, subscriptionStatus: true },
    }),
    db.dentist.count({ where: { clinicId: user.clinicId } }),
  ]);
  if (clinic) {
    const { capabilitiesFor, planLabel } = await import(
      "@/lib/billing/plan-capabilities"
    );
    const caps = capabilitiesFor({
      plan: clinic.plan,
      subscriptionStatus: clinic.subscriptionStatus,
    });
    if (currentCount >= caps.dentists) {
      return fail(
        "PLAN_LIMIT",
        `Votre plan ${planLabel(clinic.plan)} est limité à ${caps.dentists} dentiste${caps.dentists > 1 ? "s" : ""}. Passez à un plan supérieur pour en ajouter davantage.`,
      );
    }
  }

  const created = await db.dentist.create({
    data: {
      clinicId: user.clinicId,
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      color: d.color,
      photoUrl: d.photoUrl ?? null,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "dentist.create",
    entity: "Dentist",
    entityId: created.id,
    payload: { firstName: d.firstName, lastName: d.lastName },
  });

  revalidatePath("/dentists");
  return ok(created);
}

export async function updateDentist(raw: UpdateDentistInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = updateDentistSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid dentist data", zodFieldsFromError(parsed.error));
  }
  const d = parsed.data;

  const existing = await db.dentist.findFirst({
    where: { id: d.id, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Dentist not found");

  await db.dentist.update({
    where: { id: d.id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      color: d.color,
      photoUrl: d.photoUrl ?? null,
      ...(typeof d.isActive === "boolean" ? { isActive: d.isActive } : {}),
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "dentist.update",
    entity: "Dentist",
    entityId: d.id,
    payload: { fields: Object.keys(d) },
  });

  revalidatePath("/dentists");
  revalidatePath(`/dentists/${d.id}`);
  return ok({ id: d.id });
}

export async function toggleDentistActive(
  id: string,
): Promise<Result<{ id: string; isActive: boolean }>> {
  const user = await requireRole([UserRole.ADMIN]);
  const existing = await db.dentist.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { isActive: true },
  });
  if (!existing) return fail("NOT_FOUND", "Dentist not found");

  const updated = await db.dentist.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: { id: true, isActive: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: updated.isActive ? "dentist.activate" : "dentist.deactivate",
    entity: "Dentist",
    entityId: id,
  });

  revalidatePath("/dentists");
  return ok(updated);
}

// ─── Schedules ───────────────────────────────────────────────────────────────

export async function setSchedule(raw: SetScheduleInput): Promise<Result<null>> {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = setScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid schedule", zodFieldsFromError(parsed.error));
  }
  const { dentistId, schedules } = parsed.data;

  const existing = await db.dentist.findFirst({
    where: { id: dentistId, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Dentist not found");

  // Reject ranges overlapping within the same day.
  const byDay = new Map<number, Array<{ s: string; e: string }>>();
  for (const r of schedules) {
    const list = byDay.get(r.dayOfWeek) ?? [];
    list.push({ s: r.startTime, e: r.endTime });
    byDay.set(r.dayOfWeek, list);
  }
  for (const ranges of byDay.values()) {
    ranges.sort((a, b) => a.s.localeCompare(b.s));
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i]!.s < ranges[i - 1]!.e) {
        return fail("OVERLAPPING_RANGES", "Schedule ranges overlap");
      }
    }
  }

  // Atomically replace all of this dentist's schedule rows.
  await db.$transaction([
    db.workingSchedule.deleteMany({ where: { dentistId } }),
    ...(schedules.length
      ? [
          db.workingSchedule.createMany({
            data: schedules.map((r) => ({
              dentistId,
              dayOfWeek: r.dayOfWeek,
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          }),
        ]
      : []),
  ]);

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "dentist.setSchedule",
    entity: "Dentist",
    entityId: dentistId,
    payload: { count: schedules.length },
  });

  revalidatePath("/dentists");
  revalidatePath(`/dentists/${dentistId}`);
  return ok(null);
}

// ─── Absences ────────────────────────────────────────────────────────────────

export async function addAbsence(raw: AddAbsenceInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = addAbsenceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid absence", zodFieldsFromError(parsed.error));
  }
  const a = parsed.data;

  const existing = await db.dentist.findFirst({
    where: { id: a.dentistId, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Dentist not found");

  const created = await db.dentistAbsence.create({
    data: {
      dentistId: a.dentistId,
      startAt: new Date(a.startAt),
      endAt: new Date(a.endAt),
      reason: a.reason ?? null,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "dentist.addAbsence",
    entity: "DentistAbsence",
    entityId: created.id,
    payload: { dentistId: a.dentistId, reason: a.reason },
  });

  revalidatePath(`/dentists/${a.dentistId}`);
  return ok(created);
}

export async function removeAbsence(id: string): Promise<Result<null>> {
  const user = await requireRole([UserRole.ADMIN]);

  const absence = await db.dentistAbsence.findUnique({
    where: { id },
    select: { id: true, dentistId: true, dentist: { select: { clinicId: true } } },
  });
  if (!absence || absence.dentist.clinicId !== user.clinicId) {
    return fail("NOT_FOUND", "Absence not found");
  }

  await db.dentistAbsence.delete({ where: { id } });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "dentist.removeAbsence",
    entity: "DentistAbsence",
    entityId: id,
  });

  revalidatePath(`/dentists/${absence.dentistId}`);
  return ok(null);
}
