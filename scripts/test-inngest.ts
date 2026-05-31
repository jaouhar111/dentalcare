/**
 * End-to-end smoke test for the AI-0 event pipeline.
 *
 * Walks the exact code path a real Server Action follows:
 *   1. Insert a row in `event_outbox` via Prisma (same transaction shape
 *      a Server Action would use).
 *   2. Call `dispatchPendingEvents()` which forwards PENDING rows to
 *      Inngest.
 *   3. Verify the row flipped to DISPATCHED.
 *
 * Prereq: run `npx inngest-cli dev -u http://localhost:3000/api/inngest`
 * in another terminal — the dev server listens on http://localhost:8288.
 *
 * Run with:  pnpm tsx scripts/test-inngest.ts
 */

import "dotenv/config";
import { db } from "@/lib/db/client";
import { publishEvent, dispatchPendingEvents } from "@/lib/events";

async function main() {
  console.log("\n🔬 AI-0 pipeline smoke test\n");

  // Pick any clinic for the canary event — we don't actually create a
  // RDV, we just need a valid clinicId.
  const clinic = await db.clinic.findFirst({ select: { id: true, name: true } });
  if (!clinic) {
    console.error("❌ No clinic in DB. Seed first: pnpm db:seed");
    process.exit(1);
  }
  console.log(`Using clinic: ${clinic.name} (${clinic.id})\n`);

  // Step 1: publish via the same transaction pattern a Server Action uses.
  const before = await db.eventOutbox.count();
  console.log(`Outbox rows before : ${before}`);

  const event = await db.$transaction(async (tx) => {
    return publishEvent(tx, {
      clinicId: clinic.id,
      name: "appointment.created",
      // Phantom payload — no real appointment, just enough so the canary
      // function can run `step.run("load-appointment")` (which will return
      // null since the id doesn't exist; that's fine for the smoke test).
      payload: {
        id: `test-smoke-${Date.now()}`,
        patientId: "test-patient",
        dentistId: "test-dentist",
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  });
  console.log(`✅ Outbox row inserted: ${event.id}`);

  // Step 2: dispatch — forwards to Inngest's local dev server (if the CLI
  // is running) or to Inngest Cloud (if INNGEST_EVENT_KEY is set).
  console.log("\n📡 Dispatching to Inngest…");
  const result = await dispatchPendingEvents();
  console.log(`   dispatched: ${result.dispatched}, failed: ${result.failed}`);

  // Step 3: verify status flipped.
  const row = await db.eventOutbox.findUnique({
    where: { id: event.id },
    select: { status: true, dispatchedAt: true, lastError: true, attempts: true },
  });
  console.log("\nFinal row state:");
  console.log(`   status      : ${row?.status}`);
  console.log(`   dispatchedAt: ${row?.dispatchedAt?.toISOString() ?? "(null)"}`);
  console.log(`   attempts    : ${row?.attempts}`);
  if (row?.lastError) console.log(`   lastError   : ${row.lastError}`);

  if (row?.status === "DISPATCHED") {
    console.log(
      "\n✅ Pipeline OK.\n" +
        "   Open http://localhost:8288 → tab 'Stream' → you should see the\n" +
        "   `appointment.created` event AND a run of `appointment-created-canary`.",
    );
    process.exit(0);
  } else {
    console.error(
      "\n❌ Event was not dispatched. Most likely the Inngest CLI isn't running.\n" +
        "   Open a 2nd terminal and run:\n" +
        "     npx inngest-cli dev -u http://localhost:3000/api/inngest",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Test crashed:", err);
  process.exit(1);
});
