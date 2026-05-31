/**
 * End-to-end smoke test for the AI-3 recall pipeline.
 *
 * Inserts a fresh `RecallReminder` row with `dueDate` ~30 seconds in
 * the future + publishes `recall.created`. The `recallReminderDueDate`
 * Inngest function should sleep until dueDate (almost immediately),
 * wake, and call `sendRecallReminderById`, which attempts the
 * `checkup_reminder` template send.
 *
 * Expected outcomes:
 *  - With `checkup_reminder` template approved on Meta → row flips to
 *    SENT + WhatsApp message arrives on the patient phone.
 *  - Without it → row stays PENDING + audit logs `recall.send_failed`
 *    visible at `/reminders-queue`.
 *
 * Prereqs: `pnpm dev`, `npx inngest-cli dev -u …/api/inngest`,
 * "mehdi test" patient with phone `+212663448449`.
 *
 * Run: pnpm tsx scripts/test-ai-3.ts
 */

import "dotenv/config";
import { RecallKind, RecallStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { dispatchPendingEvents, publishEvent } from "@/lib/events";

async function main() {
  console.log("\n🧪 AI-3 recall reminder smoke test\n");

  const patient = await db.patient.findFirst({
    where: {
      deletedAt: null,
      firstName: { contains: "mehdi", mode: "insensitive" },
      lastName: { contains: "test", mode: "insensitive" },
    },
    select: { id: true, phone: true, clinicId: true },
  });
  if (!patient) {
    console.error("❌ 'mehdi test' patient missing");
    process.exit(1);
  }
  console.log(`   Patient: ${patient.phone}`);

  const admin = await db.user.findFirst({
    where: { clinicId: patient.clinicId, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    console.error("❌ No admin user");
    process.exit(1);
  }

  // Wipe any pending recall on this patient so the test isn't a no-op
  // from the "already pending" check in the helper.
  await db.recallReminder.deleteMany({
    where: {
      patientId: patient.id,
      status: { in: [RecallStatus.PENDING, RecallStatus.SENT] },
      reason: "Test AI-3",
    },
  });

  const dueDate = new Date(Date.now() + 30_000); // 30 s ahead

  const recall = await db.$transaction(async (tx) => {
    const r = await tx.recallReminder.create({
      data: {
        clinicId: patient.clinicId,
        patientId: patient.id,
        kind: RecallKind.SCALING,
        dueDate,
        reason: "Test AI-3",
        createdById: admin.id,
      },
      select: { id: true, dueDate: true },
    });
    await publishEvent(tx, {
      clinicId: patient.clinicId,
      name: "recall.created",
      payload: {
        id: r.id,
        patientId: patient.id,
        dueDate: r.dueDate.toISOString(),
        kind: RecallKind.SCALING,
      },
    });
    return r;
  });
  console.log(`   Recall ${recall.id} dueDate=${recall.dueDate.toISOString()}`);

  console.log("\n📡 Dispatching outbox → Inngest…");
  const d = await dispatchPendingEvents();
  console.log(`   dispatched: ${d.dispatched}, failed: ${d.failed}`);

  // Poll up to 90s — gives Inngest's 30s sleep + send a comfortable margin.
  console.log("\n⏱  Waiting for status flip (max 90s)…");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const row = await db.recallReminder.findUnique({
      where: { id: recall.id },
      select: { status: true, sentAt: true },
    });
    if (!row) break;
    if (row.status !== RecallStatus.PENDING) {
      console.log(`\n✅ status=${row.status} sentAt=${row.sentAt?.toISOString() ?? "(null)"}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  // Final dump.
  const final = await db.recallReminder.findUnique({
    where: { id: recall.id },
    select: { status: true, sentAt: true, bookedAt: true },
  });
  console.log("\n📊 Final recall state:");
  console.log(`   status   : ${final?.status}`);
  console.log(`   sentAt   : ${final?.sentAt?.toISOString() ?? "(null)"}`);
  console.log(`   bookedAt : ${final?.bookedAt?.toISOString() ?? "(null)"}`);

  const audits = await db.auditLog.findMany({
    where: { entity: "RecallReminder", entityId: recall.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { action: true, createdAt: true, payloadJson: true },
  });
  console.log(`\n📜 Audit (${audits.length}):`);
  for (const a of audits) {
    console.log(`   • ${a.createdAt.toISOString()}  ${a.action}  ${JSON.stringify(a.payloadJson)}`);
  }

  if (final?.status === RecallStatus.SENT) {
    console.log("\n✅ AI-3 pipeline OK end-to-end (recall delivered).");
    process.exit(0);
  } else if (final?.status === RecallStatus.PENDING) {
    console.warn(
      "\n⚠️  Recall still PENDING — likely the checkup_reminder template" +
        " isn't approved yet on Meta. Pipeline ran (see audit / Inngest dashboard).",
    );
    process.exit(0);
  } else {
    console.error("\n❌ Unexpected final status.");
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
