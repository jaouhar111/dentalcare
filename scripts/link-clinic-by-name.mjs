/**
 * Dev helper — links a specific clinic by name to an OpenWA session id.
 * Usage: node scripts/link-clinic-by-name.mjs <clinic-name> <session-id>
 */
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const [name, sessionId] = process.argv.slice(2);
if (!name || !sessionId) {
  console.error("Usage: node scripts/link-clinic-by-name.mjs <clinic-name> <session-id>");
  process.exit(1);
}
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const clinic = await db.clinic.findFirst({ where: { name } });
if (!clinic) {
  console.error(`No clinic named "${name}"`);
  process.exit(1);
}
await db.clinic.update({
  where: { id: clinic.id },
  data: { openwaSessionId: sessionId },
});
console.log(`✅ Linked "${clinic.name}" → ${sessionId}`);
await db.$disconnect();
