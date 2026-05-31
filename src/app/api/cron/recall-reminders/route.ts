import { NextResponse, type NextRequest } from "next/server";
import { RecallStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendRecallReminderById } from "@/lib/whatsapp/recalls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily 09:00 cron — *legacy* safety-net path.
 *
 * `recallReminderDueDate` (Inngest) is the canonical scheduler now:
 * every `recall.created` event auto-schedules its own due-date wake.
 * This cron stays alive for:
 *
 *  - Recall rows imported via seed / migration without firing an event
 *  - Edge cases where Inngest cloud was unavailable at creation
 *  - Auto-expiring stale rows nobody ever sent (kept here vs. Inngest
 *    so we have one job per recall, not 100k orphan sleeps)
 *
 * The actual send delegates to `sendRecallReminderById`, so both paths
 * share idempotence + appointment-already-booked detection.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryCutoff = new Date(today);
  expiryCutoff.setDate(expiryCutoff.getDate() - 30);

  const expired = await db.recallReminder.updateMany({
    where: {
      status: RecallStatus.PENDING,
      sentAt: null,
      dueDate: { lt: expiryCutoff },
    },
    data: { status: RecallStatus.EXPIRED },
  });

  const due = await db.recallReminder.findMany({
    where: {
      status: RecallStatus.PENDING,
      dueDate: { lte: today },
      sentAt: null,
    },
    select: { id: true },
  });

  let sent = 0;
  let autoBooked = 0;
  let failed = 0;
  for (const r of due) {
    const result = await sendRecallReminderById(r.id);
    if (result.ok) sent++;
    else if (result.reason === "APPOINTMENT_ALREADY_BOOKED") autoBooked++;
    else if (result.reason === "SEND_FAILED") failed++;
  }

  await audit({
    clinicId: "*",
    action: "cron",
    entity: "RecallReminder",
    payload: { sent, autoBooked, expired: expired.count, failed },
  });

  return NextResponse.json({
    ok: true,
    sent,
    autoBooked,
    expired: expired.count,
    failed,
  });
}
