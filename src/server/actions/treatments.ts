"use server";

import { revalidatePath } from "next/cache";
import { TreatmentApplicationStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createApplicationSchema,
  createCatalogItemSchema,
  updateApplicationSchema,
  updateCatalogItemSchema,
  type CreateApplicationInput,
  type CreateCatalogItemInput,
  type UpdateApplicationInput,
  type UpdateCatalogItemInput,
} from "@/server/schemas/treatment";
import type {
  ApplicationListItem,
  CatalogItemListItem,
} from "./treatments-types";
import { generateRecallsFromApplication } from "./recalls";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;
const ADMIN_ONLY = [UserRole.ADMIN] as const;

function zodFieldsFromError(error: unknown): Record<string, string[]> {
  if (!(error instanceof Object) || !("issues" in error)) return {};
  const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/**
 * Computes the line total after applying either the percentage or the fixed
 * discount. Percentage takes precedence per the schema's mutual-exclusion
 * refine — but we double-defensive here in case both slip through.
 */
function computeLineTotal(unitPrice: number, pct: number | null, amt: number | null): number {
  if (pct !== null) return Math.max(0, unitPrice - (unitPrice * pct) / 100);
  if (amt !== null) return Math.max(0, unitPrice - amt);
  return unitPrice;
}

// ─── Catalog ────────────────────────────────────────────────────────────────

export async function listCatalogItems(
  includeInactive = false,
): Promise<Result<CatalogItemListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const rows = await db.treatmentCatalogItem.findMany({
    where: {
      clinicId: user.clinicId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      defaultPrice: Number(r.defaultPrice),
      defaultDurationMin: r.defaultDurationMin,
      requiresTooth: r.requiresTooth,
      color: r.color,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    })),
  );
}

export async function createCatalogItem(
  raw: CreateCatalogItemInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const parsed = createCatalogItemSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid treatment", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  // Code is unique within a clinic — surface a clean error instead of letting
  // the unique constraint blow up.
  const dup = await db.treatmentCatalogItem.findUnique({
    where: { clinicId_code: { clinicId: user.clinicId, code: data.code } },
    select: { id: true },
  });
  if (dup) return fail("DUPLICATE_CODE", "Code already exists", { code: ["DUPLICATE"] });

  const row = await db.treatmentCatalogItem.create({
    data: {
      clinicId: user.clinicId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      defaultPrice: data.defaultPrice,
      defaultDurationMin: data.defaultDurationMin,
      requiresTooth: data.requiresTooth,
      color: data.color,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "TreatmentCatalogItem",
    entityId: row.id,
    payload: { code: data.code, name: data.name },
  });
  revalidatePath("/[locale]/settings/treatments", "page");
  return ok({ id: row.id });
}

export async function updateCatalogItem(
  raw: UpdateCatalogItemInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const parsed = updateCatalogItemSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid treatment", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.treatmentCatalogItem.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, code: true },
  });
  if (!existing) return fail("NOT_FOUND", "Treatment not found");

  // Allow editing the code as long as it doesn't collide.
  if (existing.code !== data.code) {
    const dup = await db.treatmentCatalogItem.findUnique({
      where: { clinicId_code: { clinicId: user.clinicId, code: data.code } },
      select: { id: true },
    });
    if (dup && dup.id !== data.id) {
      return fail("DUPLICATE_CODE", "Code already exists", { code: ["DUPLICATE"] });
    }
  }

  await db.treatmentCatalogItem.update({
    where: { id: data.id },
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      defaultPrice: data.defaultPrice,
      defaultDurationMin: data.defaultDurationMin,
      requiresTooth: data.requiresTooth,
      color: data.color,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "TreatmentCatalogItem",
    entityId: data.id,
  });
  revalidatePath("/[locale]/settings/treatments", "page");
  return ok({ id: data.id });
}

export async function deactivateCatalogItem(id: string): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const existing = await db.treatmentCatalogItem.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Treatment not found");

  await db.treatmentCatalogItem.update({
    where: { id },
    data: { isActive: false },
  });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "deactivate",
    entity: "TreatmentCatalogItem",
    entityId: id,
  });
  revalidatePath("/[locale]/settings/treatments", "page");
  return ok({ id });
}

// ─── Applications ───────────────────────────────────────────────────────────

export async function listApplicationsForAppointment(
  appointmentId: string,
): Promise<Result<ApplicationListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  // Defense-in-depth: confirm the appointment belongs to the user's clinic.
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!appt) return fail("APPOINTMENT_NOT_FOUND", "Appointment not found");

  const rows = await db.treatmentApplication.findMany({
    where: { clinicId: user.clinicId, appointmentId },
    orderBy: { createdAt: "asc" },
    include: {
      catalogItem: { select: { code: true, name: true, color: true } },
      dentist: { select: { firstName: true, lastName: true } },
    },
  });

  return ok(rows.map(serializeApplication));
}

export async function listApplicationsForPatient(
  patientId: string,
): Promise<Result<ApplicationListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: user.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.treatmentApplication.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { createdAt: "desc" },
    include: {
      catalogItem: { select: { code: true, name: true, color: true } },
      dentist: { select: { firstName: true, lastName: true } },
    },
  });

  return ok(rows.map(serializeApplication));
}

export async function createApplication(
  raw: CreateApplicationInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid application", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const [patient, catalogItem] = await Promise.all([
    db.patient.findFirst({
      where: { id: data.patientId, clinicId: user.clinicId, deletedAt: null },
      select: { id: true },
    }),
    db.treatmentCatalogItem.findFirst({
      where: { id: data.catalogItemId, clinicId: user.clinicId },
      select: { id: true, requiresTooth: true },
    }),
  ]);
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");
  if (!catalogItem) return fail("CATALOG_ITEM_NOT_FOUND", "Treatment not in catalog");

  // If the catalog item flags `requiresTooth`, enforce it at the action layer
  // (the schema can't see the catalog flag).
  if (catalogItem.requiresTooth && data.toothNumber === undefined) {
    return fail("TOOTH_REQUIRED", "Tooth number required", { toothNumber: ["REQUIRED"] });
  }

  if (data.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: { id: data.appointmentId, clinicId: user.clinicId, patientId: data.patientId },
      select: { id: true },
    });
    if (!appt) return fail("APPOINTMENT_NOT_FOUND", "Appointment not found");
  }
  if (data.dentistId) {
    const dentist = await db.dentist.findFirst({
      where: { id: data.dentistId, clinicId: user.clinicId },
      select: { id: true },
    });
    if (!dentist) return fail("DENTIST_NOT_FOUND", "Dentist not found");
  }

  const row = await db.treatmentApplication.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      appointmentId: data.appointmentId ?? null,
      catalogItemId: data.catalogItemId,
      dentistId: data.dentistId ?? null,
      toothNumber: data.toothNumber ?? null,
      surfaces: data.surfaces,
      status: data.status,
      unitPrice: data.unitPrice,
      discountPct: data.discountPct ?? null,
      discountAmount: data.discountAmount ?? null,
      notes: data.notes ?? null,
      performedAt:
        data.status === TreatmentApplicationStatus.COMPLETED ? new Date() : null,
      createdById: user.id,
    },
    select: { id: true },
  });

  // When a treatment is created directly as COMPLETED, fire the recall hook
  // (same logic as the COMPLETED transition in `updateApplication`).
  if (data.status === TreatmentApplicationStatus.COMPLETED) {
    const fresh = await db.treatmentCatalogItem.findUnique({
      where: { id: data.catalogItemId },
      select: { code: true },
    });
    if (fresh) {
      await generateRecallsFromApplication({
        clinicId: user.clinicId,
        patientId: data.patientId,
        catalogCode: fresh.code,
        createdById: user.id,
      });
    }
  }

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "TreatmentApplication",
    entityId: row.id,
    payload: {
      patientId: data.patientId,
      catalogItemId: data.catalogItemId,
      toothNumber: data.toothNumber,
    },
  });

  if (data.appointmentId) {
    revalidatePath(`/[locale]/appointments/${data.appointmentId}/edit`, "page");
  }
  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: row.id });
}

export async function updateApplication(
  raw: UpdateApplicationInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = updateApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid application", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.treatmentApplication.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: {
      id: true,
      patientId: true,
      appointmentId: true,
      status: true,
      performedAt: true,
    },
  });
  if (!existing) return fail("NOT_FOUND", "Application not found");

  // Stamp `performedAt` on transition to COMPLETED (and clear it on revert).
  let performedAt = existing.performedAt;
  if (
    data.status === TreatmentApplicationStatus.COMPLETED &&
    existing.status !== TreatmentApplicationStatus.COMPLETED
  ) {
    performedAt = new Date();
  } else if (
    data.status !== TreatmentApplicationStatus.COMPLETED &&
    existing.status === TreatmentApplicationStatus.COMPLETED
  ) {
    performedAt = null;
  }

  await db.treatmentApplication.update({
    where: { id: data.id },
    data: {
      appointmentId: data.appointmentId ?? null,
      dentistId: data.dentistId ?? null,
      toothNumber: data.toothNumber ?? null,
      surfaces: data.surfaces,
      status: data.status,
      unitPrice: data.unitPrice,
      discountPct: data.discountPct ?? null,
      discountAmount: data.discountAmount ?? null,
      notes: data.notes ?? null,
      performedAt,
    },
  });

  // Auto-generate a recall reminder on transition to COMPLETED. We look up
  // the catalog code here (the update payload doesn't carry it) — best-effort,
  // and idempotent inside `generateRecallsFromApplication`.
  if (
    data.status === TreatmentApplicationStatus.COMPLETED &&
    existing.status !== TreatmentApplicationStatus.COMPLETED
  ) {
    const fresh = await db.treatmentApplication.findUnique({
      where: { id: data.id },
      select: { catalogItem: { select: { code: true } } },
    });
    if (fresh) {
      await generateRecallsFromApplication({
        clinicId: user.clinicId,
        patientId: existing.patientId,
        catalogCode: fresh.catalogItem.code,
        createdById: user.id,
      });
    }
  }

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "TreatmentApplication",
    entityId: data.id,
  });

  if (existing.appointmentId) {
    revalidatePath(`/[locale]/appointments/${existing.appointmentId}/edit`, "page");
  }
  revalidatePath(`/[locale]/patients/${existing.patientId}`, "page");
  return ok({ id: data.id });
}

export async function deleteApplication(id: string): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.treatmentApplication.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, patientId: true, appointmentId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Application not found");

  await db.treatmentApplication.delete({ where: { id } });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "TreatmentApplication",
    entityId: id,
  });

  if (existing.appointmentId) {
    revalidatePath(`/[locale]/appointments/${existing.appointmentId}/edit`, "page");
  }
  revalidatePath(`/[locale]/patients/${existing.patientId}`, "page");
  return ok({ id });
}

// ─── helpers ────────────────────────────────────────────────────────────────

type ApplicationRowWithRelations = {
  id: string;
  patientId: string;
  appointmentId: string | null;
  catalogItemId: string;
  catalogItem: { code: string; name: string; color: string };
  dentistId: string | null;
  dentist: { firstName: string; lastName: string } | null;
  toothNumber: number | null;
  surfaces: ApplicationListItem["surfaces"];
  status: ApplicationListItem["status"];
  unitPrice: { toNumber(): number };
  discountPct: { toNumber(): number } | null;
  discountAmount: { toNumber(): number } | null;
  notes: string | null;
  performedAt: Date | null;
  createdAt: Date;
};

function serializeApplication(r: ApplicationRowWithRelations): ApplicationListItem {
  const unitPrice = Number(r.unitPrice);
  const discountPct = r.discountPct !== null ? Number(r.discountPct) : null;
  const discountAmount = r.discountAmount !== null ? Number(r.discountAmount) : null;
  return {
    id: r.id,
    patientId: r.patientId,
    appointmentId: r.appointmentId,
    catalogItemId: r.catalogItemId,
    catalogCode: r.catalogItem.code,
    catalogName: r.catalogItem.name,
    catalogColor: r.catalogItem.color,
    dentistId: r.dentistId,
    dentistName: r.dentist ? `${r.dentist.firstName} ${r.dentist.lastName}` : null,
    toothNumber: r.toothNumber,
    surfaces: r.surfaces,
    status: r.status,
    unitPrice,
    discountPct,
    discountAmount,
    lineTotal: computeLineTotal(unitPrice, discountPct, discountAmount),
    notes: r.notes,
    performedAt: r.performedAt,
    createdAt: r.createdAt,
  };
}
