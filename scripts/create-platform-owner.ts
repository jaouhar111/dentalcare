/**
 * Provisions the platform-owner SUPER_ADMIN account, idempotent.
 *
 *   pnpm tsx scripts/create-platform-owner.ts <email> <fullName> <password>
 *
 * Steps:
 *   1. Demote every existing SUPER_ADMIN (except the target email) to
 *      ADMIN — there should only be one platform owner.
 *   2. Ensure a "Platform" pseudo-clinic exists (slug "platform", just
 *      a holder so the owner's `clinicId` foreign key resolves).
 *   3. Create or update the user row, set role = SUPER_ADMIN.
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const fullName = process.argv[3];
  const password = process.argv[4];
  if (!email || !fullName || !password) {
    console.error(
      "Usage: pnpm tsx scripts/create-platform-owner.ts <email> <fullName> <password>",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  // Step 1: demote any existing SUPER_ADMIN other than the target so
  // we end up with exactly one platform owner.
  const demoted = await db.user.updateMany({
    where: {
      role: UserRole.SUPER_ADMIN,
      email: { not: email },
    },
    data: { role: UserRole.ADMIN },
  });
  if (demoted.count > 0) {
    console.log(`Demoted ${demoted.count} existing SUPER_ADMIN(s) → ADMIN`);
  }

  // Step 2: ensure platform clinic exists.
  let platform = await db.clinic.findFirst({
    where: { slug: "platform" },
    select: { id: true },
  });
  if (!platform) {
    const created = await db.clinic.create({
      data: {
        name: "DentalCare Platform",
        slug: "platform",
        defaultLocale: "fr",
        invoiceStartingNumber: 1,
        // Auto-active so the trial banner doesn't show on this fake clinic.
        subscriptionStatus: "ACTIVE",
      },
      select: { id: true },
    });
    platform = created;
    console.log(`Created platform clinic (${platform.id})`);
  } else {
    console.log(`Reusing platform clinic (${platform.id})`);
  }

  // Step 3: upsert the user.
  const passwordHash = await hashPassword(password);
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, fullName: true, clinicId: true },
  });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.SUPER_ADMIN,
        passwordHash,
        fullName,
        clinicId: platform.id,
        isActive: true,
      },
    });
    console.log(`Updated existing user ${email} → SUPER_ADMIN (platform clinic)`);
  } else {
    await db.user.create({
      data: {
        clinicId: platform.id,
        email,
        passwordHash,
        fullName,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`Created new SUPER_ADMIN ${email}`);
  }

  console.log("\n✅ Done. You can now sign in with this account.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
