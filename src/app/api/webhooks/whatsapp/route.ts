import { NextResponse, type NextRequest } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import {
  parseQuickReplies,
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta verification handshake when registering the webhook URL.
 * Meta hits: GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * We must echo `hub.challenge` iff the token matches our env value.
 */
export async function GET(req: NextRequest) {
  const challenge = verifyWebhookChallenge(req.nextUrl.searchParams);
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Webhook payload from Meta. Handles:
 *   - Quick-reply button presses (confirm / reschedule / waitlist accept|decline)
 *   - Delivery status updates (logged for now)
 *
 * Lookup pattern for confirm/reschedule actions: the patient's phone is
 * matched against active appointments scheduled for the next 48h. We don't
 * trust the message content beyond the button payload.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const buttons = parseQuickReplies(payload);
  for (const b of buttons) {
    await handleButton(b.from, b.payload).catch((err) => {
      console.error("[whatsapp:webhook] handler failed", { from: b.from, payload: b.payload, err });
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleButton(fromPhone: string, payload: string) {
  // Normalize incoming phone (Meta sends without "+" sometimes).
  const normalized = fromPhone.startsWith("+") ? fromPhone : `+${fromPhone}`;

  switch (payload) {
    case "confirm_attendance":
      await confirmNextAppointment(normalized);
      return;
    case "request_reschedule":
      await requestRescheduleForNext(normalized);
      return;
    case "accept_waitlist_slot":
    case "decline_waitlist_slot":
      // Waitlist accept/decline is handled via the proposal token route
      // (`/api/waitlist/respond`); the WhatsApp button is informational only.
      console.log(`[whatsapp:webhook] waitlist button '${payload}' from ${normalized}`);
      return;
    case "remind_later":
    case "mark_paid_acknowledged":
      // Acknowledgement-only payloads — no DB mutation in V1.
      console.log(`[whatsapp:webhook] ack '${payload}' from ${normalized}`);
      return;
    default:
      console.log(`[whatsapp:webhook] unknown payload '${payload}' from ${normalized}`);
  }
}

/** Marks the patient's next active appointment within 48h as CONFIRMED. */
async function confirmNextAppointment(phone: string) {
  const horizon = new Date();
  horizon.setHours(horizon.getHours() + 48);

  const appt = await db.appointment.findFirst({
    where: {
      patient: { phone },
      startAt: { gt: new Date(), lt: horizon },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULE_REQUESTED] },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, clinicId: true },
  });
  if (!appt) return;

  await db.appointment.update({
    where: { id: appt.id },
    data: {
      status: AppointmentStatus.CONFIRMED,
      confirmationReceivedAt: new Date(),
    },
  });
  await audit({
    clinicId: appt.clinicId,
    action: "appointment.confirm.whatsapp",
    entity: "Appointment",
    entityId: appt.id,
    payload: { source: "whatsapp-button" },
  });
}

/** Flags the next appointment as "patient asked to reschedule". */
async function requestRescheduleForNext(phone: string) {
  const horizon = new Date();
  horizon.setHours(horizon.getHours() + 48);

  const appt = await db.appointment.findFirst({
    where: {
      patient: { phone },
      startAt: { gt: new Date(), lt: horizon },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, clinicId: true },
  });
  if (!appt) return;

  await db.appointment.update({
    where: { id: appt.id },
    data: { status: AppointmentStatus.RESCHEDULE_REQUESTED },
  });
  await audit({
    clinicId: appt.clinicId,
    action: "appointment.reschedule_request.whatsapp",
    entity: "Appointment",
    entityId: appt.id,
    payload: { source: "whatsapp-button" },
  });
}
