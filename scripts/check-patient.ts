import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const id = "cmp5t5q9p00011cvjvje5hfw7";
  const patient = await db.patient.findUnique({ where: { id } });
  const count = await db.patient.count();
  console.log(
    "Patient by id:",
    patient
      ? `${patient.firstName} ${patient.lastName} clinic=${patient.clinicId} deletedAt=${patient.deletedAt}`
      : "NOT FOUND",
  );
  console.log("Total patients in DB:", count);
  const users = await db.user.findMany({ select: { email: true, clinicId: true, role: true } });
  console.log("Users:");
  for (const u of users) console.log(`  ${u.email} role=${u.role} clinic=${u.clinicId}`);
  const clinics = await db.clinic.findMany({ select: { id: true, name: true } });
  console.log("Clinics:");
  for (const c of clinics) console.log(`  ${c.id} (${c.name})`);
}
main().catch(console.error).finally(() => db.$disconnect());
