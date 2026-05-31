/**
 * Lists every User row whose email contains "mehdi" or "jaouhar" or
 * matches the platform-owner address — used to spot duplicate accounts
 * created by failed signup attempts.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: "jaouhar", mode: "insensitive" } },
        { email: { contains: "mehdi", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      clinic: { select: { name: true, slug: true } },
    },
  });
  console.log(`${users.length} user(s):\n`);
  for (const u of users) {
    console.log(
      `  ${u.createdAt.toISOString()}  ${u.email.padEnd(36)} ` +
        `${u.role.padEnd(13)} active=${u.isActive}  → ${u.clinic.name} (${u.clinic.slug ?? "no-slug"})`,
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
