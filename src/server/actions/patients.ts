"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireAuth, requireRole, canDeletePatient } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import { UserRole } from "@prisma/client";
import {
  createPatientSchema,
  listPatientsSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type ListPatientsInput,
  type UpdatePatientInput,
} from "@/server/schemas/patient";

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

// ─── List ────────────────────────────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  cin: string | null;
  phone: string;
  city: string | null;
  dob: Date;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  hasAllergies: boolean;
  isInactive: boolean;
  lastVisitAt: Date | null;
  createdAt: Date;
}

export interface ListPatientsResult {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  newThisMonth: number;
  cities: string[];
}

const INACTIVE_THRESHOLD_DAYS = 365;

/**
 * Returns a `patientId -> last visit Date` map for the given patient ids.
 * A "visit" = any past appointment whose status is not CANCELLED or NO_SHOW.
 * Done as a single grouped query to avoid N+1.
 */
async function fetchLastVisits(patientIds: string[]): Promise<Map<string, Date>> {
  if (patientIds.length === 0) return new Map();
  const rows = await db.appointment.groupBy({
    by: ["patientId"],
    where: {
      patientId: { in: patientIds },
      startAt: { lt: new Date() },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    _max: { startAt: true },
  });
  const out = new Map<string, Date>();
  for (const r of rows) {
    if (r._max.startAt) out.set(r.patientId, r._max.startAt);
  }
  return out;
}

export async function listPatients(
  raw: Partial<ListPatientsInput> & { city?: string; status?: "all" | "active" | "inactive" } = {},
): Promise<Result<ListPatientsResult>> {
  const user = await requireAuth();
  const parsed = listPatientsSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid pagination parameters");
  }
  const { query, page, pageSize } = parsed.data;
  const cityFilter =
    typeof raw.city === "string" && raw.city.trim() !== "" ? raw.city.trim() : undefined;
  const statusFilter = raw.status ?? "all";

  const inactiveSince = new Date();
  inactiveSince.setDate(inactiveSince.getDate() - INACTIVE_THRESHOLD_DAYS);

  const skip = (page - 1) * pageSize;
  const baseWhere = { clinicId: user.clinicId, deletedAt: null } as const;
  const cityWhere = cityFilter ? { city: cityFilter } : {};

  // Distinct cities + "new this month" counter — cheap, both unfiltered by city.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allCities, newThisMonth] = await Promise.all([
    db.patient.findMany({
      where: { ...baseWhere, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    db.patient.count({
      where: { ...baseWhere, createdAt: { gte: startOfMonth } },
    }),
  ]);
  const cities = allCities.map((c) => c.city!).filter(Boolean);

  // ─── Branch 1: text query → trigram FTS via raw SQL ────────────────────────
  if (query.length > 0) {
    const like = `%${query.toLowerCase()}%`;
    const cityFilterSql = cityFilter ? Prisma.sql`AND p.city = ${cityFilter}` : Prisma.empty;

    const rows = await db.$queryRaw<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        cin: string | null;
        phone: string;
        city: string | null;
        dob: Date;
        gender: "MALE" | "FEMALE" | "OTHER" | null;
        hasAllergies: boolean;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT p.id, p."firstName", p."lastName", p.cin, p.phone, p.city, p.dob, p.gender, p."createdAt",
             EXISTS (SELECT 1 FROM patient_allergies a WHERE a."patientId" = p.id) AS "hasAllergies"
      FROM patients p
      WHERE p."clinicId" = ${user.clinicId}
        AND p."deletedAt" IS NULL
        ${cityFilterSql}
        AND (
          LOWER(p."firstName") || ' ' ||
          LOWER(p."lastName")  || ' ' ||
          LOWER(COALESCE(p.cin, '')) || ' ' ||
          p.phone
        ) LIKE ${like}
      ORDER BY p."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `);

    const totalRow = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM patients p
      WHERE p."clinicId" = ${user.clinicId}
        AND p."deletedAt" IS NULL
        ${cityFilterSql}
        AND (
          LOWER(p."firstName") || ' ' ||
          LOWER(p."lastName")  || ' ' ||
          LOWER(COALESCE(p.cin, '')) || ' ' ||
          p.phone
        ) LIKE ${like}
    `);
    const total = Number(totalRow[0]?.count ?? 0);

    const lastVisits = await fetchLastVisits(rows.map((r) => r.id));
    return ok({
      items: rows.map((r) => ({
        ...r,
        isInactive: r.createdAt < inactiveSince,
        lastVisitAt: lastVisits.get(r.id) ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      newThisMonth,
      cities,
    });
  }

  // ─── Branch 2: no query → typed Prisma ─────────────────────────────────────
  const [items, total] = await Promise.all([
    db.patient.findMany({
      where: { ...baseWhere, ...cityWhere },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        cin: true,
        phone: true,
        city: true,
        dob: true,
        gender: true,
        createdAt: true,
        _count: { select: { allergies: true } },
      },
    }),
    db.patient.count({ where: { ...baseWhere, ...cityWhere } }),
  ]);

  const lastVisits = await fetchLastVisits(items.map((p) => p.id));
  const all = items.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    cin: p.cin,
    phone: p.phone,
    city: p.city,
    dob: p.dob,
    gender: p.gender,
    hasAllergies: p._count.allergies > 0,
    isInactive: p.createdAt < inactiveSince,
    lastVisitAt: lastVisits.get(p.id) ?? null,
    createdAt: p.createdAt,
  }));

  const filtered =
    statusFilter === "active"
      ? all.filter((p) => !p.isInactive)
      : statusFilter === "inactive"
        ? all.filter((p) => p.isInactive)
        : all;

  return ok({
    items: filtered,
    total: statusFilter === "all" ? total : filtered.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    newThisMonth,
    cities,
  });
}

// ─── Get one ─────────────────────────────────────────────────────────────────

export async function getPatient(id: string) {
  const user = await requireAuth();
  return db.patient.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
    include: { allergies: true },
  });
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createPatient(raw: CreatePatientInput): Promise<Result<{ id: string }>> {
  const user = await requireAuth();
  const parsed = createPatientSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid patient data", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  try {
    const created = await db.patient.create({
      data: {
        clinicId: user.clinicId,
        firstName: data.firstName,
        lastName: data.lastName,
        cin: data.cin ?? null,
        phone: data.phone,
        email: data.email ?? null,
        dob: new Date(data.dob),
        gender: data.gender ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        bloodGroup: data.bloodGroup ?? null,
        medicalHistory: data.medicalHistory ?? null,
        preferredChannel: data.preferredChannel,
        preferredLocale: data.preferredLocale,
        photoConsent: data.photoConsent,
        photoConsentAt: data.photoConsent ? new Date() : null,
        createdById: user.id,
        allergies: {
          create: data.allergies.map((label) => ({ label })),
        },
      },
      select: { id: true },
    });

    await audit({
      clinicId: user.clinicId,
      userId: user.id,
      action: "patient.create",
      entity: "Patient",
      entityId: created.id,
      payload: { firstName: data.firstName, lastName: data.lastName, cin: data.cin ?? null },
    });

    revalidatePath("/patients");
    return ok(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("CIN_CONFLICT", "A patient with this CIN already exists", {
        cin: ["CIN_CONFLICT"],
      });
    }
    throw err;
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updatePatient(raw: UpdatePatientInput): Promise<Result<{ id: string }>> {
  const user = await requireAuth();
  const parsed = updatePatientSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid patient data", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.patient.findFirst({
    where: { id: data.id, clinicId: user.clinicId, deletedAt: null },
    select: { id: true, photoConsent: true },
  });
  if (!existing) {
    return fail("NOT_FOUND", "Patient not found");
  }

  const newConsent = data.photoConsent;
  const consentChanged = newConsent !== existing.photoConsent;

  try {
    await db.$transaction([
      db.patient.update({
        where: { id: data.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          cin: data.cin ?? null,
          phone: data.phone,
          email: data.email ?? null,
          dob: new Date(data.dob),
          gender: data.gender ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          bloodGroup: data.bloodGroup ?? null,
          medicalHistory: data.medicalHistory ?? null,
          preferredChannel: data.preferredChannel,
          preferredLocale: data.preferredLocale,
          photoConsent: newConsent,
          photoConsentAt: consentChanged && newConsent ? new Date() : undefined,
        },
      }),
      // Re-sync allergies: simplest correct approach for small lists.
      db.patientAllergy.deleteMany({ where: { patientId: data.id } }),
      ...(data.allergies.length
        ? [
            db.patientAllergy.createMany({
              data: data.allergies.map((label) => ({ patientId: data.id, label })),
            }),
          ]
        : []),
    ]);

    await audit({
      clinicId: user.clinicId,
      userId: user.id,
      action: "patient.update",
      entity: "Patient",
      entityId: data.id,
      payload: { fields: Object.keys(data) },
    });

    revalidatePath("/patients");
    revalidatePath(`/patients/${data.id}`);
    return ok({ id: data.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("CIN_CONFLICT", "A patient with this CIN already exists", {
        cin: ["CIN_CONFLICT"],
      });
    }
    throw err;
  }
}

// ─── Soft delete (admin only) ────────────────────────────────────────────────

export async function softDeletePatient(id: string): Promise<Result<null>> {
  const user = await requireRole([UserRole.ADMIN]);
  if (!canDeletePatient(user.role)) {
    return fail("FORBIDDEN", "Not allowed");
  }

  const result = await db.patient.updateMany({
    where: { id, clinicId: user.clinicId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return fail("NOT_FOUND", "Patient not found");
  }

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "patient.softDelete",
    entity: "Patient",
    entityId: id,
  });

  revalidatePath("/patients");
  return ok(null);
}
