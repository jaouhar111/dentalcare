import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

const MOROCCO_TZ_OFFSET = "+01:00";
const MAX_SLOTS = 5;
/// We don't propose anything more than ~36h out — beyond that it's not
/// really an emergency, and the regular `search_available_slots` flow
/// is more appropriate.
const HORIZON_HOURS = 36;
/// Minimum gap from "now" so the slot is reachable (15 min = patient
/// has time to read + come).
const MIN_LEAD_MIN = 15;

/**
 * `find_emergency_slot` — surfaces the SOONEST bookable slots across
 * every active dentist of the cabinet within the next ~36 hours. The
 * model invokes this when triage detects keywords like "douleur",
 * "saigne", "casse", "fièvre", "abcès", "ne peux pas dormir".
 *
 * Returns up to 5 slots sorted by earliest first. Each slot carries
 * `dentistName` so the patient can pick "n'importe lequel" — the goal
 * is "fastest care" not "specific practitioner".
 *
 * The booking itself still goes through `create_appointment` — the
 * model must prefix `reason` with "URGENCE — <symptôme>" so cabinets
 * can spot urgent RDV in the calendar (red flag via `source` enum is
 * a future addition).
 */
export function findEmergencySlotTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "find_emergency_slot",
    description:
      "À utiliser UNIQUEMENT en cas d'urgence (douleur intense, saignement, traumatisme, " +
      "abcès, fièvre, gonflement, dent cassée, ne peut plus manger, douleur empêchant de dormir). " +
      "Cherche les 5 créneaux les plus proches dans les prochaines 36h, TOUS dentistes confondus. " +
      "À appeler à la place de `search_available_slots` pour gagner du temps.",
    parameters: z.object({
      durationMin: z
        .number()
        .int()
        .min(15)
        .max(60)
        .default(30)
        .describe("Durée typique d'une consultation d'urgence. Défaut 30 min."),
    }),
    handler: async (args) => {
      const now = new Date();
      const earliest = new Date(now.getTime() + MIN_LEAD_MIN * 60_000);
      const horizon = new Date(now.getTime() + HORIZON_HOURS * 60 * 60_000);

      const dentists = await db.dentist.findMany({
        where: { clinicId: ctx.clinicId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          schedules: { select: { dayOfWeek: true, startTime: true, endTime: true } },
          absences: {
            where: { startAt: { lt: horizon }, endAt: { gt: now } },
            select: { startAt: true, endAt: true },
          },
        },
      });
      if (dentists.length === 0) {
        return {
          slots: [],
          note: "Aucun dentiste actif au cabinet. Oriente le patient vers les urgences hospitalières.",
        };
      }

      const blocking = await db.appointment.findMany({
        where: {
          clinicId: ctx.clinicId,
          dentistId: { in: dentists.map((d) => d.id) },
          startAt: { lt: horizon },
          endAt: { gt: now },
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
              AppointmentStatus.RESCHEDULE_REQUESTED,
            ],
          },
        },
        select: { dentistId: true, startAt: true, endAt: true },
      });

      type Slot = {
        startAt: string;
        endAt: string;
        localTime: string;
        localDate: string;
        dentistName: string;
        dentistId: string;
      };
      const collected: Slot[] = [];
      // Walk day by day, hour by hour from `earliest` to `horizon` and
      // collect every free slot. We then sort the whole set and clip to
      // MAX_SLOTS so the model truly sees the earliest options first
      // even if dentist A has a hole at 17h but dentist B has one at 14h.
      let cursor = new Date(earliest);
      cursor.setSeconds(0, 0);

      while (cursor < horizon) {
        const dayStr = isoDateAt(cursor);
        const dow = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()),
        ).getUTCDay();
        for (const d of dentists) {
          const sched = d.schedules.filter((s) => s.dayOfWeek === dow);
          if (sched.length === 0) continue;
          const apptsForDentist = blocking.filter((b) => b.dentistId === d.id);
          for (const window of sched) {
            for (const slot of enumerateWindow(dayStr, window.startTime, window.endTime, args.durationMin)) {
              if (slot.start < cursor) continue;
              if (slot.end > horizon) break;
              const conflict =
                apptsForDentist.some((a) => slot.start < a.endAt && slot.end > a.startAt) ||
                d.absences.some((a) => slot.start < a.endAt && slot.end > a.startAt);
              if (conflict) continue;
              collected.push({
                startAt: slot.start.toISOString(),
                endAt: slot.end.toISOString(),
                localTime: slot.localTime,
                localDate: slot.localDate,
                dentistName: `Dr ${d.firstName} ${d.lastName}`,
                dentistId: d.id,
              });
            }
          }
        }
        // Advance cursor to the next day's 00:00 Casablanca and rescan;
        // we don't care about scanning the same day twice because we
        // dedupe by exact ISO.
        cursor = new Date(`${nextDay(dayStr)}T00:00:00${MOROCCO_TZ_OFFSET}`);
      }

      // Dedupe + sort earliest first + clip
      const unique = Array.from(new Map(collected.map((s) => [s.startAt + s.dentistId, s])).values());
      unique.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));
      const top = unique.slice(0, MAX_SLOTS);

      return {
        slots: top,
        note:
          top.length === 0
            ? "AUCUN créneau libre dans les 36h. Oriente vers les urgences hospitalières (CHU Hassan II Fès si disponible)."
            : "Affiche au patient les 3 créneaux les plus proches avec localDate + localTime. Réserve avec `create_appointment` en mettant `reason` = 'URGENCE — <symptôme du patient>'.",
      };
    },
  });
}

function isoDateAt(d: Date): string {
  // Get the Casablanca-local date (UTC+1) as YYYY-MM-DD.
  const local = new Date(d.getTime() + 60 * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function nextDay(dayStr: string): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const next = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function* enumerateWindow(
  day: string,
  startTime: string,
  endTime: string,
  durationMin: number,
): Generator<{ start: Date; end: Date; localTime: string; localDate: string }> {
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);
  let curH = sH ?? 0;
  let curM = sM ?? 0;
  const windowEnd = new Date(
    `${day}T${pad(eH ?? 0)}:${pad(eM ?? 0)}:00${MOROCCO_TZ_OFFSET}`,
  );
  while (true) {
    const start = new Date(`${day}T${pad(curH)}:${pad(curM)}:00${MOROCCO_TZ_OFFSET}`);
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (end > windowEnd) return;
    yield {
      start,
      end,
      localTime: `${pad(curH)}:${pad(curM)}`,
      localDate: day,
    };
    const total = curH * 60 + curM + durationMin;
    curH = Math.floor(total / 60);
    curM = total % 60;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
