"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  RecallKind,
  RecallStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createRecallSchema,
  disableRecallSchema,
  listRecallsSchema,
  type CreateRecallInput,
  type DisableRecallInput,
  type ListRecallsInput,
} from "@/server/schemas/recall";
import type { RecallListItem } from "./recalls-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;

const APPROACHING_DAYS = 30;

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

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  const target = out.getMonth() + n;
  out.setMonth(target);
  if (out.getMonth() !== ((target % 12) + 12) % 12) out.setDate(0);
  return out;
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listRecalls(
  raw: Partial<ListRecallsInput> = {},
): Promise<Result<RecallListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = listRecallsSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid params", zodFieldsFromError(parsed.error));
  }
  const { status, patientId } = parsed.data;
  const where: Prisma.RecallReminderWhereInput = { clinicId: user.clinicId };
  if (patientId) where.patientId = patientId;
  if (status === "OPEN") where.status = { in: [RecallStatus.PENDING, RecallStatus.SENT] };
  else if (status !== "all") where.status = status;

  const rows = await db.recallReminder.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + APPROACHING_DAYS);

  return ok(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: `${r.patient.firstName} ${r.patient.lastName}`,
      patientPhone: r.patient.phone,
      kind: r.kind,
      dueDate: r.dueDate,
      status: r.status,
      reason: r.reason,
      sentAt: r.sentAt,
      bookedAt: r.bookedAt,
      isApproaching:
        r.status === RecallStatus.PENDING && r.dueDate >= today && r.dueDate <= horizon,
      isOverdue: r.status === RecallStatus.PENDING && r.dueDate < today,
    })),
  );
}

// ─── Manual create / disable ────────────────────────────────────────────────

export async function createRecall(
  raw: CreateRecallInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = createRecallSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid recall", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await db.patient.findFirst({
    where: { id: data.patientId, clinicId: user.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const row = await db.recallReminder.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      kind: data.kind,
      dueDate: new Date(`${data.dueDate}T12:00:00`),
      reason: data.reason ?? null,
      createdById: user.id,
    },
    select: { id: true },
  });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "RecallReminder",
    entityId: row.id,
    payload: { patientId: data.patientId, kind: data.kind },
  });
  revalidatePath("/[locale]/recalls", "page");
  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: row.id });
}

export async function disableRecall(
  raw: DisableRecallInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = disableRecallSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const { id, reason } = parsed.data;
  const existing = await db.recallReminder.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, patientId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Recall not found");

  await db.recallReminder.update({
    where: { id },
    data: {
      status: RecallStatus.DISABLED,
      disabledAt: new Date(),
      disabledReason: reason ?? null,
    },
  });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "disable",
    entity: "RecallReminder",
    entityId: id,
    payload: { reason },
  });
  revalidatePath("/[locale]/recalls", "page");
  revalidatePath(`/[locale]/patients/${existing.patientId}`, "page");
  return ok({ id });
}

/**
 * Re-arms a previously sent or disabled recall by resetting it to PENDING
 * with a fresh due date. Useful when a patient asks to be reminded again.
 */
export async function regenerateRecall(args: {
  id: string;
  dueDate: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.recallReminder.findFirst({
    where: { id: args.id, clinicId: user.clinicId },
    select: { id: true, patientId: true },
  });
  if (!existing) return fail("NOT_FOUND", "Recall not found");

  await db.recallReminder.update({
    where: { id: args.id },
    data: {
      status: RecallStatus.PENDING,
      dueDate: new Date(`${args.dueDate}T12:00:00`),
      sentAt: null,
      bookedAt: null,
      disabledAt: null,
      disabledReason: null,
    },
  });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "regenerate",
    entity: "RecallReminder",
    entityId: args.id,
  });
  revalidatePath("/[locale]/recalls", "page");
  revalidatePath(`/[locale]/patients/${existing.patientId}`, "page");
  return ok({ id: args.id });
}

// ─── Auto-generation from completed treatments ──────────────────────────────

/**
 * Treatment catalog code → recall config. Mapping based on common dental
 * practice: scaling at 6 months, crowns at 3 months (post-op check), etc.
 * Codes not listed here don't trigger an auto-recall.
 */
const TREATMENT_RECALL_RULES: Record<
  string,
  { kind: RecallKind; months: number; reason: string }
> = {
  // Hygiène / prévention
  DET: { kind: RecallKind.SCALING, months: 6, reason: "Détartrage de suivi (6 mois)" },
  BLANC: { kind: RecallKind.SCALING, months: 6, reason: "Entretien blanchiment (6 mois)" },
  // Restaurations — contrôle annuel
  COMP1: { kind: RecallKind.ANNUAL_CHECKUP, months: 12, reason: "Contrôle composite (1 an)" },
  COMP3: { kind: RecallKind.ANNUAL_CHECKUP, months: 12, reason: "Contrôle composite (1 an)" },
  // Endodontie + prothèses — contrôle post-op à 3 mois
  ENDO1: { kind: RecallKind.IMPLANT_FOLLOWUP, months: 3, reason: "Contrôle endodontique (3 mois)" },
  ENDO3: { kind: RecallKind.IMPLANT_FOLLOWUP, months: 3, reason: "Contrôle endodontique (3 mois)" },
  COUR: { kind: RecallKind.IMPLANT_FOLLOWUP, months: 3, reason: "Contrôle couronne (3 mois)" },
  // Chirurgie — cicatrisation à 1 mois
  EXT: { kind: RecallKind.POST_EXTRACTION, months: 1, reason: "Contrôle cicatrisation (1 mois)" },
  EXTC: { kind: RecallKind.POST_EXTRACTION, months: 1, reason: "Contrôle post-extraction" },
};

/**
 * Hook called from `updateApplication` (Phase 6) when a TreatmentApplication
 * transitions to COMPLETED. Idempotent: if a PENDING recall of the same kind
 * already exists for this patient, we skip — avoids duplicates when a séance
 * is re-saved.
 */
export async function generateRecallsFromApplication(args: {
  clinicId: string;
  patientId: string;
  catalogCode: string;
  createdById: string;
}): Promise<void> {
  const rule = TREATMENT_RECALL_RULES[args.catalogCode];
  if (!rule) return;

  const dueDate = addMonths(new Date(), rule.months);
  dueDate.setHours(12, 0, 0, 0);

  const existing = await db.recallReminder.findFirst({
    where: {
      clinicId: args.clinicId,
      patientId: args.patientId,
      kind: rule.kind,
      status: RecallStatus.PENDING,
    },
    select: { id: true },
  });
  if (existing) return;

  await db.recallReminder.create({
    data: {
      clinicId: args.clinicId,
      patientId: args.patientId,
      kind: rule.kind,
      dueDate,
      reason: rule.reason,
      createdById: args.createdById,
    },
  });
}
