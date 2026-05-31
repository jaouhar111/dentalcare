/**
 * Verifies a user can authenticate locally by checking the bcrypt
 * hash against the supplied plain-text password — bypasses Auth.js
 * so we can isolate whether the failure is in the DB or in the auth
 * layer.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: pnpm tsx scripts/test-login.ts <email> <password>");
    process.exit(1);
  }
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
      fullName: true,
    },
  });
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }
  console.log(`User: ${user.fullName} (${user.email}) role=${user.role} active=${user.isActive}`);
  console.log(`Hash prefix: ${user.passwordHash.slice(0, 20)}…`);

  const ok = await verifyPassword(user.passwordHash, password);
  console.log(`\nPassword check: ${ok ? "✅ VALID" : "❌ INVALID"}`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
