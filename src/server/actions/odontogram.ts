"use server";

import { revalidatePath } from "next/cache";
import {
  DentalCondition,
  TreatmentApplicationStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  generatePlanSchema,
  recordEntrySchema,
  type GeneratePlanInput,
  type RecordEntryInput,
} from "@/server/schemas/odontogram";
import type {
  ChartHistoryEntry,
  PlanProposalItem,
  ToothState,
} from "./odontogram-types";

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

async function assertPatient(args: { patientId: string; clinicId: string }) {
  return db.patient.findFirst({
    where: { id: args.patientId, clinicId: args.clinicId, deletedAt: null },
    select: { id: true },
  });
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Returns the **current** condition of every tooth that has any entry, keyed
 * by FDI number. Teeth with no entry are simply absent from the map — the UI
 * treats them as default (no diagnosis yet).
 *
 * Implementation: fetches all entries ordered by recordedAt DESC and keeps the
 * first one per tooth. Postgres `DISTINCT ON` would be faster on huge datasets
 * but a patient has at most ~32 teeth × ~5 history entries = 160 rows, so the
 * difference is negligible.
 */
export async function getPatientChart(
  patientId: string,
): Promise<Result<Map<number, ToothState>>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await assertPatient({ patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.dentalChartEntry.findMany({
    where: { clinicId: user.clinicId, patientId },
    orderBy: [{ toothNumber: "asc" }, { recordedAt: "desc" }],
    include: { recordedBy: { select: { fullName: true } } },
  });

  const map = new Map<number, ToothState>();
  for (const r of rows) {
    if (map.has(r.toothNumber)) continue; // first row per tooth = latest
    map.set(r.toothNumber, {
      toothNumber: r.toothNumber,
      condition: r.condition,
      surfaces: r.surfaces,
      note: r.note,
      recordedAt: r.recordedAt,
      recordedByName: r.recordedBy.fullName,
      entryId: r.id,
    });
  }
  return ok(map);
}

export async function getToothHistory(
  patientId: string,
  toothNumber: number,
): Promise<Result<ChartHistoryEntry[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const patient = await assertPatient({ patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const rows = await db.dentalChartEntry.findMany({
    where: { clinicId: user.clinicId, patientId, toothNumber },
    orderBy: { recordedAt: "desc" },
    include: { recordedBy: { select: { fullName: true } } },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      toothNumber: r.toothNumber,
      condition: r.condition,
      surfaces: r.surfaces,
      note: r.note,
      recordedAt: r.recordedAt,
      recordedByName: r.recordedBy.fullName,
    })),
  );
}

// ─── Write ──────────────────────────────────────────────────────────────────

export async function recordEntry(raw: RecordEntryInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = recordEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid entry", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await assertPatient({ patientId: data.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  const row = await db.dentalChartEntry.create({
    data: {
      clinicId: user.clinicId,
      patientId: data.patientId,
      toothNumber: data.toothNumber,
      condition: data.condition,
      surfaces: data.surfaces,
      note: data.note ?? null,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
      recordedById: user.id,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "DentalChartEntry",
    entityId: row.id,
    payload: {
      patientId: data.patientId,
      toothNumber: data.toothNumber,
      condition: data.condition,
    },
  });

  revalidatePath(`/[locale]/patients/${data.patientId}`, "page");
  return ok({ id: row.id });
}

export async function removeEntry(args: {
  id: string;
  patientId: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);
  const existing = await db.dentalChartEntry.findFirst({
    where: { id: args.id, clinicId: user.clinicId, patientId: args.patientId },
    select: { id: true },
  });
  if (!existing) return fail("NOT_FOUND", "Entry not found");

  await db.dentalChartEntry.delete({ where: { id: args.id } });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "delete",
    entity: "DentalChartEntry",
    entityId: args.id,
  });
  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ id: args.id });
}

// ─── Plan generation ────────────────────────────────────────────────────────

/**
 * Maps each condition to the catalog code(s) that typically address it. The
 * matching uses these codes against the clinic's catalog; if the clinic
 * deleted/renamed a code, the proposal returns `catalogItemId = null` and the
 * UI offers a free pick. Surface count escalates COMP1 → COMP3.
 */
const CONDITION_TO_CODES: Record<DentalCondition, string[]> = {
  HEALTHY: [],
  CARIES: ["COMP1", "COMP3"],
  FRACTURE: ["COMP3"],
  FILLING: [], // already treated
  CROWN: ["COUR"],
  IMPLANT: [], // already done
  MISSING: [],
  TO_EXTRACT: ["EXTC", "EXT"],
  DEVITALIZED: ["ENDO1", "ENDO3"],
  PROSTHESIS: [],
};

/**
 * Given a list of selected teeth, returns a proposal of treatments to add to
 * the patient's plan. Does NOT write anything — the dentist reviews and posts
 * a separate `commitPlanProposal` action.
 */
export async function generatePlanFromChart(
  raw: GeneratePlanInput,
): Promise<Result<PlanProposalItem[]>> {
  const user = await requireRole([...CLINICIAN]);
  const parsed = generatePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const patient = await assertPatient({ patientId: data.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  // Pull current state of the selected teeth in one query.
  const chartResult = await getPatientChart(data.patientId);
  if (!chartResult.ok) return chartResult;
  const chart = chartResult.data;

  // Load matching catalog items once.
  const catalog = await db.treatmentCatalogItem.findMany({
    where: { clinicId: user.clinicId, isActive: true },
    select: { id: true, code: true, name: true, defaultPrice: true },
  });
  const byCode = new Map(catalog.map((c) => [c.code, c]));

  const proposals: PlanProposalItem[] = [];
  for (const n of data.toothNumbers) {
    const state = chart.get(n);
    if (!state) continue;
    const codes = CONDITION_TO_CODES[state.condition];
    // Heuristic: > 1 surface → escalate to second code option when present.
    const code =
      state.surfaces.length > 1 && codes[1] ? codes[1] : codes[0] ?? null;
    const item = code ? byCode.get(code) ?? null : null;
    proposals.push({
      toothNumber: n,
      condition: state.condition,
      surfaces: state.surfaces,
      catalogItemId: item?.id ?? null,
      catalogCode: item?.code ?? null,
      catalogName: item?.name ?? null,
      defaultPrice: item ? Number(item.defaultPrice) : null,
      rationale: code
        ? `${state.condition} → ${code}`
        : `${state.condition} — pas de traitement standard, à compléter manuellement`,
    });
  }
  return ok(proposals);
}

/**
 * Persists the user-approved proposals as PLANNED `TreatmentApplication` rows.
 * Skips items without a catalog match (the UI should have warned). Returns
 * the count of created rows.
 */
export async function commitPlanProposal(args: {
  patientId: string;
  items: Array<{
    catalogItemId: string;
    toothNumber: number;
    surfaces: PlanProposalItem["surfaces"];
    unitPrice: number;
  }>;
}): Promise<Result<{ created: number }>> {
  const user = await requireRole([...CLINICIAN]);
  if (args.items.length === 0) return ok({ created: 0 });

  const patient = await assertPatient({ patientId: args.patientId, clinicId: user.clinicId });
  if (!patient) return fail("PATIENT_NOT_FOUND", "Patient not found");

  // Validate catalog items belong to clinic.
  const catalogIds = Array.from(new Set(args.items.map((i) => i.catalogItemId)));
  const validIds = new Set(
    (
      await db.treatmentCatalogItem.findMany({
        where: { id: { in: catalogIds }, clinicId: user.clinicId },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const accepted = args.items.filter((i) => validIds.has(i.catalogItemId));
  if (accepted.length === 0) return fail("NO_VALID_ITEMS", "Aucun acte valide");

  const created = await db.treatmentApplication.createMany({
    data: accepted.map((i) => ({
      clinicId: user.clinicId,
      patientId: args.patientId,
      catalogItemId: i.catalogItemId,
      toothNumber: i.toothNumber,
      surfaces: i.surfaces,
      status: TreatmentApplicationStatus.PLANNED,
      unitPrice: i.unitPrice,
      createdById: user.id,
    })),
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "TreatmentApplication",
    payload: { patientId: args.patientId, count: created.count, source: "odontogram" },
  });

  revalidatePath(`/[locale]/patients/${args.patientId}`, "page");
  return ok({ created: created.count });
}
