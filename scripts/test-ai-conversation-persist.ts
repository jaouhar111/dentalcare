/**
 * Verifies the AIConversation persistence layer:
 *   1. loadOrCreateConversation creates a row the first time.
 *   2. Re-calling reuses the same row (no dup keys).
 *   3. persistConversationTurn writes history + bumps counters.
 *   4. shouldAutoReply gates correctly on status.
 *
 * Run:  pnpm tsx scripts/test-ai-conversation-persist.ts
 */

import "dotenv/config";
import { db } from "@/lib/db/client";
import {
  loadOrCreateConversation,
  persistConversationTurn,
  shouldAutoReply,
  handOffConversation,
  reactivateConversation,
} from "@/lib/ai/conversation";
import type { BookingConversationResult } from "@/lib/ai/engine";

async function main() {
  console.log("\n🧪 AIConversation persistence test\n");

  const clinic = await db.clinic.findFirst({ select: { id: true, name: true } });
  if (!clinic) {
    console.error("❌ No clinic");
    process.exit(1);
  }

  const admin = await db.user.findFirst({
    where: { clinicId: clinic.id, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    console.error("❌ No admin user");
    process.exit(1);
  }

  const phone = `+212600000${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
  console.log(`Using phone: ${phone}`);

  // 1) create
  const first = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: phone,
  });
  console.log(`✅ Created conversation ${first.id}`);
  console.log(`   status=${first.status}  history.len=${first.history.length}  turns=${first.totalTurns}`);

  // 2) re-load (must return same id)
  const second = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: phone,
  });
  if (second.id !== first.id) {
    throw new Error(`Expected same id, got ${second.id} vs ${first.id}`);
  }
  console.log("✅ Re-load returned the same row (idempotent)");

  // 3) persist a fake engine result
  const fakeResult: BookingConversationResult = {
    text: "RDV confirmé.",
    messages: [
      { role: "user", content: "Bonjour" },
      { role: "assistant", content: "Bonjour, comment puis-je aider ?" },
      { role: "user", content: "Un RDV svp" },
      { role: "assistant", content: "RDV confirmé." },
    ],
    toolRuns: [],
    provider: "gemini",
    totalTokens: 1234,
  };
  await persistConversationTurn({ id: first.id, result: fakeResult });
  const afterPersist = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: phone,
  });
  if (afterPersist.history.length !== 4) {
    throw new Error(`Expected history.length=4, got ${afterPersist.history.length}`);
  }
  if (afterPersist.totalTokens !== 1234) {
    throw new Error(`Expected totalTokens=1234, got ${afterPersist.totalTokens}`);
  }
  console.log(`✅ Persisted: history.len=${afterPersist.history.length}  tokens=${afterPersist.totalTokens}  turns=${afterPersist.totalTurns}`);

  // 4) handover gating
  if (!shouldAutoReply(afterPersist)) {
    throw new Error("ACTIVE should auto-reply");
  }
  await handOffConversation({ id: first.id, userId: admin.id });
  const handed = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: phone,
  });
  if (shouldAutoReply(handed)) {
    throw new Error("HANDED_OFF should NOT auto-reply");
  }
  console.log(`✅ Handover gating works (status=${handed.status})`);

  // 5) reactivate
  await reactivateConversation(first.id);
  const reactivated = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: phone,
  });
  if (!shouldAutoReply(reactivated)) {
    throw new Error("ACTIVE after reactivation should auto-reply");
  }
  console.log(`✅ Reactivation works (status=${reactivated.status})`);

  // cleanup
  await db.aIConversation.delete({ where: { id: first.id } });
  console.log("\n✅ All persistence checks passed; test row deleted.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌", err);
    process.exit(1);
  });
