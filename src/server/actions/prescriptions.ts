"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  type CreatePrescriptionInput,
  type UpdatePrescriptionInput,
} from "@/server/schemas/prescription";
import type {
  PrescriptionDetail,
  PrescriptionListItem,
} from "./prescriptions-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;

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

// ─── List + detail ──────────────────────────────────────────────────────────

export async function listPrescriptionsForPatient(
  patientId: string,
): Promise<Result<PrescriptionListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await db.patient.findFirst({
    where: { id: patientId, clinicId: user.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.prescription.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { issuedAt: "desc" },
    include: {
      dentist: { select: { firstName: true, lastName: true } },
      _count: { select: { items: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      dentistId: r.dentistId,
      dentistName: `${r.dentist.firstName} ${r.dentist.lastName}`,
      appointmentId: r.appointmentId,
      locale: r.locale,
      notes: r.notes,
      issuedAt: r.issuedAt,
      itemCount: r._count.items,
    })),
  );
}

/**
 * Detail used for the print/preview page. Pulls patient + clinic metadata in
 * one shot so the renderer doesn't need extra round-trips.
 */
export async function getPrescription(
  id: string,
): Promise<Result<PrescriptionDetail>> {
  const user = await requireRole([...ANY_STAFF]);
  const row = await db.prescription.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      dentist: { select: { firstName: true, lastName: true } },
      patient: { select: { firstName: true, lastName: true, dob: true, cin: true, phone: true } },
      clinic: { select: { name: true, address: true, phone: true, logoUrl: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) return fail("NOT_FOUND", "Prescription not found");

  return ok({
    id: row.id,
    patientId: row.patientId,
    dentistId: row.dentistId,
    dentistName: `${row.dentist.firstName} ${row.dentist.lastName}`,
    appointmentId: row.appointmentId,
    locale: row.locale,
    notes: row.notes,
    issuedAt: row.issuedAt,
    itemCount: row.items.length,
    items: row.items.map((i) => ({
      id: i.id,
      drug: i.drug,
      dosage: i.dosage,
      frequency: i.frequency,
      duration: i.duration,
      instructions: i.instructions,
      sortOrder: i.sortOrder,
    })),
    patientName: `${row.patient.firstName} ${row.patient.lastName}`,
    patientDob: row.patient.dob,
    patientCin: row.patient.cin,
    patientPhone: row.patient.phone,
    clinicName: row.clinic.name,
    clinicAddress: row.clinic.address,
    clinicPhone: row.clinic.phone,
    clinicLogoUrl: row.clinic.logoUrl,
  });
}

// ─── Create + update + delete ───────────────────────────────────────────────

export async function createPrescription(
  raw: CreatePrescriptionInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createPrescriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid prescription", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const [patient, dentist] = await Promise.all([
    db.patient.findFirst({
      where: { id: data.patientId, clinicId: user.clinicId, deletedAt: null },
      select: { id: true, preferredLocale: true },
    }),
    db.dentist.findFirst({
      where: { id: data.dentistId, clinicId: user.clinicId },
      select: { id: true },
    }),
  ]);
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");
  if (!dentist) return fail("DENTIST_NOT_FOUND", "Dentist not found");

  if (data.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: {
        id: data.appointmentId,
        clinicId: user.clinicId,
        patientId: data.patientId,
      },
      select: { id: true },
    });
    if (!appt) return fail("APPOINTMENT_NOT_FOUND", "Appointment not found");
  }

  const row = await db.prescription.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      dentistId: data.dentistId,
      appointmentId: data.appointmentId ?? null,
      // Snapshot the patient's preferred locale at issue time unless the
      // dentist overrode it on the form.
      locale: data.locale ?? patient.preferredLocale ?? "fr",
      notes: data.notes ?? null,
      createdById: user.id,
      items: {
        create: data.items.map((it, i) => ({
          drug: it.drug,
          dosage: it.dosage ?? null,
          frequency: it.frequency ?? null,
          duration: it.duration ?? null,
          instructions: it.instructions ?? null,
          sortOrder: (i + 1) * 10,
        })),
      },
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "Prescription",
    entityId: row.id,
    payload: {
      patientId: data.patientId,
      dentistId: data.dentistId,
      itemCount: data.items.length,
    },
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  if (data.appointmentId) {
    revalidatePath(`/[locale]/appointments/${data.appointmentId}/edit`, "page");
  }
  return ok({ id: row.id });
}

export async function updatePrescription(
  raw: UpdatePrescriptionInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = updatePrescriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid prescription", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.prescription.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, patientId: true, appointmentId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Prescription not found");

  // Replace-all strategy for items: simpler than diffing and the document is
  // small (≤20 lines). The cascade delete is set on the FK.
  await db.$transaction(async (tx) => {
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId: data.id } });
    await tx.prescription.update({
      where: { id: data.id },
      data: {
        dentistId: data.dentistId,
        appointmentId: data.appointmentId ?? null,
        locale: data.locale,
        notes: data.notes ?? null,
        items: {
          create: data.items.map((it, i) => ({
            drug: it.drug,
            dosage: it.dosage ?? null,
            frequency: it.frequency ?? null,
            duration: it.duration ?? null,
            instructions: it.instructions ?? null,
            sortOrder: (i + 1) * 10,
          })),
        },
      },
    });
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "Prescription",
    entityId: data.id,
  });

  revalidatePath(`/[locale]/patients/${existing.patientId}`, "page");
  revalidatePath(`/[locale]/prescriptions/${data.id}`, "page");
  return ok({ id: data.id });
}

export async function deletePrescription(
  args: { id: string; patientId: string },
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.prescription.findFirst({
    where: { id: args.id, clinicId: user.clinicId, patientId: args.patientId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Prescription not found");

  await db.prescription.delete({ where: { id: args.id } });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "Prescription",
    entityId: args.id,
  });
  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ id: args.id });
}
