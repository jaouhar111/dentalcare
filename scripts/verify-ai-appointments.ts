/**
 * Quick verification: lists the most recent appointments created by the
 * AI booking flow so we can eyeball `source` + `createdBy` after a
 * webhook test.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const a = await db.appointment.findMany({
    where: { source: "AI_WHATSAPP" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      createdBy: { select: { fullName: true } },
    },
  });
  if (a.length === 0) {
    console.log("(no AI_WHATSAPP appointments yet)");
    return;
  }
  console.log(`Most recent AI bookings (${a.length}):`);
  for (const r of a) {
    console.log(
      `  📅 ${r.startAt.toISOString()}  ${r.patient.firstName} ${r.patient.lastName}  | source=${r.source} | by=${r.createdBy.fullName}`,
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
