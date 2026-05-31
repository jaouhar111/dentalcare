import { z } from "zod";
import { db } from "@/lib/db/client";
import { defineTool, type AITool } from "../types";
import type { AIToolContext } from "./context";

/**
 * `get_cabinet_info` — returns the cabinet's basic facts so the model can
 * answer "vous êtes ouvert quand ?" / "quels dentistes travaillent
 * mardi ?" / "comment vous appelez-vous ?" without hallucinating.
 *
 * Stateless; takes no args. The clinic is bound at construction time via
 * the tool context.
 */
export function getCabinetInfoTool(ctx: AIToolContext): AITool {
  return defineTool({
    name: "get_cabinet_info",
    description:
      "Renvoie le nom, l'adresse, le téléphone du cabinet et la liste des dentistes actifs avec leurs horaires hebdomadaires. À appeler en premier dans une conversation si tu ne connais pas le cabinet.",
    parameters: z.object({}),
    handler: async () => {
      const clinic = await db.clinic.findUnique({
        where: { id: ctx.clinicId },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          dentists: {
            where: { isActive: true },
            select: {
              firstName: true,
              lastName: true,
              specialty: true,
              schedules: {
                select: { dayOfWeek: true, startTime: true, endTime: true },
                orderBy: { dayOfWeek: "asc" },
              },
            },
          },
        },
      });
      if (!clinic) {
        return { error: "Cabinet introuvable." };
      }

      const dentistsList = clinic.dentists.map((d) => ({
        name: `Dr ${d.firstName} ${d.lastName}`,
        specialty: d.specialty ?? "Dentiste",
        // Compact "Mon 9-13, 14-18; Wed 9-13" representation — saves tokens
        // vs. a verbose object the model would just compress anyway.
        weeklyHours: summariseSchedule(d.schedules),
      }));

      return {
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        dentists: dentistsList,
      };
    },
  });
}

function summariseSchedule(
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
): string {
  if (schedules.length === 0) return "(horaires non renseignés)";
  // ISO: Sunday=0; we map to short FR labels.
  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const byDay = new Map<number, string[]>();
  for (const s of schedules) {
    const arr = byDay.get(s.dayOfWeek) ?? [];
    arr.push(`${s.startTime}-${s.endTime}`);
    byDay.set(s.dayOfWeek, arr);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([d, ranges]) => `${dayLabels[d]} ${ranges.join(", ")}`)
    .join("; ");
}
