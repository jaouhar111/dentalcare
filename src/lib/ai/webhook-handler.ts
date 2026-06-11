/**
 * Glue between the OpenWA webhook (HTTP layer) and the AI booking
 * engine (pure logic). Kept separate from the route file so we can
 * call it directly from scripts/tests without spinning up Next.js HTTP.
 *
 * Flow per inbound text message:
 *
 *     normalizePhone(from)
 *     resolveClinic(sessionId)           ← OpenWA session → clinic
 *     resolvePatientByPhone(clinic, phone)
 *     loadOrCreateConversation(...)
 *     if !shouldAutoReply → drop + log   ← human took over OR mobile
 *                                          coexistence suppression
 *     resolveBotUser(clinic)
 *     runBookingConversation({...})
 *     persistConversationTurn(...)
 *     audit("ai.conversation.turn", ...)
 *     sendText(to=phone, body=text, sessionId)
 */

import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { sendAudio, sendText } from "@/lib/whatsapp/client";
import { runBookingConversation } from "./engine";
import { buildDentalSystemPrompt } from "./prompts/dental";
import { synthesizeSpeech } from "./synthesize";
import {
  appendOwnerOutboundTurn,
  loadOrCreateConversation,
  persistConversationTurn,
  shouldAutoReply,
  type ConversationRecord,
} from "./conversation";

export interface InboundMessage {
  /// E.164-ish phone of the patient (the parser already normalised it
  /// to `+212XXX` from OpenWA's `212XXX@c.us` chatId).
  fromPhone: string;
  /// Plain text body. Voice-note callers prefix with `🎙️ `.
  body: string;
  /// OpenWA's wamid — included in audit logs for traceability.
  messageId: string;
  /// Set to `true` when the inbound was a voice note. The handler will
  /// then try to reply in voice too (TTS via Gemini).
  replyInVoice?: boolean;
  /// OpenWA session UUID. Drives the multi-tenant clinic lookup and is
  /// passed back to `sendText` so the reply leaves the correct WABA.
  sessionId: string;
}

export type HandleInboundResult =
  | { status: "replied"; conversationId: string; replyText: string; provider: string; tokens: number }
  | {
      status: "dropped";
      reason:
        | "no_clinic"
        | "handed_off"
        | "closed"
        | "empty_message"
        | "human_suppressed";
    }
  | { status: "error"; reason: string };

export async function handleInboundTextMessage(
  msg: InboundMessage,
): Promise<HandleInboundResult> {
  const trimmed = msg.body.trim();
  if (trimmed.length === 0) {
    return { status: "dropped", reason: "empty_message" };
  }
  const patientPhone = normalizePhone(msg.fromPhone);

  const clinic = await resolveClinic(msg.sessionId);
  if (!clinic) {
    return { status: "dropped", reason: "no_clinic" };
  }

  const patient = await db.patient.findFirst({
    where: { clinicId: clinic.id, phone: patientPhone, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  const conversation = await loadOrCreateConversation({
    clinicId: clinic.id,
    patientPhone,
    patientId: patient?.id ?? null,
  });

  // ─── AI Receptionist kill switch ────────────────────────────────────
  // When the cabinet has flipped `aiEnabled = false` in /settings/ai-
  // receptionist, the bot doesn't run at all. It replies "transferring
  // you" + auto-promotes the conversation to HANDED_OFF so the admin
  // UI shows it as needing human attention.
  // Plan gate — treat a Starter (or expired/canceled) clinic the same
  // as `aiEnabled = false` so a downgrade silently flips the bot off
  // without admin action.
  const { capabilitiesFor, featureOverridesOf } = await import("@/lib/billing/plan-capabilities");
  const caps = capabilitiesFor({
    plan: clinic.plan,
    subscriptionStatus: clinic.subscriptionStatus,
    featureOverrides: featureOverridesOf(clinic),
  });
  const aiAllowedByPlan = caps.aiReceptionist;

  if ((!clinic.aiEnabled || !aiAllowedByPlan) && conversation.status !== "HANDED_OFF") {
    const handoffText =
      "Un instant, je transfère votre message à un membre du cabinet 🙏";
    const sent = await sendText({
      to: patientPhone,
      body: handoffText,
      sessionId: msg.sessionId,
    });
    await db.aIConversation.update({
      where: { id: conversation.id },
      data: {
        status: "HANDED_OFF",
        handedOffAt: new Date(),
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
    const isHumanSuppressed =
      conversation.status === "ACTIVE" && !!conversation.lastHumanReplyAt;
    const reason: "handed_off" | "closed" | "human_suppressed" =
      conversation.status === "HANDED_OFF"
        ? "handed_off"
        : isHumanSuppressed
          ? "human_suppressed"
          : "closed";
    await audit({
      clinicId: clinic.id,
      action: "ai.conversation.dropped",
      entity: "AIConversation",
      entityId: conversation.id,
      payload: {
        reason,
        messageId: msg.messageId,
        body: trimmed,
        lastHumanReplyAt: conversation.lastHumanReplyAt?.toISOString() ?? null,
      },
    });
    return { status: "dropped", reason };
  }

  // Bot identity for create_appointment audit attribution.
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

    // Voice-note round-trip: synthesise TTS, send via send-audio. The
    // text version is sent too so the admin UI sees the words, not just
    // a media link.
    let voiceDelivered = false;
    // Voice-note replies are a Cabinet+ feature. Below that plan the
    // user gets the text-only reply (we still transcribed their note so
    // the AI could read it, just won't TTS-reply).
    if (msg.replyInVoice && caps.voiceNotes) {
      const tts = await synthesizeSpeech({ text: stripEmojis(result.text) });
      if (tts.ok) {
        const audio = await sendAudio({
          to: patientPhone,
          sessionId: msg.sessionId,
          buffer: tts.buffer,
          mimetype: tts.mimeType,
          filename: "reply.ogg",
        });
        if (audio.ok) voiceDelivered = true;
        else console.error("[ai/webhook] sendAudio failed", { err: audio.error });
      } else {
        console.error("[ai/webhook] synthesizeSpeech failed", { err: tts.error });
      }
    }

    const send = await sendText({
      to: patientPhone,
      body: result.text,
      sessionId: msg.sessionId,
    });
    if (!send.ok && !voiceDelivered) {
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
        payload: { to: patientPhone, replyText: result.text, error: send.error },
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
    await sendText({
      to: patientPhone,
      body: "Désolé, un problème technique m'empêche de répondre. Le cabinet vous rappellera.",
      sessionId: msg.sessionId,
    }).catch(() => undefined);
    return { status: "error", reason: message };
  }
}

/**
 * Coexistence-style sync — called when the cabinet owner writes from
 * their mobile WhatsApp app (OpenWA echoes outbound messages back via
 * `fromMe: true`). Appends the dentist's bubble to the conversation
 * history, stamps `lastHumanReplyAt`, and the suppression window kicks
 * in for the next 30 min.
 */
export async function handleOwnerOutboundMessage(args: {
  patientPhone: string;
  body: string;
  messageId: string;
  sentAt: Date;
  sessionId: string;
}): Promise<
  | { status: "appended"; conversationId: string }
  | { status: "skipped"; reason: "no_clinic" | "no_conversation" | "duplicate" }
> {
  const trimmed = args.body.trim();
  if (trimmed.length === 0) {
    return { status: "skipped", reason: "duplicate" };
  }
  const patientPhone = normalizePhone(args.patientPhone);
  const clinic = await resolveClinic(args.sessionId);
  if (!clinic) {
    return { status: "skipped", reason: "no_clinic" };
  }

  // Only attach to a conversation that already exists. If the dentist
  // is messaging a patient that never wrote to the bot before, there's
  // nothing to attach to and we drop silently.
  const existing = await db.aIConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId: clinic.id, patientPhone } },
    select: { id: true },
  });
  if (!existing) {
    return { status: "skipped", reason: "no_conversation" };
  }

  const { duplicate } = await appendOwnerOutboundTurn({
    id: existing.id,
    text: trimmed,
    sentAt: args.sentAt,
    messageId: args.messageId,
  });
  if (duplicate) return { status: "skipped", reason: "duplicate" };

  await audit({
    clinicId: clinic.id,
    action: "ai.conversation.owner_reply",
    entity: "AIConversation",
    entityId: existing.id,
    payload: {
      messageId: args.messageId,
      body: trimmed,
      sentAt: args.sentAt.toISOString(),
    },
  });

  return { status: "appended", conversationId: existing.id };
}

// ────────────────────────────────────────────────────────────────────────

function stripEmojis(s: string): string {
  return s
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️‍]/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Normalise the patient identifier we got from the webhook.
 *
 *   `+212638256271`        → unchanged (E.164 phone)
 *   `+lid_278017930723384` → unchanged (LID opaque identifier)
 *   `212638256271`         → `+212638256271`
 *
 * LID identifiers must be preserved as-is so the round-trip back to
 * OpenWA's chatId (handled by `toChatId` in the client) lands on the
 * right contact. Stripping the `lid_` prefix would silently mutate the
 * patient identity and break replies.
 */
function normalizePhone(raw: string): string {
  if (raw.startsWith("+lid_")) return raw;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Multi-tenant clinic resolution by OpenWA sessionId.
 *
 *   1. If sessionId provided, look up `Clinic.openwaSessionId`. Prod path.
 *   2. Otherwise (dev single-tenant), return the first clinic. Lets
 *      local testing without a real session id still work via the
 *      console-mock client.
 *
 * Returns null when there's no matching clinic — the route drops the
 * message with `reason: "no_clinic"` so we don't cross-tenant.
 */
async function resolveClinic(
  sessionId?: string | null,
): Promise<{
  id: string;
  name: string;
  aiEnabled: boolean;
  aiStyle: import("@prisma/client").AIReceptionistStyle;
  aiSignature: string | null;
  aiTemplatesJson: unknown;
  plan: import("@prisma/client").SubscriptionPlan;
  subscriptionStatus: import("@prisma/client").SubscriptionStatus;
  featureAiReceptionist: boolean | null;
  featureVoiceNotes: boolean | null;
  featureRecalls: boolean | null;
  featurePaymentPlans: boolean | null;
} | null> {
  const select = {
    id: true,
    name: true,
    aiEnabled: true,
    aiStyle: true,
    aiSignature: true,
    aiTemplatesJson: true,
    plan: true,
    subscriptionStatus: true,
    featureAiReceptionist: true,
    featureVoiceNotes: true,
    featureRecalls: true,
    featurePaymentPlans: true,
  } as const;
  if (sessionId) {
    const bySession = await db.clinic.findUnique({
      where: { openwaSessionId: sessionId },
      select,
    });
    if (bySession) return bySession;
    const count = await db.clinic.count();
    if (count === 1) return db.clinic.findFirst({ select });
    return null;
  }
  return db.clinic.findFirst({ select });
}

export type { ConversationRecord };
