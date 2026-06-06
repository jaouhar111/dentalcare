/**
 * Dev helper — shows every clinic and whether it's wired to OpenWA.
 */
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const clinics = await db.clinic.findMany({
  select: {
    id: true,
    name: true,
    slug: true,
    openwaSessionId: true,
    aiEnabled: true,
  },
  orderBy: { createdAt: "asc" },
});

console.log(`${clinics.length} clinic(s):\n`);
for (const c of clinics) {
  const wa = c.openwaSessionId ? `✅ ${c.openwaSessionId}` : "❌ null";
  console.log(`  • ${c.name.padEnd(28)} slug=${(c.slug ?? "—").padEnd(10)} ${wa}`);
}
await db.$disconnect();
