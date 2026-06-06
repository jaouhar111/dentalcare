import { NextResponse, type NextRequest } from "next/server";
import {
  parseAudioMessages,
  parseOwnerOutboundMessages,
  parseTextMessages,
  sendText,
  verifyWebhookSignature,
} from "@/lib/whatsapp/client";
import {
  handleInboundTextMessage,
  handleOwnerOutboundMessage,
} from "@/lib/ai/webhook-handler";
import { transcribeAudio } from "@/lib/ai/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OpenWA → DentalCare webhook.
 *
 * One POST endpoint, no GET handshake (OpenWA does not need the Meta-
 * style `hub.challenge` verification). HMAC SHA-256 signed via
 * `X-OpenWA-Signature` using `OPENWA_WEBHOOK_SECRET`.
 *
 * Per inbound payload we route in this order:
 *   1. Owner-outbound (`fromMe: true`) → append to history + suppress AI
 *      for 30 min (Coexistence). Processed first so the suppression flag
 *      lands before any concurrent inbound from the same patient is
 *      evaluated.
 *   2. Inbound text → AI booking engine.
 *   3. Inbound voice/audio → transcribe → AI engine (with replyInVoice).
 *
 * Quick-reply buttons no longer exist (consumer WhatsApp doesn't render
 * them reliably via web.js). The AI engine handles free-text "oui",
 * "non", "reporter", etc. naturally.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-openwa-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  // Owner-mobile echoes — process first so suppression lands before
  // any concurrent inbound for the same patient is evaluated.
  const ownerOutbound = parseOwnerOutboundMessages(payload);
  for (const o of ownerOutbound) {
    await handleOwnerOutboundMessage({
      patientPhone: o.patientPhone,
      body: o.body,
      messageId: o.messageId,
      sentAt: o.sentAt,
      sessionId: o.sessionId,
    }).catch((err) => {
      console.error("[whatsapp:webhook] owner-outbound handler failed", {
        patient: o.patientPhone,
        err,
      });
    });
  }

  // Plain-text patient messages → AI booking engine. Sequential so two
  // rapid messages persist as a coherent history.
  const texts = parseTextMessages(payload);
  for (const t of texts) {
    await handleInboundTextMessage({
      fromPhone: t.from,
      body: t.body,
      messageId: t.messageId,
      sessionId: t.sessionId,
    }).catch((err) => {
      console.error("[whatsapp:webhook] AI handler failed", { from: t.from, err });
    });
  }

  // Voice notes — media comes inline as a base64 buffer (no separate
  // download hop like the Cloud API). Transcribe → feed into the same
  // engine as text with `replyInVoice: true`.
  const audios = parseAudioMessages(payload);
  for (const a of audios) {
    await handleInboundAudio({
      from: a.from,
      buffer: a.buffer,
      mimetype: a.mimetype,
      messageId: a.messageId,
      sessionId: a.sessionId,
    }).catch((err) => {
      console.error("[whatsapp:webhook] audio handler failed", { from: a.from, err });
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Voice-note pipeline. Same general shape as before but the buffer is
 * already in hand thanks to OpenWA's inline media delivery.
 */
async function handleInboundAudio(a: {
  from: string;
  buffer: Buffer;
  mimetype: string;
  messageId: string;
  sessionId: string;
}) {
  const transcript = await transcribeAudio({
    buffer: a.buffer,
    mimeType: a.mimetype,
  });
  if (!transcript.ok) {
    const apologyBody =
      transcript.error === "INAUDIBLE"
        ? "Je n'arrive pas à comprendre le vocal — il est peut-être trop court ou inaudible. Tu peux réessayer ou m'écrire en texte ?"
        : "Petit problème pour comprendre ton vocal — peux-tu réécrire ?";
    await sendText({ to: a.from, body: apologyBody, sessionId: a.sessionId }).catch(
      () => undefined,
    );
    return;
  }
  await handleInboundTextMessage({
    fromPhone: a.from,
    body: `🎙️ ${transcript.text}`,
    messageId: a.messageId,
    sessionId: a.sessionId,
    replyInVoice: true,
  });
}
