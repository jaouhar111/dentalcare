import { NextResponse, type NextRequest } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import {
  downloadMedia,
  parseAudioMessages,
  parseQuickReplies,
  parseTextMessages,
  sendText,
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/whatsapp/client";
import { handleInboundTextMessage } from "@/lib/ai/webhook-handler";
import { transcribeAudio } from "@/lib/ai/transcribe";

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

  // Meta groups all change events under `entry[].changes[].value` and
  // each `value` carries the `metadata.phone_number_id` that identifies
  // *which* of our cabinets the message landed on. We pull it once so
  // the per-message handlers can route by cabinet without re-parsing.
  const metaPhoneNumberId = extractMetaPhoneNumberId(payload);

  // Plain-text messages → AI booking engine. Run sequentially so a
  // patient who sends two messages in rapid succession gets a coherent
  // history (no interleaved persistence). Failures are caught so one
  // bad message doesn't poison the whole batch.
  const texts = parseTextMessages(payload);
  for (const t of texts) {
    await handleInboundTextMessage({
      fromPhone: t.from,
      body: t.body,
      messageId: t.messageId,
      metaPhoneNumberId,
    }).catch((err) => {
      console.error("[whatsapp:webhook] AI handler failed", { from: t.from, err });
    });
  }

  // Voice notes → download from Meta → Gemini transcribes → fed into
  // the same engine as text. Failures fall back to a polite "désolé je
  // n'ai pas compris" text so the patient knows to try again.
  const audios = parseAudioMessages(payload);
  for (const a of audios) {
    await handleInboundAudio({ ...a, metaPhoneNumberId }).catch((err) => {
      console.error("[whatsapp:webhook] audio handler failed", { from: a.from, err });
    });
  }

  return NextResponse.json({ ok: true });
}

function extractMetaPhoneNumberId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const entries = (payload as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { metadata?: { phone_number_id?: string } } })
        .value;
      const id = value?.metadata?.phone_number_id;
      if (typeof id === "string" && id.length > 0) return id;
    }
  }
  return null;
}

async function handleInboundAudio(a: {
  from: string;
  mediaId: string;
  mimeType: string;
  messageId: string;
  metaPhoneNumberId?: string | null;
}) {
  const normalized = a.from.startsWith("+") ? a.from : `+${a.from}`;
  const media = await downloadMedia(a.mediaId);
  if (!media.ok) {
    console.error("[whatsapp:webhook] downloadMedia failed", { mediaId: a.mediaId, err: media.error });
    await sendText({
      to: normalized,
      body: "Désolé, je n'ai pas pu télécharger ton message vocal. Peux-tu réécrire ?",
    }).catch(() => undefined);
    return;
  }
  const transcript = await transcribeAudio({ buffer: media.buffer, mimeType: media.mimeType });
  if (!transcript.ok) {
    if (transcript.error === "INAUDIBLE") {
      await sendText({
        to: normalized,
        body: "Je n'arrive pas à comprendre le vocal — il est peut-être trop court ou inaudible. Tu peux réessayer ou m'écrire en texte ?",
      }).catch(() => undefined);
      return;
    }
    console.error("[whatsapp:webhook] transcribe failed", { err: transcript.error });
    await sendText({
      to: normalized,
      body: "Petit problème pour comprendre ton vocal — peux-tu réécrire ?",
    }).catch(() => undefined);
    return;
  }
  // Hand the transcript to the same engine that handles text messages.
  // `replyInVoice: true` flips the handler into TTS mode: it generates
  // a Gemini voice note, uploads it to Meta, and sends it back. The
  // text version is still sent so the admin /conversations view shows
  // the conversation as words, not just audio links.
  await handleInboundTextMessage({
    fromPhone: a.from,
    body: `🎙️ ${transcript.text}`,
    messageId: a.messageId,
    replyInVoice: true,
    metaPhoneNumberId: a.metaPhoneNumberId,
  });
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
    select: {
      id: true,
      clinicId: true,
      startAt: true,
      patient: { select: { firstName: true } },
    },
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

  // Phase 11 — close the loop visually. Without an acknowledgement the
  // patient sees their button disappear and wonders if anything happened.
  // The day-of-week + HH:mm formatting is in French because that's the
  // default locale; AR/EN polish lives in a Phase 11.1 follow-up.
  const day = appt.startAt.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = `${String(appt.startAt.getHours()).padStart(2, "0")}h${String(
    appt.startAt.getMinutes(),
  ).padStart(2, "0")}`;
  await sendText({
    to: phone,
    body: `C'est noté, ${appt.patient.firstName} — votre RDV du ${day} à ${time} est confirmé 🎉\n\nÀ très vite.`,
  }).catch((err) => {
    console.error("[whatsapp:webhook] confirm ack failed", { phone, err });
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
    select: {
      id: true,
      clinicId: true,
      patient: { select: { firstName: true } },
    },
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

  // Phase 11 — invite the patient to write back. The bot then proposes
  // 3 alternative slots via the standard AI engine flow (Stage C).
  await sendText({
    to: phone,
    body: `Pas de souci ${appt.patient.firstName} — envoyez-moi vos disponibilités (ex. « jeudi matin ») et je vous propose de nouveaux créneaux 🙂`,
  }).catch((err) => {
    console.error("[whatsapp:webhook] reschedule ack failed", { phone, err });
  });
}
