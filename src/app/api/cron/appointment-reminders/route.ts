import { NextResponse, type NextRequest } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { sendJ1ReminderForAppointment } from "@/lib/whatsapp/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily J-1 reminder cron — *legacy* path.
 *
 * Inngest's `appointmentJ1Reminder` is the canonical scheduler now:
 * each `appointment.created` event auto-schedules its own J-1 wake.
 * This cron still runs as a safety net for:
 *
 *  - Appointments imported (seed/migration) without firing an event
 *  - Edge cases where Inngest cloud was unavailable at creation
 *
 * Both paths go through `sendJ1ReminderForAppointment`, so the
 * `reminderSentAt` idempotence guard prevents double-sends if both fire.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const ids = await db.appointment.findMany({
    where: {
      startAt: { gte: start, lt: end },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      reminderSentAt: null,
    },
    select: { id: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { id } of ids) {
    const r = await sendJ1ReminderForAppointment(id);
    if (r.ok) sent++;
    else if (r.reason === "SEND_FAILED") failed++;
    else skipped++;
  }
  return NextResponse.json({ ok: true, total: ids.length, sent, skipped, failed });
}
