import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppointmentStatus, CommunicationChannel } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendTemplate } from "@/lib/whatsapp/client";
import { APPOINTMENT_REMINDER } from "@/lib/whatsapp/templates";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily J-1 reminder cron.
 *
 * Run by `vercel.json` at 18:00 every day. Finds every appointment scheduled
 * for tomorrow that hasn't been reminded yet, generates a confirmation token,
 * and dispatches a WhatsApp message (or email — TODO Phase 11.x) per
 * `patient.preferredChannel`.
 *
 * Idempotent: skips appointments that already have `reminderSentAt`.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Tomorrow's day window in the server's local time (cabinet TZ = Africa/Casablanca).
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const appointments = await db.appointment.findMany({
    where: {
      startAt: { gte: start, lt: end },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      reminderSentAt: null,
    },
    select: {
      id: true,
      clinicId: true,
      startAt: true,
      confirmationToken: true,
      reason: true,
      patient: {
        select: { firstName: true, phone: true, preferredChannel: true, preferredLocale: true },
      },
      dentist: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of appointments) {
    try {
      const token = a.confirmationToken ?? randomBytes(32).toString("base64url");
      if (!a.confirmationToken) {
        await db.appointment.update({
          where: { id: a.id },
          data: { confirmationToken: token },
        });
      }

      const locale = (a.patient.preferredLocale as Locale) ?? "fr";
      const dateStr = formatDate(a.startAt, locale);
      const timeStr = `${String(a.startAt.getHours()).padStart(2, "0")}:${String(a.startAt.getMinutes()).padStart(2, "0")}`;

      if (a.patient.preferredChannel === CommunicationChannel.WHATSAPP) {
        const res = await sendTemplate({
          to: a.patient.phone,
          template: APPOINTMENT_REMINDER,
          locale: locale === "en" ? "en" : locale === "ar" ? "ar" : "fr",
          params: {
            patientFirstName: a.patient.firstName,
            date: dateStr,
            time: timeStr,
            dentistName: `Dr ${a.dentist.firstName} ${a.dentist.lastName}`,
            clinicName: a.clinic.name,
          },
        });
        if (!res.ok) {
          failed++;
          continue;
        }
      } else {
        // Phase 11.x — actual Resend email send. For now log so we know we'd send.
        const link = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/${locale}/confirm-appointment?token=${token}`;
        console.log(`[reminder:email-mock] ${a.patient.phone} ${dateStr} ${timeStr} ${link}`);
      }

      await db.appointment.update({
        where: { id: a.id },
        data: { reminderSentAt: new Date() },
      });
      await audit({
        clinicId: a.clinicId,
        action: "appointment.reminder.sent",
        entity: "Appointment",
        entityId: a.id,
        payload: { channel: a.patient.preferredChannel },
      });
      sent++;
    } catch (err) {
      console.error("[cron:reminders] failed", { appointmentId: a.id, err });
      failed++;
    }
  }
  skipped = appointments.length - sent - failed;

  return NextResponse.json({ ok: true, total: appointments.length, sent, skipped, failed });
}
