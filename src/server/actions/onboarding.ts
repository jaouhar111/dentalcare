"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";

/**
 * Onboarding wizard server actions (Phase 10).
 *
 * Each step writes a focused slice of state so the user can drop out
 * and resume without losing work. The final step flips
 * `Clinic.onboardingCompletedAt` which the layout uses to allow
 * navigation elsewhere.
 */

export interface OnboardingProgress {
  hasWhatsApp: boolean;
  hasSchedule: boolean;
  hasDentist: boolean;
  patientsCount: number;
  aiEnabled: boolean;
  completedAt: Date | null;
}

/**
 * Reads the cabinet's onboarding progress — which of the 5 steps are
 * already done. Used by the wizard page to skip ahead automatically.
 */
export async function getOnboardingProgress(): Promise<
  Result<OnboardingProgress>
> {
  const me = await requireRole([UserRole.ADMIN]);
  const c = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: {
      whatsappPhoneId: true,
      aiEnabled: true,
      onboardingCompletedAt: true,
      _count: { select: { patients: true, dentists: true } },
    },
  });
  if (!c) return fail("NOT_FOUND", "Cabinet introuvable");

  // Has at least one dentist with a working schedule = "schedule set".
  const hasSchedule =
    c._count.dentists > 0 &&
    (await db.workingSchedule.count({
      where: { dentist: { clinicId: me.clinicId } },
    })) > 0;

  return ok({
    hasWhatsApp: c.whatsappPhoneId !== null,
    hasSchedule,
    hasDentist: c._count.dentists > 0,
    patientsCount: c._count.patients,
    aiEnabled: c.aiEnabled,
    completedAt: c.onboardingCompletedAt,
  });
}

/**
 * Step 1 — Connect WhatsApp. Saves the 15-digit Meta Phone Number ID.
 * Accepts an empty string = "skip for now" → field stays null and the
 * webhook keeps using the platform fallback.
 */
const whatsappSchema = z.object({
  phoneId: z
    .string()
    .trim()
    .regex(/^[0-9]{10,20}$/u, "Phone ID Meta = 15 chiffres environ")
    .or(z.literal("")),
});

export async function onboardingStepWhatsApp(
  raw: z.input<typeof whatsappSchema>,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const parsed = whatsappSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "ID Meta invalide");
  }
  const phoneId = parsed.data.phoneId.trim();
  await db.clinic.update({
    where: { id: me.clinicId },
    data: { whatsappPhoneId: phoneId || null },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.step1_whatsapp",
    entity: "Clinic",
    entityId: me.clinicId,
    payload: { connected: phoneId !== "" },
  });
  revalidatePath("/onboarding");
  return ok({ id: me.clinicId });
}

/**
 * Step 2 — Working hours. Writes a `WorkingSchedule` row per checked
 * day for EVERY dentist of the clinic. If no dentist exists yet (the
 * user is doing step 2 before step 3), we defer the write until step
 * 3 by storing the hours in `settingsJson._defaultHours`.
 */
const scheduleSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/u),
        endTime: z.string().regex(/^\d{2}:\d{2}$/u),
      }),
    )
    .max(7),
});

export async function onboardingStepHours(
  raw: z.input<typeof scheduleSchema>,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Horaires invalides");
  }
  const days = parsed.data.days;

  await db.$transaction(async (tx) => {
    const dentists = await tx.dentist.findMany({
      where: { clinicId: me.clinicId, isActive: true },
      select: { id: true },
    });
    if (dentists.length === 0) {
      // No dentist yet — stash hours so step 3 can apply them on dentist creation.
      const clinic = await tx.clinic.findUnique({
        where: { id: me.clinicId },
        select: { settingsJson: true },
      });
      const settings =
        (clinic?.settingsJson as Record<string, unknown> | null) ?? {};
      await tx.clinic.update({
        where: { id: me.clinicId },
        data: { settingsJson: { ...settings, _defaultHours: days } },
      });
      return;
    }
    // Otherwise write schedules — wipe + recreate per dentist for simplicity.
    for (const d of dentists) {
      await tx.workingSchedule.deleteMany({ where: { dentistId: d.id } });
      await tx.workingSchedule.createMany({
        data: days.map((h) => ({
          dentistId: d.id,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
        })),
      });
    }
  });

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.step2_hours",
    entity: "Clinic",
    entityId: me.clinicId,
    payload: { daysCount: days.length },
  });
  revalidatePath("/onboarding");
  return ok({ id: me.clinicId });
}

/**
 * Step 3 — Add at least one dentist. The onboarding form posts the
 * minimum viable dentist (firstName / lastName) — the cabinet can
 * enrich later via /dentists.
 */
const dentistSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  specialty: z.string().trim().max(80).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export async function onboardingStepDentist(
  raw: z.input<typeof dentistSchema>,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const parsed = dentistSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Données dentiste invalides");
  }
  const d = parsed.data;
  const dentist = await db.dentist.create({
    data: {
      clinicId: me.clinicId,
      firstName: d.firstName,
      lastName: d.lastName,
      specialty: d.specialty ?? null,
      color: d.color ?? "#06b6d4",
      isActive: true,
    },
    select: { id: true },
  });

  // Apply deferred hours from step 2 if any.
  const clinic = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: { settingsJson: true },
  });
  const settings =
    (clinic?.settingsJson as Record<string, unknown> | null) ?? {};
  const defaultHours = settings._defaultHours as
    | Array<{ dayOfWeek: number; startTime: string; endTime: string }>
    | undefined;
  if (defaultHours && defaultHours.length > 0) {
    await db.workingSchedule.createMany({
      data: defaultHours.map((h) => ({
        dentistId: dentist.id,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
      })),
    });
  }

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.step3_dentist",
    entity: "Dentist",
    entityId: dentist.id,
    payload: { firstName: d.firstName, lastName: d.lastName },
  });
  revalidatePath("/onboarding");
  return ok({ id: dentist.id });
}

/**
 * Step 4 — Patients. For Phase 10 v1 we just acknowledge "skip" or
 * "start empty"; full CSV import is Phase 6/11. This action is a
 * no-op that records the user's choice so the wizard can advance.
 */
export async function onboardingStepPatients(args: {
  skipImport: boolean;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.step4_patients",
    entity: "Clinic",
    entityId: me.clinicId,
    payload: { skipImport: args.skipImport },
  });
  revalidatePath("/onboarding");
  return ok({ id: me.clinicId });
}

/**
 * Step 5 — Activate AI Receptionist. Final step: flips the AI flag
 * (already true by default but the cabinet may have toggled it) and
 * stamps `onboardingCompletedAt` so the layout unblocks the rest of
 * the app.
 */
const finishSchema = z.object({
  aiEnabled: z.boolean(),
});

export async function onboardingFinish(
  raw: z.input<typeof finishSchema>,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const parsed = finishSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Choix invalide");
  }
  await db.clinic.update({
    where: { id: me.clinicId },
    data: {
      aiEnabled: parsed.data.aiEnabled,
      onboardingCompletedAt: new Date(),
    },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.completed",
    entity: "Clinic",
    entityId: me.clinicId,
    payload: { aiEnabled: parsed.data.aiEnabled },
  });
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return ok({ id: me.clinicId });
}

/**
 * Allow the user to skip onboarding entirely — flips `completedAt`
 * without going through the wizard. Used by the "skip for now" link.
 */
export async function onboardingSkipAll(): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  await db.clinic.update({
    where: { id: me.clinicId },
    data: { onboardingCompletedAt: new Date() },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "onboarding.skipped",
    entity: "Clinic",
    entityId: me.clinicId,
    payload: {},
  });
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return ok({ id: me.clinicId });
}
