/**
 * End-to-end AI booking flow test.
 *
 * Simulates a multi-turn WhatsApp conversation against the real cabinet
 * data in the dev DB — patient asks for an appointment, the AI calls
 * tools, proposes slots, books one. Each turn is printed so you can
 * watch the tool loop work.
 *
 * Run with:  pnpm tsx scripts/test-ai-engine.ts
 *
 * Prereq:
 *   - GEMINI_API_KEY set in .env
 *   - At least 1 clinic + 1 dentist + 1 patient with a phone number
 *   - (optional) inngest-cli running for the event pipeline to flow
 */

import "dotenv/config";
import { db } from "@/lib/db/client";
import { runBookingConversation } from "@/lib/ai/engine";
import { buildDentalSystemPrompt } from "@/lib/ai/prompts/dental";
import type { ChatMessage } from "@/lib/ai/types";

async function main() {
  console.log("\n🤖 AI Booking — engine smoke test\n");

  // Pick the cabinet + first active dentist + first patient with a phone.
  const clinic = await db.clinic.findFirst({ select: { id: true, name: true } });
  if (!clinic) {
    console.error("❌ No clinic — run `pnpm db:seed` first.");
    process.exit(1);
  }
  // Restrict to the "mehdi test" sandbox patient — same reason as
  // scripts/test-ai-webhook.ts.
  const patient = await db.patient.findFirst({
    where: {
      clinicId: clinic.id,
      deletedAt: null,
      firstName: { contains: "mehdi", mode: "insensitive" },
      lastName: { contains: "test", mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!patient) {
    console.error(
      "❌ Patient 'mehdi test' missing — create one (firstName=mehdi, lastName=test) via the UI.",
    );
    process.exit(1);
  }
  const anyUser = await db.user.findFirst({
    where: { clinicId: clinic.id, role: "ADMIN" },
    select: { id: true },
  });
  if (!anyUser) {
    console.error("❌ No admin user — needed as the AI's `createdBy`.");
    process.exit(1);
  }

  console.log(`Clinic : ${clinic.name}`);
  console.log(`Patient: ${patient.firstName} ${patient.lastName} (${patient.phone})\n`);

  const context = {
    clinicId: clinic.id,
    patientId: patient.id,
    patientPhone: patient.phone,
    userId: anyUser.id,
  };

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const systemPrompt = buildDentalSystemPrompt({
    clinicName: clinic.name,
    todayIso,
  });

  // Simulated patient conversation (3 turns) — pretend each line came in
  // as a WhatsApp message. We feed the assistant's reply + tool history
  // back into the next turn, which is exactly what the webhook handler
  // will do once we persist `AIConversation` rows.
  const turns = [
    "Bonjour, vous êtes ouverts mardi ?",
    "Je voudrais un RDV avec n'importe quel dentiste, jeudi matin si possible.",
    "Le premier créneau me convient, réserve-le pour un détartrage.",
  ];

  let history: ChatMessage[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    console.log(`\n━━━ TURN ${i + 1} ━━━`);
    console.log(`👤 Patient : ${turn}`);

    const result = await runBookingConversation({
      context,
      systemPrompt,
      history,
      userMessage: turn,
    });

    if (result.toolRuns.length > 0) {
      console.log(`🔧 Tool calls (${result.toolRuns.length}):`);
      for (const r of result.toolRuns) {
        const status = r.validationError
          ? `❌ validation: ${r.validationError}`
          : r.runtimeError
            ? `❌ runtime: ${r.runtimeError}`
            : "✅";
        console.log(`   ${status} ${r.toolName}(${JSON.stringify(r.args).slice(0, 80)})`);
      }
    }

    console.log(`🤖 Bot     : ${result.text}`);
    console.log(`   provider=${result.provider}  tokens=${result.totalTokens}`);

    history = result.messages;
  }

  console.log("\n✅ Conversation flow complete.");
  console.log(`   Final history length: ${history.length} messages.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test crashed:", err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
