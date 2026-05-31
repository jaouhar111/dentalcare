import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const clinics = await db.clinic.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("Clinics:");
  for (const r of clinics) {
    console.log(`  ${r.createdAt.toISOString()}  ${r.name.padEnd(28)} · ${r.slug ?? "(no slug)"}`);
  }
  const users = await db.user.findMany({
    select: { email: true, fullName: true, createdAt: true, clinicId: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("\nUsers:");
  for (const r of users) {
    console.log(`  ${r.createdAt.toISOString()}  ${r.email.padEnd(30)} · ${r.fullName}`);
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
