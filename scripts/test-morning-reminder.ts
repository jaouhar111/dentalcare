/**
 * Smoke test for the morning-of (08:00 Casablanca) reminder pipeline.
 *
 * Bypasses Inngest entirely — calls `sendMorningReminderForAppointment`
 * directly so we can verify the helper logic + WhatsApp template
 * fallback in a single round-trip, without waiting for 08:00 local
 * tomorrow.
 *
 * Behavior:
 *   1. Picks the first appointment whose `startAt` falls inside the
 *      Casablanca "today" window AND status is SCHEDULED|CONFIRMED.
 *   2. If none exists, creates a TEMP appointment 2 hours from now for
 *      the first patient in the first clinic, runs the test, then
 *      deletes the temp row (transactional).
 *   3. Calls `sendMorningReminderForAppointment(id)` and prints the
 *      ReminderResult so you can see whether it sent live, mocked,
 *      drifted, or already-sent.
 *
 * Run:  pnpm tsx scripts/test-morning-reminder.ts [--reset]
 *
 *   --reset : if the candidate already has `morningReminderSentAt`
 *             set, clear it before calling the helper. Lets you re-run
 *             the test repeatedly on the same RDV.
 */

import "dotenv/config";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { sendMorningReminderForAppointment } from "@/lib/whatsapp/reminders";

async function main() {
  const reset = process.argv.includes("--reset");
  const forceTemp = process.argv.includes("--temp");
  console.log("\n☀️  Morning-reminder smoke test\n");

  // Casablanca = UTC+1. Compute today's local window in UTC.
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(-1, 0, 0, 0);
  if (todayStart > now) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  console.log(`Casablanca window: ${todayStart.toISOString()}  →  ${todayEnd.toISOString()}\n`);

  // 1) Try to find a FUTURE candidate today first (drift guard requires
  //    startAt > now). If --temp, skip this and force a temp RDV.
  let candidate = forceTemp
    ? null
    : await db.appointment.findFirst({
        where: {
          startAt: { gte: now, lt: todayEnd },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
        select: {
          id: true,
          clinicId: true,
          startAt: true,
          morningReminderSentAt: true,
          patient: { select: { firstName: true, phone: true } },
        },
        orderBy: { startAt: "asc" },
      });

  let tempCreated = false;

  if (!candidate) {
    console.log("ℹ️  No RDV today — creating a temp appointment for the test.\n");
    const seed = await db.$transaction(async (tx) => {
      // Find ANY patient first, then derive clinic from there so we don't
      // pick a clinic with no patients (which would break the test).
      const patient = await tx.patient.findFirst({
        where: { deletedAt: null, phone: { not: "" } },
        select: { id: true, firstName: true, phone: true, clinicId: true },
        orderBy: { createdAt: "desc" },
      });
      if (!patient) throw new Error("no patient in DB with a phone; create one first");
      const clinicId = patient.clinicId;
      const dentist = await tx.dentist.findFirst({
        where: { clinicId },
        select: { id: true },
      });
      if (!dentist) throw new Error(`no dentist in clinic ${clinicId}; create one first`);
      const owner = await tx.user.findFirst({
        where: { clinicId },
        select: { id: true },
      });
      if (!owner) throw new Error(`no user in clinic ${clinicId}; create one first`);

      const startAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
      const a = await tx.appointment.create({
        data: {
          clinicId,
          patientId: patient.id,
          dentistId: dentist.id,
          startAt,
          endAt,
          status: AppointmentStatus.SCHEDULED,
          reason: "[TEST] morning reminder smoke",
          createdById: owner.id,
        },
        select: {
          id: true,
          clinicId: true,
          startAt: true,
          morningReminderSentAt: true,
          patient: { select: { firstName: true, phone: true } },
        },
      });
      return a;
    });
    candidate = seed;
    tempCreated = true;
  }

  console.log(`Target RDV : ${candidate.id}`);
  console.log(`  patient  : ${candidate.patient.firstName}  (${candidate.patient.phone})`);
  console.log(`  startAt  : ${candidate.startAt.toISOString()}`);
  console.log(`  already? : ${candidate.morningReminderSentAt ? "YES" : "no"}`);

  if (candidate.morningReminderSentAt && reset) {
    await db.appointment.update({
      where: { id: candidate.id },
      data: { morningReminderSentAt: null },
    });
    console.log("  → reset morningReminderSentAt to null\n");
  } else if (candidate.morningReminderSentAt) {
    console.log("  → use --reset to clear the flag and re-test\n");
  }

  console.log("\n📨 Calling sendMorningReminderForAppointment…\n");
  const result = await sendMorningReminderForAppointment(candidate.id);
  console.log("Result:", JSON.stringify(result, null, 2));

  if (tempCreated) {
    await db.appointment.delete({ where: { id: candidate.id } });
    console.log(`\n🧹 Cleaned up temp RDV ${candidate.id}`);
  }

  console.log("\n✅ Done.\n");

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Test crashed:", err);
  process.exit(1);
});
