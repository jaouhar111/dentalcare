/**
 * Glue between the Meta webhook (HTTP layer) and the AI engine
 * (pure logic). Kept separate from the route file so we can call it
 * directly from scripts/tests without spinning up Next.js HTTP.
 *
 * Flow per inbound text message:
 *
 *     normalizePhone(from)
 *     resolveClinic()                    ← multi-clinic TODO
 *     resolvePatientByPhone(clinic, phone)
 *     loadOrCreateConversation(...)
 *     if !shouldAutoReply → drop + log   ← human took over
 *     resolveBotUser(clinic)             ← createdBy for create_appointment
 *     runBookingConversation({...})
 *     persistConversationTurn(...)
 *     audit("ai.conversation.turn", ...)
 *     sendText(to=phone, body=text)      ← cabinet-side reply
 *
 * Returns a structured result so the route can log + the tests can
 * assert without parsing logs.
 */

import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendAudio, sendText, uploadMedia } from "@/lib/whatsapp/client";
import { runBookingConversation } from "./engine";
import { buildDentalSystemPrompt } from "./prompts/dental";
import { synthesizeSpeech } from "./synthesize";
import {
  loadOrCreateConversation,
  persistConversationTurn,
  shouldAutoReply,
  type ConversationRecord,
} from "./conversation";

export interface InboundMessage {
  /// Raw `from` field from Meta (no leading `+`, e.g. "212638256271").
  fromPhone: string;
  /// Plain-text body the patient typed. For voice notes, this is the
  /// Gemini transcript with a `🎙️ ` prefix added by the caller.
  body: string;
  /// Meta's message id — included in audit logs for traceability.
  messageId: string;
  /// Set to `true` when the inbound message was a voice note — the
  /// handler will then try to reply in voice instead of text.
  replyInVoice?: boolean;
  /// Meta's `metadata.phone_number_id` from the webhook payload — used
  /// to route to the right clinic when the deployment is shared by
  /// multiple cabinets. Falls back to the first clinic if absent or
  /// not bound.
  metaPhoneNumberId?: string | null;
}

export type HandleInboundResult =
  | { status: "replied"; conversationId: string; replyText: string; provider: string; tokens: number }
  | { status: "dropped"; reason: "no_clinic" | "handed_off" | "closed" | "empty_message" }
  | { status: "error"; reason: string };

/**
 * The single entry point the webhook route calls. Side-effectful
 * (writes the AIConversation row, audits, posts to Meta) so callers
 * shouldn't retry on `replied` results — Meta auto-retries on non-2xx,
 * and we ack 200 once the engine succeeds.
 */
export async function handleInboundTextMessage(
  msg: InboundMessage,
): Promise<HandleInboundResult> {
  const trimmed = msg.body.trim();
  if (trimmed.length === 0) {
    return { status: "dropped", reason: "empty_message" };
  }
  const patientPhone = normalizePhone(msg.fromPhone);

  const clinic = await resolveClinic(msg.metaPhoneNumberId);
  if (!clinic) {
    return { status: "dropped", reason: "no_clinic" };
  }

  // Phone-based patient lookup. Null is fine — the engine handles the
  // "you don't know me yet" flow via the `create_appointment` tool's
  // PATIENT_NOT_REGISTERED branch. We also pull firstName + lastName
  // so the system prompt can personalize the greeting.
  const patient = await db.patient.findFirst({
    where: { clinicId: clinic.id, phone: patientPhone, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  const conversation = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone,
    patientId: patient?.id ?? null,
  });

  // ─── AI Receptionist kill switch (Phase 10) ────────────────────────
  // When the cabinet has flipped `aiEnabled = false` in /settings/ai-
  // receptionist, the bot doesn't run the engine at all. It replies
  // with a "transferring you" message AND auto-promotes the
  // conversation to HANDED_OFF so the admin UI shows it as needing
  // human attention right away. Subsequent inbound messages will hit
  // the `!shouldAutoReply` branch below and stay silent until the
  // admin re-takes or re-enables.
  if (!clinic.aiEnabled && conversation.status !== "HANDED_OFF") {
    const handoffText =
      "Un instant, je transfère votre message à un membre du cabinet 🙏";
    const sent = await sendText({ to: "+" + patientPhone, body: handoffText });
    await db.aIConversation.update({
      where: { id: conversation.id },
      data: {
        status: "HANDED_OFF",
        handedOffAt: new Date(),
        // handedOffById left null — there's no specific user, the bot
        // self-handed-off because it was turned off platform-wide.
        lastActivityAt: new Date(),
      },
    });
    await audit({
      clinicId: clinic.id,
      action: "ai.conversation.disabled_handoff",
      entity: "AIConversation",
      entityId: conversation.id,
      payload: { messageId: msg.messageId, body: trimmed, sent: sent.ok },
    });
    return {
      status: "replied",
      conversationId: conversation.id,
      replyText: handoffText,
      provider: "ai_disabled",
      tokens: 0,
    };
  }

  if (!shouldAutoReply(conversation)) {
    // Don't reply when an admin owns the conversation. We still audit
    // the message so it shows up in the admin's inbox (future UI).
    await audit({
      clinicId: clinic.id,
      action: "ai.conversation.dropped",
      entity: "AIConversation",
      entityId: conversation.id,
      payload: { reason: conversation.status, messageId: msg.messageId, body: trimmed },
    });
    return {
      status: "dropped",
      reason: conversation.status === "HANDED_OFF" ? "handed_off" : "closed",
    };
  }

  // Need an admin user id to attribute create_appointment calls to.
  // First admin acts as the "AI bot" actor — a future iteration can
  // seed a dedicated AI_BOT role.
  const botUser = await db.user.findFirst({
    where: { clinicId: clinic.id, role: "ADMIN" },
    select: { id: true },
  });

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const systemPrompt = buildDentalSystemPrompt({
    clinicName: clinic.name,
    todayIso,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
    patientFirstName: patient?.firstName ?? null,
    // Phase 10 — cabinet-specific tone, signature, and preferred phrasing.
    // `aiTemplatesJson` is `Json?` in Prisma; cast to AITemplates shape
    // (the settings page validates the structure via Zod on write).
    style: clinic.aiStyle,
    signature: clinic.aiSignature,
    templates: (clinic.aiTemplatesJson ?? null) as
      | import("@/server/actions/ai-receptionist-types").AITemplates
      | null,
  });

  try {
    const result = await runBookingConversation({
      context: {
        clinicId: clinic.id,
        patientId: conversation.patientId ?? undefined,
        patientPhone,
        userId: botUser?.id,
      },
      systemPrompt,
      history: conversation.history,
      userMessage: trimmed,
    });

    await persistConversationTurn({ id: conversation.id, result });

    await audit({
      clinicId: clinic.id,
      action: "ai.conversation.turn",
      entity: "AIConversation",
      entityId: conversation.id,
      payload: {
        inboundMessageId: msg.messageId,
        userMessage: trimmed,
        replyText: result.text,
        provider: result.provider,
        tokens: result.totalTokens,
        toolRuns: result.toolRuns.map((r) => ({
          tool: r.toolName,
          ok: !r.validationError && !r.runtimeError,
        })),
      },
    });

    // If the patient sent a voice note, reply with a voice note too —
    // mirrors the modality the patient picked. We always send the text
    // as a fallback or alongside so admins viewing the conversation in
    // the dashboard see the words, not just a media reference.
    let voiceDelivered = false;
    if (msg.replyInVoice) {
      const tts = await synthesizeSpeech({ text: stripEmojis(result.text) });
      if (tts.ok) {
        const upload = await uploadMedia({
          buffer: tts.buffer,
          mimeType: tts.mimeType,
          filename: "reply.wav",
        });
        if (upload.ok) {
          const audio = await sendAudio({ to: patientPhone, mediaId: upload.mediaId });
          if (audio.ok) {
            voiceDelivered = true;
          } else {
            console.error("[ai/webhook] sendAudio failed", { err: audio.error });
          }
        } else {
          console.error("[ai/webhook] uploadMedia failed", { err: upload.error });
        }
      } else {
        console.error("[ai/webhook] synthesizeSpeech failed", { err: tts.error });
      }
    }

    const send = await sendText({ to: patientPhone, body: result.text });
    if (!send.ok && !voiceDelivered) {
      // Surface delivery failures in the audit log so admins can see
      // *which* patients aren't getting bot replies (typically: phone
      // not in Meta's allowed test list while the app is in dev mode,
      // or 24h customer-service window closed). Without this trace the
      // bot looks like it's silently dropping replies.
      console.error("[ai/webhook] sendText failed", {
        conversationId: conversation.id,
        to: patientPhone,
        err: send.error,
      });
      await audit({
        clinicId: clinic.id,
        action: "ai.conversation.send_failed",
        entity: "AIConversation",
        entityId: conversation.id,
        payload: {
          to: patientPhone,
          replyText: result.text,
          error: send.error,
        },
      });
    }

    return {
      status: "replied",
      conversationId: conversation.id,
      replyText: result.text,
      provider: result.provider,
      tokens: result.totalTokens,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/webhook] engine crashed", { conversationId: conversation.id, err: message });
    await audit({
      clinicId: clinic.id,
      action: "ai.conversation.error",
      entity: "AIConversation",
      entityId: conversation.id,
      payload: { messageId: msg.messageId, error: message },
    });
    // Best-effort apology so the patient doesn't think we ghosted them.
    await sendText({
      to: patientPhone,
      body: "Désolé, un problème technique m'empêche de répondre. Le cabinet vous rappellera.",
    }).catch(() => undefined);
    return { status: "error", reason: message };
  }
}

// ────────────────────────────────────────────────────────────────────────

/**
 * Strips emojis + ornamental Unicode for TTS — Gemini TTS pronounces
 * them literally ("smiley face hand wave") which sounds ridiculous in a
 * voice note. We keep ASCII + Latin extended + Arabic.
 */
function stripEmojis(s: string): string {
  // Emoji ranges + dingbats + variation selectors + skin-tone modifiers.
  return s
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️‍]/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Meta sends `212638256271`; we store `+212638256271`. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Multi-tenant clinic resolution.
 *
 *  1. If Meta provided `metadata.phone_number_id`, look up the clinic
 *     bound to it via `Clinic.whatsappPhoneId`. This is the prod path.
 *  2. Otherwise (legacy single-tenant dev), grab the first clinic so
 *     local testing without a `whatsappPhoneId` configuration still
 *     works.
 *
 * Returns null when there is genuinely no matching clinic — the
 * webhook handler drops the message with `reason: "no_clinic"` so
 * we don't accidentally cross-tenant a message.
 */
async function resolveClinic(
  metaPhoneNumberId?: string | null,
): Promise<{
  id: string;
  name: string;
  aiEnabled: boolean;
  aiStyle: import("@prisma/client").AIReceptionistStyle;
  aiSignature: string | null;
  aiTemplatesJson: unknown;
} | null> {
  const select = {
    id: true,
    name: true,
    aiEnabled: true,
    aiStyle: true,
    aiSignature: true,
    aiTemplatesJson: true,
  } as const;
  if (metaPhoneNumberId) {
    const byPhone = await db.clinic.findUnique({
      where: { whatsappPhoneId: metaPhoneNumberId },
      select,
    });
    if (byPhone) return byPhone;
    // No clinic claimed this phone yet — fall back to the first one
    // only when there's exactly one (single-tenant dev). In a
    // multi-tenant deployment this path returns null on purpose.
    const count = await db.clinic.count();
    if (count === 1) {
      return db.clinic.findFirst({ select });
    }
    return null;
  }
  return db.clinic.findFirst({ select });
}

/**
 * Returns a snapshot of the conversation as it exists right now — used
 * by the admin UI to render the live history without re-running the
 * engine. Re-exporting here so the route can call into a single module.
 */
export type { ConversationRecord };
