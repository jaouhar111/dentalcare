/**
 * Dev helper — lists ADMIN users for the Sitel clinic so the owner can
 * sign in to test the UI. Read-only.
 */
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const sitel = await db.clinic.findFirst({
  where: { name: "Sitel" },
  select: { id: true, name: true, slug: true },
});
if (!sitel) {
  console.log("No Sitel clinic.");
  process.exit(0);
}
console.log(`Clinic: ${sitel.name} (${sitel.id}, slug=${sitel.slug ?? "—"})`);

const admins = await db.user.findMany({
  where: { clinicId: sitel.id, role: "ADMIN" },
  select: {
    id: true,
    email: true,
    fullName: true,
    createdAt: true,
  },
  orderBy: { createdAt: "asc" },
});
console.log(`\n${admins.length} ADMIN user(s):`);
for (const u of admins) {
  console.log(`  • ${u.email}  (${u.fullName ?? "—"}, created ${u.createdAt.toISOString().slice(0, 10)})`);
}

await db.$disconnect();
