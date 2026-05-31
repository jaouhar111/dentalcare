/**
 * Promotes a user account to SUPER_ADMIN — the platform-owner role
 * with cross-tenant visibility. Usage:
 *
 *   pnpm tsx scripts/promote-super-admin.ts admin@dentalcare-fes.ma
 *
 * Idempotent — re-running on an already-SUPER_ADMIN account is a no-op.
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm tsx scripts/promote-super-admin.ts <email>");
    process.exit(1);
  }
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, role: true, fullName: true },
  });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  if (user.role === UserRole.SUPER_ADMIN) {
    console.log(`Already SUPER_ADMIN: ${user.fullName} (${user.email})`);
    return;
  }
  await db.user.update({
    where: { id: user.id },
    data: { role: UserRole.SUPER_ADMIN },
  });
  console.log(`Promoted ${user.fullName} (${user.email}) → SUPER_ADMIN`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
