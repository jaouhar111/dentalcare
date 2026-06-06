import { NextResponse, type NextRequest } from "next/server";
import { InstallmentStatus, PaymentPlanStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendText } from "@/lib/whatsapp/client";
import { buildPaymentDue } from "@/lib/whatsapp/templates";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily 09:00 cron — sends WhatsApp `payment_due` reminders for upcoming and
 * overdue installments.
 *
 * Two passes:
 *   - **J-3**: installments due in 3 days, never reminded → friendly heads-up.
 *   - **J+1**: installments overdue by 1 day or more, no J+1 reminder yet →
 *     gentle nag with the same template (we keep template variety to one).
 *
 * Both passes mark a `reminderJ3SentAt` / `reminderJ1SentAt` timestamp so the
 * cron is idempotent even if Vercel triggers it twice in a window.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // ─── Pass 1: J-3 heads-up ────────────────────────────────────────────────
  const j3 = await db.paymentPlanInstallment.findMany({
    where: {
      status: InstallmentStatus.PENDING,
      dueDate: { gte: today, lte: threeDaysFromNow },
      reminderJ3SentAt: null,
      plan: { status: PaymentPlanStatus.ACTIVE },
    },
    include: {
      plan: {
        include: {
          patient: { select: { firstName: true, phone: true, preferredLocale: true } },
          invoice: { select: { number: true } },
          clinic: { select: { name: true, openwaSessionId: true } },
        },
      },
    },
  });

  // ─── Pass 2: J+1 overdue nag ─────────────────────────────────────────────
  const j1 = await db.paymentPlanInstallment.findMany({
    where: {
      status: InstallmentStatus.PENDING,
      dueDate: { lt: today, gte: yesterday },
      reminderJ1SentAt: null,
      plan: { status: PaymentPlanStatus.ACTIVE },
    },
    include: {
      plan: {
        include: {
          patient: { select: { firstName: true, phone: true, preferredLocale: true } },
          invoice: { select: { number: true } },
          clinic: { select: { name: true, openwaSessionId: true } },
        },
      },
    },
  });

  let sentJ3 = 0;
  let sentJ1 = 0;
  const errors: Array<{ installmentId: string; error: string }> = [];

  function paymentDueBody(inst: typeof j3[number] | typeof j1[number]) {
    const loc = (inst.plan.patient.preferredLocale ?? "fr") as Locale;
    return buildPaymentDue({
      patientFirstName: inst.plan.patient.firstName,
      amount: formatCurrency(Number(inst.amount), loc),
      dueDate: formatDate(inst.dueDate, loc, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      installment: `${inst.sequence}/${inst.plan.installmentsCount}`,
      invoiceNumber: inst.plan.invoice.number ?? "—",
      clinicName: inst.plan.clinic.name,
      locale: loc,
    });
  }

  for (const inst of j3) {
    try {
      await sendText({
        to: inst.plan.patient.phone,
        body: paymentDueBody(inst),
        sessionId: inst.plan.clinic.openwaSessionId,
      });
      await db.paymentPlanInstallment.update({
        where: { id: inst.id },
        data: { reminderJ3SentAt: new Date() },
      });
      sentJ3++;
    } catch (err) {
      errors.push({ installmentId: inst.id, error: String(err) });
    }
  }

  for (const inst of j1) {
    try {
      await sendText({
        to: inst.plan.patient.phone,
        body: paymentDueBody(inst),
        sessionId: inst.plan.clinic.openwaSessionId,
      });
      await db.paymentPlanInstallment.update({
        where: { id: inst.id },
        data: { reminderJ1SentAt: new Date() },
      });
      sentJ1++;
    } catch (err) {
      errors.push({ installmentId: inst.id, error: String(err) });
    }
  }

  // Audit aggregate run — no per-clinic audit since this is a cross-clinic cron.
  await audit({
    clinicId: "*",
    action: "cron",
    entity: "PaymentPlanInstallment",
    payload: { sentJ3, sentJ1, errors: errors.length },
  });

  return NextResponse.json({
    ok: true,
    sentJ3,
    sentJ1,
    errors,
  });
}
