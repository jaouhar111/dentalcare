/**
 * Phase 11 — Stage C
 *
 * `propose_reschedule_slots` — when the patient asks to move their RDV,
 * this tool proactively returns the **3 best alternative slots** based
 * on the original appointment's profile:
 *
 *   - Same dentist (patient relationship matters)
 *   - Same time-of-day bucket (morning if original was morning)
 *   - Within 14 days of the original date
 *   - Sorted by how closely each candidate matches the original pattern
 *
 * The model calls this BEFORE asking the patient « quel créneau ? » —
 * it shortens the conversation from 3-4 turns to 1.
 *
 * Why a dedicated tool instead of letting the model chain
 * `search_available_slots` itself: deterministic scoring lives in code,
 * not in the prompt. The model would otherwise pick slots arbitrarily.
 */

import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

const MOROCCO_TZ_OFFSET = "+01:00";
const MAX_PROPOSALS = 3;
const SEARCH_WINDOW_DAYS = 14;

interface SlotCandidate {
  startAt: Date;
  endAt: Date;
  localDate: string; // "2026-06-04"
  localTime: string; // "14:30"
  dentistId: string;
  dentistName: string;
  /// 0 (perfect match) to 100 (worst). Lower = preferred.
  score: number;
  /// Human-readable "why this slot" — for the model to relay to the patient.
  rationale: string;
}

export function proposeRescheduleSlotsTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "propose_reschedule_slots",
    description:
      "Quand le patient demande à déplacer son RDV, appelle ce tool AVANT " +
      "de demander 'quel créneau ?'. Il retourne 3 propositions intelligentes " +
      "(même dentiste, même horaire de la journée, sous 14 jours), classées " +
      "par pertinence. Affiche les `localDate`+`localTime`+`dentistName` au patient. " +
      "Quand il choisit, exécute `cancel_appointment` sur `appointmentId` PUIS " +
      "`create_appointment` avec le `startAt` du créneau choisi.",
    parameters: z.object({
      appointmentId: z
        .string()
        .describe(
          "ID du RDV à déplacer (issu de `list_my_appointments`).",
        ),
    }),
    handler: async (args) => {
      const original = await db.appointment.findFirst({
        where: {
          id: args.appointmentId,
          clinicId: ctx.clinicId,
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.RESCHEDULE_REQUESTED,
            ],
          },
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          dentistId: true,
          dentist: { select: { firstName: true, lastName: true } },
          reason: true,
        },
      });
      if (!original) {
        return { slots: [], note: "RDV introuvable ou déjà annulé." };
      }

      const durationMin = Math.round(
        (original.endAt.getTime() - original.startAt.getTime()) / 60_000,
      );

      // Original profile — used by the scorer.
      const origHour = original.startAt.getHours();
      const origIsMorning = origHour < 13;
      const origDow = original.startAt.getDay(); // 0=Sun..6=Sat
      const origDate = original.startAt;

      // Search window: tomorrow → tomorrow + 14 days.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const windowEnd = new Date(tomorrow);
      windowEnd.setDate(windowEnd.getDate() + SEARCH_WINDOW_DAYS);

      // Pull every "candidate day" — schedules + absences + booked slots for
      // the same dentist as original. We score in memory afterwards.
      const dentist = await db.dentist.findUnique({
        where: { id: original.dentistId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
          schedules: {
            select: { dayOfWeek: true, startTime: true, endTime: true },
          },
          absences: {
            where: { startAt: { lt: windowEnd }, endAt: { gt: tomorrow } },
            select: { startAt: true, endAt: true },
          },
        },
      });
      if (!dentist || !dentist.isActive) {
        return {
          slots: [],
          note: "Le dentiste initial n'est plus disponible — propose au patient un autre dentiste avec `search_available_slots`.",
        };
      }

      const blockingAppts = await db.appointment.findMany({
        where: {
          clinicId: ctx.clinicId,
          dentistId: original.dentistId,
          startAt: { lt: windowEnd },
          endAt: { gt: tomorrow },
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
            ],
          },
          id: { not: original.id }, // ignore the appointment being rescheduled
        },
        select: { startAt: true, endAt: true },
      });

      const candidates: SlotCandidate[] = [];

      // Walk every day in the window — generate slots, score them.
      for (let d = 0; d < SEARCH_WINDOW_DAYS; d++) {
        const day = new Date(tomorrow);
        day.setDate(day.getDate() + d);
        const dayDow = day.getDay();
        const sched = dentist.schedules.find((s) => s.dayOfWeek === dayDow);
        if (!sched) continue; // closed that day-of-week

        const dayStr = day.toISOString().slice(0, 10); // YYYY-MM-DD UTC

        for (const slot of enumerateSlots(
          dayStr,
          sched.startTime,
          sched.endTime,
          durationMin,
        )) {
          // Conflicts: existing appointments (excluding the one we're
          // rescheduling) + dentist absences + past slots.
          const conflict =
            blockingAppts.some(
              (a) => slot.start < a.endAt && slot.end > a.startAt,
            ) ||
            dentist.absences.some(
              (a) => slot.start < a.endAt && slot.end > a.startAt,
            );
          if (conflict) continue;
          if (slot.start <= new Date()) continue;

          // ── Score ──────────────────────────────────────────────────
          // Lower = better. Three signals:
          //   1. day-of-week match (best=0, worst=20)
          //   2. time-of-day bucket match (best=0, worst=15)
          //   3. proximity to original date (0 = next day, +5/day past 7)
          let score = 0;
          if (dayDow !== origDow) score += 20;
          const slotIsMorning = slot.start.getHours() < 13;
          if (slotIsMorning !== origIsMorning) score += 15;
          const daysFromOriginal = Math.abs(
            Math.round(
              (slot.start.getTime() - origDate.getTime()) / 86_400_000,
            ),
          );
          score += daysFromOriginal * 2;

          // Rationale — for the model to pass to the patient.
          const rationale: string[] = [];
          if (dayDow === origDow) rationale.push("même jour de la semaine");
          if (slotIsMorning === origIsMorning)
            rationale.push(origIsMorning ? "matin" : "après-midi");
          if (daysFromOriginal <= 3) rationale.push("très proche");

          candidates.push({
            startAt: slot.start,
            endAt: slot.end,
            localDate: dayStr,
            localTime: slot.localTime,
            dentistId: dentist.id,
            dentistName: `Dr ${dentist.firstName} ${dentist.lastName}`,
            score,
            rationale: rationale.join(", ") || "créneau disponible",
          });
        }
      }

      if (candidates.length === 0) {
        return {
          slots: [],
          note:
            "Aucun créneau libre dans les 14 prochains jours pour ce dentiste. " +
            "Propose au patient `search_available_slots` sur une date plus lointaine " +
            "ou un autre dentiste.",
        };
      }

      // Sort by score, drop dupes that fall on the same day (we don't
      // want 3 slots on a Wednesday afternoon), take top N.
      candidates.sort((a, b) => a.score - b.score);
      const top: SlotCandidate[] = [];
      const seenDays = new Set<string>();
      for (const c of candidates) {
        if (seenDays.has(c.localDate)) continue;
        seenDays.add(c.localDate);
        top.push(c);
        if (top.length >= MAX_PROPOSALS) break;
      }

      return {
        appointmentId: original.id,
        slots: top.map((s) => ({
          startAt: s.startAt.toISOString(),
          endAt: s.endAt.toISOString(),
          localDate: s.localDate,
          localTime: s.localTime,
          dentistId: s.dentistId,
          dentistName: s.dentistName,
          rationale: s.rationale,
        })),
        instructions:
          "Présente les 3 propositions au patient en mentionnant la `rationale` " +
          "de chacune (ex. « jeudi 5 juin à 14:00 — même jour de la semaine, après-midi »). " +
          "Quand il choisit, exécute D'ABORD `cancel_appointment` avec l'ancien `appointmentId`, " +
          "PUIS `create_appointment` avec le nouveau `startAt`.",
      };
    },
  });
}

function* enumerateSlots(
  day: string,
  startTime: string,
  endTime: string,
  durationMin: number,
): Generator<{ start: Date; end: Date; localTime: string }> {
  const [startH, startM] = parseHM(startTime);
  const [endH, endM] = parseHM(endTime);
  let curH = startH;
  let curM = startM;
  while (true) {
    const startIso = `${day}T${pad(curH)}:${pad(curM)}:00${MOROCCO_TZ_OFFSET}`;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + durationMin * 60_000);
    const windowEnd = new Date(
      `${day}T${pad(endH)}:${pad(endM)}:00${MOROCCO_TZ_OFFSET}`,
    );
    if (end > windowEnd) return;
    yield { start, end, localTime: `${pad(curH)}:${pad(curM)}` };
    const total = curH * 60 + curM + durationMin;
    curH = Math.floor(total / 60);
    curM = total % 60;
  }
}

function parseHM(s: string): [number, number] {
  const [h, m] = s.split(":").map(Number);
  return [h ?? 0, m ?? 0];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
