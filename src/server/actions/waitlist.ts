"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  AppointmentStatus,
  Prisma,
  UserRole,
  WaitlistStatus,
  WaitlistTimePreference,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import { sendTemplate } from "@/lib/whatsapp/client";
import { WAITLIST_SLOT_OFFERED } from "@/lib/whatsapp/templates";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";
import { addToWaitlistSchema, type AddToWaitlistInput } from "@/server/schemas/waitlist";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;

const PROPOSAL_TTL_MIN = 15;
const MAX_CANDIDATES_PER_SLOT = 5;

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

// ─── Public API: list / add / remove ─────────────────────────────────────────

export interface WaitlistItem {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  preferredLocale: string;
  dentistId: string | null;
  dentistName: string | null;
  durationMin: number;
  timePreference: WaitlistTimePreference;
  notBefore: Date | null;
  notAfter: Date | null;
  status: WaitlistStatus;
  reason: string | null;
  createdAt: Date;
  proposedExpiresAt: Date | null;
}

export async function listWaitlist(): Promise<Result<WaitlistItem[]>> {
  const user = await requireRole([...ANY_STAFF]);

  // Auto-expire stale proposals (best effort, idempotent).
  await db.waitlistEntry.updateMany({
    where: {
      clinicId: user.clinicId,
      status: WaitlistStatus.PROPOSED,
      proposedExpiresAt: { lt: new Date() },
    },
    data: {
      status: WaitlistStatus.WAITING,
      proposalToken: null,
      proposedAt: null,
      proposedExpiresAt: null,
      proposedSlotStart: null,
      proposedSlotEnd: null,
    },
  });

  const rows = await db.waitlistEntry.findMany({
    where: { clinicId: user.clinicId, status: { not: WaitlistStatus.CANCELLED } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true, preferredLocale: true } },
      dentist: { select: { firstName: true, lastName: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: `${r.patient.firstName} ${r.patient.lastName}`,
      patientPhone: r.patient.phone,
      preferredLocale: r.patient.preferredLocale,
      dentistId: r.dentistId,
      dentistName: r.dentist ? `${r.dentist.firstName} ${r.dentist.lastName}` : null,
      durationMin: r.durationMin,
      timePreference: r.timePreference,
      notBefore: r.notBefore,
      notAfter: r.notAfter,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      proposedExpiresAt: r.proposedExpiresAt,
    })),
  );
}

export async function addToWaitlist(raw: AddToWaitlistInput): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = addToWaitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid input", zodFieldsFromError(parsed.error));
  }
  const d = parsed.data;

  const created = await db.waitlistEntry.create({
    data: {
      clinicId: user.clinicId,
      patientId: d.patientId,
      dentistId: d.dentistId ?? null,
      durationMin: d.durationMin,
      timePreference: d.timePreference,
      notBefore: d.notBefore ? new Date(d.notBefore) : null,
      notAfter: d.notAfter ? new Date(d.notAfter) : null,
      reason: d.reason ?? null,
    },
    select: { id: true },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "waitlist.add",
    entity: "WaitlistEntry",
    entityId: created.id,
    payload: { patientId: d.patientId, dentistId: d.dentistId ?? null },
  });

  revalidatePath("/waitlist");
  revalidatePath("/appointments");
  return ok(created);
}

export async function removeFromWaitlist(id: string): Promise<Result<null>> {
  const user = await requireRole([...ANY_STAFF]);

  const entry = await db.waitlistEntry.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true },
  });
  if (!entry) return fail("NOT_FOUND", "Entry not found");
  if (entry.status === WaitlistStatus.ACCEPTED) {
    return fail("FORBIDDEN", "Cannot remove an accepted entry");
  }

  await db.waitlistEntry.update({
    where: { id },
    data: { status: WaitlistStatus.CANCELLED },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "waitlist.remove",
    entity: "WaitlistEntry",
    entityId: id,
  });

  revalidatePath("/waitlist");
  revalidatePath("/appointments");
  return ok(null);
}

export async function activeWaitlistCount(): Promise<number> {
  const user = await requireRole([...ANY_STAFF]);
  return db.waitlistEntry.count({
    where: {
      clinicId: user.clinicId,
      status: { in: [WaitlistStatus.WAITING, WaitlistStatus.PROPOSED] },
    },
  });
}

// ─── Internal: candidate matching when a slot opens up ───────────────────────

/**
 * Returns waitlist entries compatible with a newly freed slot. Sorted by
 * oldest `createdAt` (fairness — first in queue, first served).
 *
 * Compatibility rules:
 *   - status WAITING (we don't re-propose to PROPOSED entries already
 *     looking at a different slot — keeps things simple)
 *   - `dentistId IS NULL` OR `dentistId == slot.dentistId`
 *   - `durationMin <= slot duration`
 *   - timePreference matches (MORNING < 13:00 ; AFTERNOON >= 13:00 ; ANY any)
 *   - `notBefore <= slot start` (when set)
 *   - `notAfter >= slot start` (when set)
 */
export async function findWaitlistCandidates(args: {
  clinicId: string;
  dentistId: string;
  startAt: Date;
  endAt: Date;
}): Promise<Array<{ id: string; patientId: string }>> {
  // Defensive: when this is called from an Inngest event, dates can
  // come through as strings → `new Date(undefined)` → Invalid Date →
  // `.getTime()` returns NaN → Prisma's `lte` validation fails with
  // a cryptic "Argument lte is missing" error. Coerce to Date if
  // string was passed, then early-return cleanly if the result is
  // still not a valid date.
  const startAt = args.startAt instanceof Date ? args.startAt : new Date(args.startAt);
  const endAt = args.endAt instanceof Date ? args.endAt : new Date(args.endAt);
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    console.warn("[waitlist] invalid startAt/endAt, skipping match", {
      startAt: args.startAt,
      endAt: args.endAt,
    });
    return [];
  }
  const slotDuration = Math.max(1, Math.round((endMs - startMs) / 60_000));
  const slotHour = startAt.getHours();
  const morning = slotHour < 13;

  const candidates = await db.waitlistEntry.findMany({
    where: {
      clinicId: args.clinicId,
      status: WaitlistStatus.WAITING,
      OR: [{ dentistId: null }, { dentistId: args.dentistId }],
      durationMin: { lte: slotDuration },
      AND: [
        {
          OR: [
            { timePreference: WaitlistTimePreference.ANY },
            {
              timePreference: morning
                ? WaitlistTimePreference.MORNING
                : WaitlistTimePreference.AFTERNOON,
            },
          ],
        },
        { OR: [{ notBefore: null }, { notBefore: { lte: args.startAt } }] },
        { OR: [{ notAfter: null }, { notAfter: { gte: args.startAt } }] },
      ],
    },
    // Phase 11 Stage F : pull a wider raw set + score in-memory so the
    // top candidates are notified first (more relevant) rather than
    // every match getting the same template (spammy).
    orderBy: { createdAt: "asc" },
    take: MAX_CANDIDATES_PER_SLOT * 3,
    select: {
      id: true,
      patientId: true,
      dentistId: true,
      durationMin: true,
      timePreference: true,
      createdAt: true,
      reason: true,
    },
  });

  // ── Phase 11 Stage F — score & prioritise ───────────────────────────
  // Lower score = better candidate. Three signals :
  //   1. dentistId match (-30) — patient explicitly asked for THIS dentist
  //   2. waiting time — older entries get a small bonus per day waited
  //   3. urgency keyword in `reason` ("douleur", "urgence", "mal") → -20
  const URGENCY_RX = /\b(urgence|douleur|mal|saigne|abc[eè]s|gonfl|cass[eé])\b/i;
  const now = Date.now();
  const scored = candidates.map((c) => {
    let score = 0;
    if (c.dentistId === args.dentistId) score -= 30;
    if (c.timePreference !== WaitlistTimePreference.ANY) score -= 5;
    const daysWaiting = Math.floor((now - c.createdAt.getTime()) / 86_400_000);
    score -= Math.min(daysWaiting, 30); // cap at 30 days
    if (c.reason && URGENCY_RX.test(c.reason)) score -= 20;
    return { id: c.id, patientId: c.patientId, score };
  });

  scored.sort((a, b) => a.score - b.score);

  return scored
    .slice(0, MAX_CANDIDATES_PER_SLOT)
    .map(({ id, patientId }) => ({ id, patientId }));
}

/**
 * Reserves a freed slot for compatible waitlist candidates and notifies them.
 *
 * Called automatically by `cancelAppointment` (best-effort — wrapped so a
 * failure to notify doesn't roll back the cancel). Marks each candidate as
 * `PROPOSED` with a fresh proposal token, then sends the WhatsApp template
 * to every candidate in parallel.
 *
 * The race-condition guarantee is in `acceptWaitlistProposal`: only the first
 * accept wins (Postgres advisory lock on the slot key).
 */
export async function proposeSlotToWaitlist(args: {
  clinicId: string;
  dentistId: string;
  dentistName: string;
  clinicName: string;
  startAt: Date;
  endAt: Date;
}): Promise<{ proposedCount: number }> {
  const candidates = await findWaitlistCandidates({
    clinicId: args.clinicId,
    dentistId: args.dentistId,
    startAt: args.startAt,
    endAt: args.endAt,
  });
  if (candidates.length === 0) return { proposedCount: 0 };

  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MIN * 60_000);
  const proposalsByEntry = new Map<string, string>();

  // Mark each as PROPOSED + token in a single transaction.
  await db.$transaction(
    candidates.map((c) => {
      const token = randomBytes(32).toString("base64url");
      proposalsByEntry.set(c.id, token);
      return db.waitlistEntry.update({
        where: { id: c.id },
        data: {
          status: WaitlistStatus.PROPOSED,
          proposalToken: token,
          proposedAt: new Date(),
          proposedExpiresAt: expiresAt,
          proposedSlotStart: args.startAt,
          proposedSlotEnd: args.endAt,
        },
      });
    }),
  );

  // Fetch patient info needed for the template (one query, no N+1).
  const entries = await db.waitlistEntry.findMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    include: {
      patient: { select: { firstName: true, phone: true, preferredLocale: true } },
    },
  });

  const dateStr = formatDate(args.startAt, "fr");
  const timeStr = `${String(args.startAt.getHours()).padStart(2, "0")}:${String(args.startAt.getMinutes()).padStart(2, "0")}`;

  await Promise.allSettled(
    entries.map((e) => {
      const locale = (e.patient.preferredLocale as Locale) ?? "fr";
      const lang = locale === "en" ? "en" : "fr";
      return sendTemplate({
        to: e.patient.phone,
        template: WAITLIST_SLOT_OFFERED,
        locale: lang,
        params: {
          patientFirstName: e.patient.firstName,
          date: dateStr,
          time: timeStr,
          dentistName: `Dr ${args.dentistName}`,
          clinicName: args.clinicName,
          expiresIn: `${PROPOSAL_TTL_MIN} min`,
        },
      });
    }),
  );

  await audit({
    clinicId: args.clinicId,
    action: "waitlist.propose",
    entity: "WaitlistEntry",
    payload: {
      slotStart: args.startAt.toISOString(),
      slotEnd: args.endAt.toISOString(),
      candidates: candidates.length,
    },
  });

  return { proposedCount: candidates.length };
}

/**
 * Public action used by the patient's WhatsApp link to grab the offered slot.
 * Uses a Postgres advisory lock keyed on (dentistId, startAt) so that only
 * one concurrent acceptor wins. If we win the lock, we re-check the slot is
 * still free, create the appointment, mark the waitlist entry ACCEPTED, and
 * expire the sibling proposals.
 */
export async function acceptWaitlistProposal(
  token: string,
): Promise<Result<{ appointmentId: string }>> {
  // Public endpoint — no requireRole.
  const entry = await db.waitlistEntry.findUnique({
    where: { proposalToken: token },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!entry || entry.status !== WaitlistStatus.PROPOSED) {
    return fail("INVALID_TOKEN", "Proposal invalid or already taken");
  }
  if (!entry.proposedSlotStart || !entry.proposedSlotEnd || !entry.dentistId) {
    return fail("INVALID_TOKEN", "Proposal payload missing");
  }
  if (entry.proposedExpiresAt && entry.proposedExpiresAt < new Date()) {
    return fail("EXPIRED", "Proposal expired");
  }

  const slotStart = entry.proposedSlotStart;
  const slotEnd = entry.proposedSlotEnd;
  const dentistId = entry.dentistId;
  // Build a deterministic int4 key for the advisory lock: low 32 bits of a
  // hash of `dentistId:startMs`. Two simultaneous acceptors for the same
  // slot will collide on the lock; the loser sees `CONFLICT`.
  const lockKey = await advisoryLockKey(`${dentistId}:${slotStart.getTime()}`);

  try {
    const appointmentId = await db.$transaction(async (tx) => {
      // Acquire the advisory lock (transaction-scoped → auto-released).
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${lockKey}::int)`);

      // Re-check: is the slot still free?
      const conflict = await tx.appointment.findFirst({
        where: {
          clinicId: entry.clinicId,
          dentistId,
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
            ],
          },
          startAt: { lt: slotEnd },
          endAt: { gt: slotStart },
        },
        select: { id: true },
      });
      if (conflict) {
        throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
      }

      const appointment = await tx.appointment.create({
        data: {
          clinicId: entry.clinicId,
          patientId: entry.patientId,
          dentistId,
          startAt: slotStart,
          endAt: slotEnd,
          reason: entry.reason ?? "Liste d'attente",
          status: AppointmentStatus.CONFIRMED, // accept = confirmed
          confirmationReceivedAt: new Date(),
          // Audit trail: the patient created this themselves through WA, but
          // we still need a User reference. Fall back to the clinic admin.
          createdById: await firstAdminId(tx, entry.clinicId),
        },
        select: { id: true },
      });

      // Mark this entry ACCEPTED, all sibling proposals back to WAITING.
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: WaitlistStatus.ACCEPTED,
          resultingAppointmentId: appointment.id,
          proposalToken: null,
        },
      });
      await tx.waitlistEntry.updateMany({
        where: {
          clinicId: entry.clinicId,
          status: WaitlistStatus.PROPOSED,
          proposedSlotStart: slotStart,
          proposedSlotEnd: slotEnd,
          id: { not: entry.id },
        },
        data: {
          status: WaitlistStatus.WAITING,
          proposalToken: null,
          proposedAt: null,
          proposedExpiresAt: null,
          proposedSlotStart: null,
          proposedSlotEnd: null,
        },
      });

      return appointment.id;
    });

    await audit({
      clinicId: entry.clinicId,
      action: "waitlist.accept",
      entity: "WaitlistEntry",
      entityId: entry.id,
      payload: { appointmentId, slot: slotStart.toISOString() },
    });

    revalidatePath("/waitlist");
    revalidatePath("/appointments");
    return ok({ appointmentId });
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === "CONFLICT") {
      return fail("ALREADY_TAKEN", "Another patient just took this slot");
    }
    throw err;
  }
}

/** Patient declines a proposal — entry goes back to WAITING for next time. */
export async function declineWaitlistProposal(token: string): Promise<Result<null>> {
  const entry = await db.waitlistEntry.findUnique({
    where: { proposalToken: token },
    select: { id: true, status: true, clinicId: true },
  });
  if (!entry) return fail("INVALID_TOKEN", "Proposal not found");
  if (entry.status !== WaitlistStatus.PROPOSED) return ok(null); // idempotent

  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: WaitlistStatus.WAITING,
      proposalToken: null,
      proposedAt: null,
      proposedExpiresAt: null,
      proposedSlotStart: null,
      proposedSlotEnd: null,
    },
  });
  await audit({
    clinicId: entry.clinicId,
    action: "waitlist.decline",
    entity: "WaitlistEntry",
    entityId: entry.id,
  });
  return ok(null);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** djb2-like hash → int32 (Postgres `pg_advisory_xact_lock` takes a bigint/int). */
async function advisoryLockKey(input: string): Promise<number> {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h * 33) ^ input.charCodeAt(i)) | 0;
  }
  // pg expects a number; we feed |0 to ensure int32.
  return h;
}

async function firstAdminId(tx: Prisma.TransactionClient, clinicId: string): Promise<string> {
  const admin = await tx.user.findFirst({
    where: { clinicId, role: UserRole.ADMIN, isActive: true },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user to attribute the appointment to");
  return admin.id;
}
