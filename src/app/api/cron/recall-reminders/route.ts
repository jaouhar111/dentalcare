import { NextResponse, type NextRequest } from "next/server";
import { AppointmentStatus, RecallStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendTemplate } from "@/lib/whatsapp/client";
import { CHECKUP_REMINDER } from "@/lib/whatsapp/templates";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily 09:00 cron — fires the WhatsApp `checkup_reminder` template for every
 * PENDING recall whose `dueDate` is today (or has passed without being sent).
 *
 * Bonus signal: before sending we check if the patient already booked an
 * appointment dated ≥ dueDate. If so the recall is auto-marked
 * APPOINTMENT_BOOKED and we skip the message — no point bugging a patient who
 * already heard us.
 *
 * Anti-spam: recalls with `sentAt` set are skipped on subsequent runs.
 * Stale recalls (PENDING + dueDate + 30 days < now, never sent) get auto-
 * expired so they don't accumulate forever.
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

  // ─── Pass 0: auto-expire stale recalls ──────────────────────────────────
  const expired = await db.recallReminder.updateMany({
    where: {
      status: RecallStatus.PENDING,
      sentAt: null,
      dueDate: { lt: expiryCutoff },
    },
    data: { status: RecallStatus.EXPIRED },
  });

  // ─── Pass 1: due today or earlier, never sent ──────────────────────────
  const due = await db.recallReminder.findMany({
    where: {
      status: RecallStatus.PENDING,
      dueDate: { lte: today },
      sentAt: null,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          phone: true,
          preferredLocale: true,
        },
      },
      clinic: { select: { name: true, phone: true } },
    },
  });

  let sent = 0;
  let autoBooked = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const r of due) {
    try {
      // Bonus: detect an upcoming appointment after the due date — count it
      // as "already on the calendar" and skip the send.
      const existing = await db.appointment.findFirst({
        where: {
          patientId: r.patientId,
          startAt: { gte: r.dueDate },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
        select: { id: true },
      });
      if (existing) {
        await db.recallReminder.update({
          where: { id: r.id },
          data: { status: RecallStatus.APPOINTMENT_BOOKED, bookedAt: new Date() },
        });
        autoBooked++;
        continue;
      }

      const loc = (r.patient.preferredLocale ?? "fr") as Locale;
      const checkupType =
        r.reason ?? (r.kind === "SCALING" ? "Détartrage de suivi" : "Contrôle");

      await sendTemplate({
        to: r.patient.phone,
        template: CHECKUP_REMINDER,
        locale: loc === "fr" || loc === "en" || loc === "ar" ? loc : "fr",
        params: {
          patientFirstName: r.patient.firstName,
          checkupType,
          sinceLast: formatDate(r.dueDate, loc, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          clinicName: r.clinic.name,
          clinicPhone: r.clinic.phone ?? "—",
        },
      });
      await db.recallReminder.update({
        where: { id: r.id },
        data: { status: RecallStatus.SENT, sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      errors.push({ id: r.id, error: String(err) });
    }
  }

  await audit({
    clinicId: "*",
    action: "cron",
    entity: "RecallReminder",
    payload: { sent, autoBooked, expired: expired.count, errors: errors.length },
  });

  return NextResponse.json({
    ok: true,
    sent,
    autoBooked,
    expired: expired.count,
    errors,
  });
}
