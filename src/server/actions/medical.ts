"use server";

import { revalidatePath } from "next/cache";
import {
  RadiographKind,
  TreatmentPhotoStage,
  UserRole,
  type Radiograph,
  type TreatmentPhoto,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createMedicalNoteSchema,
  createRadiographSchema,
  createTreatmentPhotoSchema,
  updateMedicalNoteSchema,
  type CreateMedicalNoteInput,
  type CreateRadiographInput,
  type CreateTreatmentPhotoInput,
  type UpdateMedicalNoteInput,
} from "@/server/schemas/medical";
import { deleteAsset, deliveryUrl, uploadFile } from "@/lib/cloudinary/client";
import type {
  MedicalNoteListItem,
  RadiographListItem,
  TimelineEntry,
  TreatmentPhotoListItem,
} from "./medical-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
/// Receptionists can take photos at the front desk; only clinicians upload radios.
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image — generous for radiographs
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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

async function assertPatient(args: { patientId: string; clinicId: string }) {
  return db.patient.findFirst({
    where: { id: args.patientId, clinicId: args.clinicId, deletedAt: null },
    select: { id: true, photoConsent: true, firstName: true, lastName: true },
  });
}

// ─── Medical notes ──────────────────────────────────────────────────────────

export async function listMedicalNotes(
  patientId: string,
): Promise<Result<MedicalNoteListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await assertPatient({ patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.medicalNote.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { fullName: true } } },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      appointmentId: r.appointmentId,
      authorName: r.author.fullName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

/**
 * Clinical notes scoped to a single appointment. Used in the appointment edit
 * page so the dentist can record observations (caries, scaling depth, etc.)
 * directly in the séance — those notes also surface in the patient timeline.
 */
export async function listAppointmentNotes(
  appointmentId: string,
): Promise<Result<MedicalNoteListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  // Confirm the appointment exists in this clinic before exposing notes.
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!appt) return fail("APPOINTMENT_NOT_FOUND", "Appointment not found");

  const rows = await db.medicalNote.findMany({
    where: { clinicId: user.clinicId, appointmentId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { fullName: true } } },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      appointmentId: r.appointmentId,
      authorName: r.author.fullName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

export async function createMedicalNote(
  raw: CreateMedicalNoteInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createMedicalNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid note", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await assertPatient({ patientId: data.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  // If appointmentId is set, confirm it belongs to this patient + clinic.
  if (data.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: { id: data.appointmentId, clinicId: user.clinicId, patientId: data.patientId },
      select: { id: true },
    });
    if (!appt) {
      return fail("APPOINTMENT_NOT_FOUND", "Appointment not found", {
        appointmentId: ["NOT_FOUND"],
      });
    }
  }

  const note = await db.medicalNote.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      appointmentId: data.appointmentId ?? null,
      authorId: user.id,
      title: data.title ?? null,
      body: data.body,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "MedicalNote",
    entityId: note.id,
    payload: { patientId: data.patientId },
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: note.id });
}

export async function updateMedicalNote(
  raw: UpdateMedicalNoteInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = updateMedicalNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid note", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.medicalNote.findFirst({
    where: { id: data.id, clinicId: user.clinicId, patientId: data.patientId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Note not found");

  await db.medicalNote.update({
    where: { id: data.id },
    data: { title: data.title ?? null, body: data.body },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "MedicalNote",
    entityId: data.id,
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: data.id });
}

export async function deleteMedicalNote(
  args: { id: string; patientId: string },
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.medicalNote.findFirst({
    where: { id: args.id, clinicId: user.clinicId, patientId: args.patientId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Note not found");

  await db.medicalNote.delete({ where: { id: args.id } });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "MedicalNote",
    entityId: args.id,
  });
  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ id: args.id });
}

// ─── Radiographs ────────────────────────────────────────────────────────────

export async function listRadiographs(
  patientId: string,
): Promise<Result<RadiographListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await assertPatient({ patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.radiograph.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { takenAt: "desc" },
    include: {
      dentist: { select: { firstName: true, lastName: true } },
      uploadedBy: { select: { fullName: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      takenAt: r.takenAt,
      note: r.note,
      dentistName: r.dentist ? `${r.dentist.firstName} ${r.dentist.lastName}` : null,
      uploaderName: r.uploadedBy.fullName,
      url: deliveryUrl(r.publicId),
      thumbnailUrl: deliveryUrl(r.publicId, { width: 320 }),
      createdAt: r.createdAt,
    })),
  );
}

/**
 * Create a radiograph row. Accepts a `FormData` rather than typed input so the
 * caller can pipe a file straight from `<form action={…}>` without a separate
 * upload endpoint. Field names mirror the Zod schema.
 */
export async function createRadiograph(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("FILE_REQUIRED", "File required", { file: ["REQUIRED"] });
  }
  if (file.size > MAX_BYTES) {
    return fail("FILE_TOO_LARGE", "File too large", { file: ["FILE_TOO_LARGE"] });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return fail("FILE_TYPE_NOT_ALLOWED", "Unsupported file type", {
      file: ["FILE_TYPE_NOT_ALLOWED"],
    });
  }

  const raw: CreateRadiographInput = {
    patientId: String(formData.get("patientId") ?? ""),
    dentistId: (formData.get("dentistId") as string | null) ?? undefined,
    kind: (formData.get("kind") as RadiographKind | null) ?? RadiographKind.PANORAMIC,
    takenAt: (formData.get("takenAt") as string | null) ?? undefined,
    note: (formData.get("note") as string | null) ?? undefined,
  };
  const parsed = createRadiographSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid radiograph", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await assertPatient({ patientId: data.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  if (data.dentistId) {
    const d = await db.dentist.findFirst({
      where: { id: data.dentistId, clinicId: user.clinicId },
      select: { id: true },
    });
    if (!d) return fail("DENTIST_NOT_FOUND", "Dentist not found");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await uploadFile(buffer, {
    clinicId: user.clinicId,
    bucket: "radiographs",
    filename: file.name,
    mimeType: file.type,
  });

  const takenAt = data.takenAt ? new Date(`${data.takenAt}T12:00:00`) : new Date();

  const row: Pick<Radiograph, "id"> = await db.radiograph.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      dentistId: data.dentistId ?? null,
      kind: data.kind,
      publicId: asset.publicId,
      format: asset.format ?? null,
      bytes: asset.bytes ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      takenAt,
      note: data.note ?? null,
      uploadedById: user.id,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "Radiograph",
    entityId: row.id,
    payload: { patientId: data.patientId, kind: data.kind },
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: row.id });
}

export async function deleteRadiograph(
  args: { id: string; patientId: string },
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.radiograph.findFirst({
    where: { id: args.id, clinicId: user.clinicId, patientId: args.patientId },
    select: { id: true, publicId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Radiograph not found");

  await db.radiograph.delete({ where: { id: args.id } });
  await deleteAsset(existing.publicId);

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "Radiograph",
    entityId: args.id,
  });
  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ id: args.id });
}

// ─── Treatment photos ───────────────────────────────────────────────────────

export async function listTreatmentPhotos(
  patientId: string,
): Promise<Result<TreatmentPhotoListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await assertPatient({ patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.treatmentPhoto.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: { createdAt: "desc" },
    include: {
      dentist: { select: { firstName: true, lastName: true } },
      uploadedBy: { select: { fullName: true } },
    },
  });

  return ok(
    rows.map((p) => ({
      id: p.id,
      stage: p.stage,
      caption: p.caption,
      dentistName: p.dentist ? `${p.dentist.firstName} ${p.dentist.lastName}` : null,
      appointmentId: p.appointmentId,
      uploaderName: p.uploadedBy.fullName,
      url: deliveryUrl(p.publicId),
      thumbnailUrl: deliveryUrl(p.publicId, { width: 320 }),
      createdAt: p.createdAt,
    })),
  );
}

export async function createTreatmentPhoto(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("FILE_REQUIRED", "File required", { file: ["REQUIRED"] });
  }
  if (file.size > MAX_BYTES) {
    return fail("FILE_TOO_LARGE", "File too large", { file: ["FILE_TOO_LARGE"] });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return fail("FILE_TYPE_NOT_ALLOWED", "Unsupported file type", {
      file: ["FILE_TYPE_NOT_ALLOWED"],
    });
  }

  const raw: CreateTreatmentPhotoInput = {
    patientId: String(formData.get("patientId") ?? ""),
    dentistId: (formData.get("dentistId") as string | null) ?? undefined,
    appointmentId: (formData.get("appointmentId") as string | null) ?? undefined,
    stage: (formData.get("stage") as TreatmentPhotoStage | null) ?? TreatmentPhotoStage.BEFORE,
    caption: (formData.get("caption") as string | null) ?? undefined,
  };
  const parsed = createTreatmentPhotoSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid photo", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await assertPatient({ patientId: data.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");
  // Photo consent gate — SPEC §4.5.
  if (!patient.photoConsent) {
    return fail("PHOTO_CONSENT_REQUIRED", "Patient has not granted photo consent");
  }

  if (data.dentistId) {
    const d = await db.dentist.findFirst({
      where: { id: data.dentistId, clinicId: user.clinicId },
      select: { id: true },
    });
    if (!d) return fail("DENTIST_NOT_FOUND", "Dentist not found");
  }
  if (data.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: { id: data.appointmentId, clinicId: user.clinicId, patientId: data.patientId },
      select: { id: true },
    });
    if (!appt) return fail("APPOINTMENT_NOT_FOUND", "Appointment not found");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await uploadFile(buffer, {
    clinicId: user.clinicId,
    bucket: "photos",
    filename: file.name,
    mimeType: file.type,
  });

  const row: Pick<TreatmentPhoto, "id"> = await db.treatmentPhoto.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      dentistId: data.dentistId ?? null,
      appointmentId: data.appointmentId ?? null,
      stage: data.stage,
      publicId: asset.publicId,
      format: asset.format ?? null,
      bytes: asset.bytes ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      caption: data.caption ?? null,
      uploadedById: user.id,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "TreatmentPhoto",
    entityId: row.id,
    payload: { patientId: data.patientId, stage: data.stage },
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: row.id });
}

export async function deleteTreatmentPhoto(
  args: { id: string; patientId: string },
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.treatmentPhoto.findFirst({
    where: { id: args.id, clinicId: user.clinicId, patientId: args.patientId },
    select: { id: true, publicId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Photo not found");

  await db.treatmentPhoto.delete({ where: { id: args.id } });
  await deleteAsset(existing.publicId);

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "TreatmentPhoto",
    entityId: args.id,
  });
  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ id: args.id });
}

/**
 * Used by the patient detail timeline — returns the union of notes + radiographs +
 * photos sorted by date, with a discriminator. Keeps the patient page single-query.
 */
export async function listMedicalTimeline(
  patientId: string,
): Promise<Result<TimelineEntry[]>> {
  const [notes, radios, photos] = await Promise.all([
    listMedicalNotes(patientId),
    listRadiographs(patientId),
    listTreatmentPhotos(patientId),
  ]);
  if (!notes.ok) return notes;
  if (!radios.ok) return radios;
  if (!photos.ok) return photos;

  const entries: TimelineEntry[] = [
    ...notes.data.map((n): TimelineEntry => ({ kind: "NOTE", date: n.createdAt, data: n })),
    ...radios.data.map((r): TimelineEntry => ({ kind: "RADIOGRAPH", date: r.takenAt, data: r })),
    ...photos.data.map((p): TimelineEntry => ({ kind: "PHOTO", date: p.createdAt, data: p })),
  ];
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  return ok(entries);
}
