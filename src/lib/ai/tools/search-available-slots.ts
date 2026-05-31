import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * Morocco has been on UTC+01:00 year-round (no DST) since 26 Oct 2018,
 * so a hardcoded offset is safe — and a lot lighter than pulling in a
 * timezone library. If a future client adds clinics outside Morocco
 * we'll move this to the clinic's `settingsJson.timezone`.
 */
const MOROCCO_TZ_OFFSET = "+01:00";

/// How many slots we ship to the model at most. 5 was too tight (we
/// missed visibly-available slots), 10 fits well inside a WhatsApp reply
/// and gives the patient choice across morning + afternoon.
const MAX_SLOTS = 10;

/**
 * `search_available_slots` — given an optional dentist name + a day,
 * find up to MAX_SLOTS free slots that respect working hours, absences
 * and existing bookings, in Casablanca local time.
 *
 * The output carries both `startAt` (UTC ISO, consumed by
 * `create_appointment`) and `localTime` ("HH:mm" Casablanca, displayed
 * to the patient). Without the local string, the model would try to
 * derive it from the UTC ISO and routinely got it wrong by one hour.
 */
export function searchAvailableSlotsTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "search_available_slots",
    description:
      "Trouve les créneaux disponibles pour un dentiste donné un jour donné. " +
      "Le créneau est libre si : (1) il tombe dans les horaires de travail, " +
      "(2) il ne chevauche pas une absence, (3) il ne chevauche pas un autre RDV. " +
      `Retourne au max ${MAX_SLOTS} créneaux. Affiche au patient le champ \`localTime\` (HH:mm) ` +
      "et passe `startAt` (ISO) intact à `create_appointment`.",
    parameters: z.object({
      day: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu")
        .describe("Jour de recherche au format ISO YYYY-MM-DD."),
      dentistName: z
        .string()
        .optional()
        .describe(
          "Nom (prénom ou nom de famille) du dentiste demandé. Si vide, cherche chez tous les dentistes actifs.",
        ),
      durationMin: z
        .number()
        .int()
        .min(15)
        .max(180)
        .default(30)
        .describe("Durée du créneau en minutes. Défaut 30."),
    }),
    handler: async (args) => {
      const dayStart = new Date(`${args.day}T00:00:00${MOROCCO_TZ_OFFSET}`);
      const dayEnd = new Date(`${args.day}T23:59:59${MOROCCO_TZ_OFFSET}`);
      // Day-of-week from the date string itself (Y/M/D as Casablanca
      // calendar values). Anchoring at 00:00 Casablanca and asking for
      // getUTCDay would return the prior day (Sunday for "2026-06-01")
      // because UTC is 1h behind — and the schedule lookup would miss.
      const [yy, mm, dd] = args.day.split("-").map(Number);
      const dow = new Date(Date.UTC(yy!, (mm ?? 1) - 1, dd ?? 1)).getUTCDay();

      const nameTokens = (args.dentistName ?? "")
        .replace(/\b(dr|docteur|doctor|mr|m\.|monsieur|mme|madame)\b\.?/gi, "")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
      const dentists = await db.dentist.findMany({
        where: {
          clinicId: ctx.clinicId,
          isActive: true,
          ...(nameTokens.length > 0
            ? {
                OR: nameTokens.flatMap((token) => [
                  { firstName: { contains: token, mode: "insensitive" as const } },
                  { lastName: { contains: token, mode: "insensitive" as const } },
                ]),
              }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          schedules: {
            where: { dayOfWeek: dow },
            select: { startTime: true, endTime: true },
          },
          absences: {
            where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
            select: { startAt: true, endAt: true },
          },
        },
      });

      if (dentists.length === 0) {
        return { slots: [], note: "Aucun dentiste correspondant trouvé." };
      }

      const blocking = await db.appointment.findMany({
        where: {
          clinicId: ctx.clinicId,
          dentistId: { in: dentists.map((d) => d.id) },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
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

      const now = new Date();
      const slots: Array<{
        startAt: string;
        endAt: string;
        localTime: string;
        dentistName: string;
        dentistId: string;
      }> = [];

      for (const d of dentists) {
        if (d.schedules.length === 0) continue;
        const dentistAppts = blocking.filter((a) => a.dentistId === d.id);
        for (const sched of d.schedules) {
          for (const slot of enumerateSlots(args.day, sched.startTime, sched.endTime, args.durationMin)) {
            const conflict =
              dentistAppts.some((a) => slot.start < a.endAt && slot.end > a.startAt) ||
              d.absences.some((a) => slot.start < a.endAt && slot.end > a.startAt) ||
              slot.start < now;
            if (conflict) continue;
            slots.push({
              startAt: slot.start.toISOString(),
              endAt: slot.end.toISOString(),
              localTime: slot.localTime,
              dentistName: `Dr ${d.firstName} ${d.lastName}`,
              dentistId: d.id,
            });
            if (slots.length >= MAX_SLOTS) break;
          }
          if (slots.length >= MAX_SLOTS) break;
        }
        if (slots.length >= MAX_SLOTS) break;
      }

      return { slots };
    },
  });
}

/**
 * Yields each candidate slot for a working-hours window. Each slot's
 * `start`/`end` are real Date objects anchored to Casablanca local time
 * via an explicit offset, so subsequent comparisons against DB rows
 * (stored in UTC) are correct regardless of where the server runs.
 *
 * `localTime` is the "HH:mm" string we want the patient to see — built
 * from the same hour/minute we just consumed, no roundtrip through
 * Date.toLocaleString().
 */
function* enumerateSlots(
  day: string,
  startTime: string,
  endTime: string,
  durationMin: number,
): Generator<{ start: Date; end: Date; localTime: string }> {
  const [startH, startM] = parseHM(startTime);
  const [endH, endM] = parseHM(endTime);

  // The dentist's schedule rows store start/end as "HH:mm" strings — we
  // pin them to the requested day in Casablanca and step every
  // `durationMin` minutes. The end of the window is exclusive.
  let curH = startH;
  let curM = startM;
  while (true) {
    const startIso = `${day}T${pad(curH)}:${pad(curM)}:00${MOROCCO_TZ_OFFSET}`;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + durationMin * 60_000);
    // End must fit fully within the working window.
    const windowEnd = new Date(`${day}T${pad(endH)}:${pad(endM)}:00${MOROCCO_TZ_OFFSET}`);
    if (end > windowEnd) return;
    yield { start, end, localTime: `${pad(curH)}:${pad(curM)}` };
    // advance cursor by durationMin
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
