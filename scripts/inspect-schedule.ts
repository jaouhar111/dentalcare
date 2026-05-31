/**
 * Dumps the weekly schedule + a sample slot enumeration so we can see
 * whether the new tz-aware code returns sensible slots for the dentist.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

async function main() {
  const dentists = await db.dentist.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      schedules: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });
  for (const d of dentists) {
    console.log(`\n🦷 Dr ${d.firstName} ${d.lastName} (${d.id})`);
    if (d.schedules.length === 0) {
      console.log("   (no schedule rows)");
      continue;
    }
    const byDay = new Map<number, Array<{ s: string; e: string }>>();
    for (const s of d.schedules) {
      const arr = byDay.get(s.dayOfWeek) ?? [];
      arr.push({ s: s.startTime, e: s.endTime });
      byDay.set(s.dayOfWeek, arr);
    }
    for (let d = 0; d < 7; d++) {
      const ranges = byDay.get(d);
      if (ranges) {
        console.log(`   ${DAYS[d]}: ${ranges.map((r) => `${r.s}-${r.e}`).join(", ")}`);
      } else {
        console.log(`   ${DAYS[d]}: —`);
      }
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
