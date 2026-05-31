/**
 * Simulates a real WhatsApp webhook hit: builds a Meta-shaped payload,
 * walks `parseTextMessages`, dispatches to `handleInboundTextMessage`,
 * and asserts the conversation row was updated end-to-end.
 *
 * No Meta creds required — `sendText` falls back to mock log.
 *
 * Run:  pnpm tsx scripts/test-ai-webhook.ts
 */

import "dotenv/config";
import { db } from "@/lib/db/client";
import { parseTextMessages } from "@/lib/whatsapp/client";
import { handleInboundTextMessage } from "@/lib/ai/webhook-handler";

async function main() {
  console.log("\n🪝 AI webhook end-to-end test\n");

  // Always run against the "mehdi test" patient — the user wants a
  // dedicated sandbox row and doesn't want the smoke test grabbing a
  // random real patient.
  const patient = await db.patient.findFirst({
    where: {
      deletedAt: null,
      firstName: { contains: "mehdi", mode: "insensitive" },
      lastName: { contains: "test", mode: "insensitive" },
    },
    select: { id: true, phone: true, firstName: true, lastName: true, clinicId: true },
  });
  if (!patient) {
    console.error(
      "❌ Patient 'mehdi test' missing — create one (firstName=mehdi, lastName=test) via the UI.",
    );
    process.exit(1);
  }
  console.log(`Patient: ${patient.firstName} ${patient.lastName} (${patient.phone})`);

  // Wipe any existing conversation for this phone so we test the fresh
  // creation path.
  await db.aIConversation.deleteMany({
    where: { clinicId: patient.clinicId, patientPhone: patient.phone },
  });

  const conversation = [
    "Bonjour, vous êtes ouverts mardi ?",
    "Je voudrais un RDV avec n'importe quel dentiste, jeudi matin.",
    "Le premier créneau me convient, réserve-le pour un détartrage.",
  ];

  for (let i = 0; i < conversation.length; i++) {
    const turn = conversation[i]!;
    console.log(`\n━━━ TURN ${i + 1} ━━━`);
    console.log(`👤 ${turn}`);

    // Build a Meta-shaped payload so parseTextMessages is in the loop.
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: patient.phone.replace(/^\+/, ""),
                    id: `wamid.test-${Date.now()}-${i}`,
                    type: "text",
                    text: { body: turn },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseTextMessages(payload);
    if (parsed.length !== 1) {
      throw new Error(`Expected 1 parsed message, got ${parsed.length}`);
    }

    const result = await handleInboundTextMessage({
      fromPhone: parsed[0]!.from,
      body: parsed[0]!.body,
      messageId: parsed[0]!.messageId,
    });

    if (result.status === "replied") {
      console.log(`🤖 ${result.replyText}`);
      console.log(`   conversation=${result.conversationId}  provider=${result.provider}  tokens=${result.tokens}`);
    } else if (result.status === "dropped") {
      console.log(`⏸  DROPPED reason=${result.reason}`);
    } else {
      console.log(`❌ ERROR: ${result.reason}`);
    }
  }

  // Verify the conversation persisted correctly.
  const row = await db.aIConversation.findUnique({
    where: {
      clinicId_patientPhone: { clinicId: patient.clinicId, patientPhone: patient.phone },
    },
  });
  if (!row) throw new Error("Conversation row missing after webhook flow");
  console.log("\n📊 Final conversation state:");
  console.log(`   turns       : ${row.totalTurns}`);
  console.log(`   tokens      : ${row.totalTokens}`);
  console.log(`   history.len : ${Array.isArray(row.historyJson) ? (row.historyJson as unknown[]).length : "?"}`);
  console.log(`   status      : ${row.status}`);
  console.log(`   patientId   : ${row.patientId ?? "(null)"}`);

  // Verify audit logs landed.
  const audits = await db.auditLog.findMany({
    where: { entity: "AIConversation", entityId: row.id },
    orderBy: { createdAt: "asc" },
    select: { action: true, createdAt: true },
  });
  console.log(`\n📜 Audit entries (${audits.length}):`);
  for (const a of audits) console.log(`   • ${a.action}  ${a.createdAt.toISOString()}`);

  if (row.totalTurns !== conversation.length) {
    throw new Error(`Expected ${conversation.length} turns, got ${row.totalTurns}`);
  }
  if (audits.length < conversation.length) {
    throw new Error(`Expected at least ${conversation.length} audit entries, got ${audits.length}`);
  }
  console.log("\n✅ Webhook end-to-end flow OK.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌", err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
