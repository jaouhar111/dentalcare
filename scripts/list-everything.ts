/**
 * Whole-platform overview: every Clinic and every User, so we can spot
 * orphan rows left behind by failed signup attempts.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const clinics = await db.clinic.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true, patients: true } } },
  });
  console.log(`Clinics (${clinics.length}):\n`);
  for (const c of clinics) {
    console.log(
      `  ${c.id}  ${c.name.padEnd(28)} slug=${(c.slug ?? "—").padEnd(24)} ` +
        `status=${c.subscriptionStatus.padEnd(9)} users=${c._count.users} patients=${c._count.patients}`,
    );
  }

  console.log(`\nUsers:\n`);
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      clinic: { select: { name: true, slug: true } },
    },
  });
  for (const u of users) {
    console.log(
      `  ${u.email.padEnd(38)} ${u.role.padEnd(13)} active=${String(u.isActive).padEnd(5)} → ${u.clinic.name}`,
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
