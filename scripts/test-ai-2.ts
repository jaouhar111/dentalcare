/**
 * End-to-end smoke test for the AI-2 J-1 reminder pipeline.
 *
 * Creates a real appointment ~90 minutes in the future for "mehdi test",
 * publishes `appointment.created`, then watches the appointment row for
 * `reminderSentAt` to flip. With a near-future startAt, Inngest skips
 * the sleep (reminderAt is already in the past) and fires the reminder
 * almost immediately.
 *
 * Prereqs:
 *  - `pnpm dev` running on :3000
 *  - `npx inngest-cli dev -u http://localhost:3000/api/inngest` on :8288
 *  - `mehdi test` patient exists with phone `+212663448449`
 *  - WhatsApp creds in .env (will actually send a template if so;
 *    otherwise sendTemplate falls back to a mock log)
 *
 * Run: pnpm tsx scripts/test-ai-2.ts
 */

import "dotenv/config";
import { AppointmentStatus, AppointmentSource } from "@prisma/client";
import { db } from "@/lib/db/client";
import { publishEvent, dispatchPendingEvents } from "@/lib/events";

async function main() {
  console.log("\n🧪 AI-2 J-1 reminder smoke test\n");

  const patient = await db.patient.findFirst({
    where: {
      deletedAt: null,
      firstName: { contains: "mehdi", mode: "insensitive" },
      lastName: { contains: "test", mode: "insensitive" },
    },
    select: { id: true, phone: true, clinicId: true, preferredChannel: true },
  });
  if (!patient) {
    console.error("❌ Patient 'mehdi test' missing");
    process.exit(1);
  }
  console.log(`   Patient : ${patient.phone} (${patient.preferredChannel})`);

  const dentist = await db.dentist.findFirst({
    where: { clinicId: patient.clinicId, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!dentist) {
    console.error("❌ No active dentist");
    process.exit(1);
  }
  console.log(`   Dentist : Dr ${dentist.firstName} ${dentist.lastName}`);

  const admin = await db.user.findFirst({
    where: { clinicId: patient.clinicId, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    console.error("❌ No admin user");
    process.exit(1);
  }

  // Schedule the RDV 90 minutes out — well inside the [1h, 48h] drift
  // window the helper enforces, so the reminder actually fires instead
  // of being skipped as `STARTAT_DRIFT`.
  const startAt = new Date(Date.now() + 90 * 60_000);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);

  const appt = await db.$transaction(async (tx) => {
    const a = await tx.appointment.create({
      data: {
        clinicId: patient.clinicId,
        patientId: patient.id,
        dentistId: dentist.id,
        startAt,
        endAt,
        reason: "Test AI-2",
        status: AppointmentStatus.SCHEDULED,
        source: AppointmentSource.AI_WHATSAPP,
        createdById: admin.id,
      },
      select: { id: true, startAt: true },
    });
    await publishEvent(tx, {
      clinicId: patient.clinicId,
      name: "appointment.created",
      payload: {
        id: a.id,
        patientId: patient.id,
        dentistId: dentist.id,
        startAt: a.startAt.toISOString(),
        source: "test-ai-2",
      },
    });
    return a;
  });
  console.log(`   Created appt ${appt.id} at ${appt.startAt.toISOString()}`);

  // Forward the outbox row to Inngest. The `appointmentJ1Reminder`
  // function will (1) see reminderAt = startAt − 24h, which is in the
  // past for a 90-min-future RDV, (2) skip the sleep, (3) call the
  // reminder helper immediately.
  console.log("\n📡 Dispatching outbox → Inngest…");
  const d = await dispatchPendingEvents();
  console.log(`   dispatched: ${d.dispatched}, failed: ${d.failed}`);

  // Poll for up to 30s for the reminder to fire.
  console.log("\n⏱  Waiting for reminderSentAt (max 30s)…");
  const deadline = Date.now() + 30_000;
  let lastStatus: string | null = null;
  while (Date.now() < deadline) {
    const row = await db.appointment.findUnique({
      where: { id: appt.id },
      select: { reminderSentAt: true, status: true },
    });
    if (!row) break;
    if (row.reminderSentAt) {
      console.log(`\n✅ reminderSentAt = ${row.reminderSentAt.toISOString()}`);
      break;
    }
    if (row.status !== lastStatus) {
      lastStatus = row.status;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  // Final state + audit trail.
  const final = await db.appointment.findUnique({
    where: { id: appt.id },
    select: { id: true, reminderSentAt: true, status: true, confirmationToken: true },
  });
  console.log("\n📊 Final appointment state:");
  console.log(`   reminderSentAt    : ${final?.reminderSentAt?.toISOString() ?? "(null)"}`);
  console.log(`   confirmationToken : ${final?.confirmationToken ? "✓ set" : "(null)"}`);

  const audits = await db.auditLog.findMany({
    where: { entity: "Appointment", entityId: appt.id, action: "appointment.reminder.sent" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { action: true, createdAt: true, payloadJson: true },
  });
  console.log(`\n📜 Reminder audit entries (${audits.length}):`);
  for (const a of audits) {
    console.log(`   • ${a.createdAt.toISOString()}  ${JSON.stringify(a.payloadJson)}`);
  }

  if (final?.reminderSentAt) {
    console.log("\n✅ AI-2 pipeline OK.");
    process.exit(0);
  } else {
    console.error(
      "\n❌ Reminder did not fire within 30s. Common causes:\n" +
        "   • inngest-cli dev not running (8288)\n" +
        "   • dev server not running (3000)\n" +
        "   • Function not registered in /api/inngest (check src/lib/inngest.ts functions array)",
    );
    process.exit(1);
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
