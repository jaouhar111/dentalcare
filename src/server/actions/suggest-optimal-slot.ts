"use server";

import { AppointmentStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";

/**
 * Phase 11 — Stage D
 *
 * `suggestOptimalSlot` — for the cabinet's NEW-APPOINTMENT form.
 *
 * Goal : minimise dead time between appointments. A 30-min slot at
 * 14:00 wedged between an existing 13:00-13:30 and a 15:00-15:30 RDV
 * is better than 11:00 (which leaves a 14:30-15:00 hole).
 *
 * Algorithm :
 *   1. Enumerate every legal slot for `dentistId` × day-range.
 *   2. For each, compute `gapScore` :
 *        - 0 if the slot is RIGHT AFTER an existing RDV (zero gap)
 *        - 0 if RIGHT BEFORE an existing RDV
 *        - +N minutes per side gap, otherwise
 *      Lower = better packing.
 *   3. Tie-break with `chronological proximity` (closer to now wins).
 *   4. Return top 5.
 *
 * Read-only — never mutates appointments. The cabinet still picks
 * manually; this just sorts the dropdown.
 */

const ANY_STAFF = [
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.RECEPTIONIST,
] as const;

const MOROCCO_TZ_OFFSET = "+01:00";
const MAX_SUGGESTIONS = 5;
const SEARCH_WINDOW_DAYS = 7;

export interface OptimalSlotSuggestion {
  startAt: string; // ISO
  endAt: string;
  localDate: string; // YYYY-MM-DD
  localTime: string; // HH:mm
  /// 0 = touches an existing RDV on at least one side (perfect packing).
  /// 60+ = significant gap. UI sorts by this ascending.
  gapScore: number;
  /// Human label : "juste après le RDV de 13:30" or "matinée libre" …
  hint: string;
}

export async function suggestOptimalSlots(args: {
  dentistId: string;
  durationMin: number;
  /// Start of the search window (ISO YYYY-MM-DD). Defaults to tomorrow.
  fromDate?: string;
}): Promise<Result<OptimalSlotSuggestion[]>> {
  const me = await requireRole([...ANY_STAFF]);

  if (args.durationMin < 15 || args.durationMin > 180) {
    return fail("INVALID_INPUT", "Durée RDV invalide (15-180 min)");
  }

  // Window — anchored at Casablanca local time so we don't drift across
  // midnight on the server's UTC clock.
  const fromDay = args.fromDate
    ? new Date(`${args.fromDate}T00:00:00${MOROCCO_TZ_OFFSET}`)
    : new Date();
  fromDay.setHours(0, 0, 0, 0);
  // If no fromDate, start tomorrow so we never suggest a slot for today
  // by accident (cabinet is calling this from a manual form).
  if (!args.fromDate) fromDay.setDate(fromDay.getDate() + 1);
  const toDay = new Date(fromDay);
  toDay.setDate(toDay.getDate() + SEARCH_WINDOW_DAYS);

  const dentist = await db.dentist.findFirst({
    where: { id: args.dentistId, clinicId: me.clinicId, isActive: true },
    select: {
      id: true,
      schedules: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
      absences: {
        where: { startAt: { lt: toDay }, endAt: { gt: fromDay } },
        select: { startAt: true, endAt: true },
      },
    },
  });
  if (!dentist) return fail("NOT_FOUND", "Dentiste introuvable");

  const existing = await db.appointment.findMany({
    where: {
      clinicId: me.clinicId,
      dentistId: dentist.id,
      startAt: { lt: toDay },
      endAt: { gt: fromDay },
      status: {
        in: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ],
      },
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true },
  });

  const candidates: OptimalSlotSuggestion[] = [];

  for (let d = 0; d < SEARCH_WINDOW_DAYS; d++) {
    const day = new Date(fromDay);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    const sched = dentist.schedules.find((s) => s.dayOfWeek === dow);
    if (!sched) continue;

    const dayStr = day.toISOString().slice(0, 10);

    for (const slot of enumerateSlots(
      dayStr,
      sched.startTime,
      sched.endTime,
      args.durationMin,
    )) {
      // Conflict checks — same as search-available-slots.
      const conflict =
        existing.some((a) => slot.start < a.endAt && slot.end > a.startAt) ||
        dentist.absences.some(
          (a) => slot.start < a.endAt && slot.end > a.startAt,
        );
      if (conflict) continue;

      // Find the neighbour RDVs on the same day to compute gaps.
      const sameDayAppts = existing.filter((a) => {
        return a.startAt.toISOString().slice(0, 10) === dayStr;
      });
      const before = [...sameDayAppts]
        .filter((a) => a.endAt <= slot.start)
        .sort((a, b) => b.endAt.getTime() - a.endAt.getTime())[0];
      const after = [...sameDayAppts]
        .filter((a) => a.startAt >= slot.end)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];

      const gapBeforeMin = before
        ? Math.round(
            (slot.start.getTime() - before.endAt.getTime()) / 60_000,
          )
        : null;
      const gapAfterMin = after
        ? Math.round((after.startAt.getTime() - slot.end.getTime()) / 60_000)
        : null;

      // Score : 0 = touches one of the neighbour exactly. Higher = bigger
      // dead time around. We only count "small gaps that are still wasted"
      // — gaps > 90 min are essentially separate sessions and don't hurt.
      let gapScore = 0;
      if (gapBeforeMin !== null && gapBeforeMin > 0 && gapBeforeMin < 90) {
        gapScore += gapBeforeMin;
      }
      if (gapAfterMin !== null && gapAfterMin > 0 && gapAfterMin < 90) {
        gapScore += gapAfterMin;
      }
      // Day-empty case (no neighbour at all) gets a moderate penalty —
      // we'd rather pack existing busy days first.
      if (before === undefined && after === undefined) gapScore += 60;

      // Friendly hint for the cabinet's UI.
      let hint = "créneau libre";
      if (gapBeforeMin === 0) hint = `juste après ${formatHM(before!.endAt)}`;
      else if (gapAfterMin === 0)
        hint = `juste avant ${formatHM(after!.startAt)}`;
      else if (
        gapBeforeMin !== null &&
        gapAfterMin !== null &&
        gapBeforeMin + gapAfterMin < 30
      ) {
        hint = "comble un trou";
      } else if (!before && !after) {
        hint = "journée vide";
      }

      candidates.push({
        startAt: slot.start.toISOString(),
        endAt: slot.end.toISOString(),
        localDate: dayStr,
        localTime: slot.localTime,
        gapScore,
        hint,
      });
    }
  }

  // Sort by score (ascending = better packing), then by date (sooner first).
  candidates.sort((a, b) => {
    if (a.gapScore !== b.gapScore) return a.gapScore - b.gapScore;
    return a.startAt.localeCompare(b.startAt);
  });

  return ok(candidates.slice(0, MAX_SUGGESTIONS));
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

function formatHM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
