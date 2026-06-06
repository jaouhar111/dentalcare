/**
 * Dev helper — binds the first clinic in the DB to a given OpenWA
 * session UUID, so outbound `sendText` calls actually route to the
 * gateway instead of falling into the console-log mock.
 *
 * Usage:
 *   node scripts/link-openwa-session.mjs <session-uuid>
 *
 * Throwaway script — do not import from app code.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";
config();

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Usage: node scripts/link-openwa-session.mjs <session-uuid>");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
const clinics = await db.clinic.findMany({
  select: { id: true, name: true, openwaSessionId: true, whatsappPhoneId: true },
});
console.log(`Found ${clinics.length} clinic(s):`);
for (const c of clinics) {
  console.log(`  - ${c.name} (${c.id}) openwa=${c.openwaSessionId ?? "—"}`);
}
if (clinics.length === 0) {
  console.log("Nothing to link — run the seed first.");
  await db.$disconnect();
  process.exit(0);
}
const target = clinics[0];
await db.clinic.update({
  where: { id: target.id },
  data: { openwaSessionId: sessionId },
});
console.log(`✅ Linked "${target.name}" → OpenWA session ${sessionId}`);
await db.$disconnect();
