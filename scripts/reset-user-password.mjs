/**
 * Dev helper — resets a user's password to a known value using the
 * same Argon2id hasher the app uses at sign-in time.
 *
 * Usage:
 *   node scripts/reset-user-password.mjs <email> <new-password>
 */
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "@node-rs/argon2";

const email = process.argv[2];
const newPassword = process.argv[3];
if (!email || !newPassword) {
  console.error("Usage: node scripts/reset-user-password.mjs <email> <new-password>");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const user = await db.user.findUnique({
  where: { email },
  select: { id: true, fullName: true, role: true, clinicId: true },
});
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const passwordHash = await hash(newPassword, {
  memoryCost: 19_456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
});
await db.user.update({
  where: { id: user.id },
  data: { passwordHash },
});

console.log(`✅ Password reset for ${email} (${user.fullName ?? "—"}, role=${user.role})`);
console.log(`   New password: ${newPassword}`);
await db.$disconnect();
