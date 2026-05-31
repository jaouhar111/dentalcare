/**
 * Persistence layer for `AIConversation` — the rolling history of a
 * patient's WhatsApp thread with the booking bot.
 *
 * The webhook handler pattern is:
 *
 *     const convo = await loadOrCreateConversation({ clinicId, phone });
 *     const result = await runBookingConversation({ ...convo, userMessage });
 *     await persistConversationTurn({ id: convo.id, result });
 *
 * The split exists so the engine (pure, testable) doesn't know about the
 * DB at all — this module is the only place that touches Prisma for AI
 * history.
 *
 * History storage: stored as a plain JSON array of `ChatMessage` objects
 * (the system prompt is stripped before persistence — it gets rebuilt
 * fresh each turn so we can evolve the persona without rewriting rows).
 *
 * Status transitions:
 *   ACTIVE → HANDED_OFF   (admin clicks "Take over")
 *   ACTIVE → CLOSED       (auto by cron after N days idle)
 *   HANDED_OFF → ACTIVE   (admin clicks "Give back to bot")
 *
 * When status !== ACTIVE the webhook handler MUST NOT call the engine —
 * see `shouldAutoReply()` for the guard.
 */

import { AIConversationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import type { ChatMessage } from "./types";
import type { BookingConversationResult } from "./engine";

export interface ConversationRecord {
  id: string;
  clinicId: string;
  patientPhone: string;
  patientId: string | null;
  status: AIConversationStatus;
  history: ChatMessage[];
  totalTurns: number;
  totalTokens: number;
  lastInboundAt: Date | null;
  lastReadAt: Date | null;
}

export interface LoadConversationArgs {
  clinicId: string;
  patientPhone: string;
  /// If known, set on creation so the very first turn already has the
  /// patient bound (the webhook usually pre-resolves by phone match).
  patientId?: string | null;
}

/**
 * Find-or-create. Idempotent: the DB unique `(clinicId, patientPhone)`
 * guards against duplicates if two webhooks race on the same incoming
 * message (WhatsApp retries deliveries on 5xx).
 */
export async function loadOrCreateConversation({
  clinicId,
  patientPhone,
  patientId = null,
}: LoadConversationArgs): Promise<ConversationRecord> {
  const now = new Date();
  const row = await db.aIConversation.upsert({
    where: { clinicId_patientPhone: { clinicId, patientPhone } },
    create: {
      clinicId,
      patientPhone,
      patientId,
      historyJson: [],
      lastInboundAt: now,
    },
    update: {
      // On every load we touch lastActivityAt + lastInboundAt so the
      // "recent" sort + unread badge in the admin UI stay accurate.
      // This function is only called by the webhook handler — i.e.
      // "a patient just messaged us" — so bumping inbound is always
      // correct.
      lastActivityAt: now,
      lastInboundAt: now,
      // Backfill patientId if we now know it but didn't before.
      ...(patientId ? { patientId } : {}),
    },
  });
  return toRecord(row);
}

/**
 * Mark a conversation as read by an admin — clears the unread badge.
 * Idempotent: re-calling within the same second is a no-op for the UI.
 */
export async function markConversationRead(id: string): Promise<void> {
  await db.aIConversation.update({
    where: { id },
    data: { lastReadAt: new Date() },
  });
}

/** Quick read for the admin UI without touching `lastActivityAt`. */
export async function findConversation(
  clinicId: string,
  patientPhone: string,
): Promise<ConversationRecord | null> {
  const row = await db.aIConversation.findUnique({
    where: { clinicId_patientPhone: { clinicId, patientPhone } },
  });
  return row ? toRecord(row) : null;
}

/**
 * Persist the result of one engine turn — new history, token usage,
 * counters. Wrapped in a single `update` so concurrent webhooks for the
 * same conversation can't lose writes (Postgres row-locks the update).
 *
 * Note: the engine returns `messages` already stripped of the system
 * prompt (see `engine.ts:114`), so we store it verbatim.
 */
export async function persistConversationTurn({
  id,
  result,
}: {
  id: string;
  result: BookingConversationResult;
}): Promise<void> {
  await db.aIConversation.update({
    where: { id },
    data: {
      historyJson: result.messages as unknown as Prisma.InputJsonValue,
      totalTurns: { increment: 1 },
      totalTokens: { increment: result.totalTokens },
      lastActivityAt: new Date(),
    },
  });
}

/**
 * The webhook handler must NOT call the engine when status !== ACTIVE —
 * a HANDED_OFF conversation is owned by a human admin, and CLOSED is a
 * read-only archive. Returning false here lets the webhook drop the
 * inbound message silently (or notify the admin via the in-app inbox).
 */
export function shouldAutoReply(record: ConversationRecord): boolean {
  return record.status === AIConversationStatus.ACTIVE;
}

/**
 * Mark a conversation as handed over to a human. Idempotent — re-calling
 * with the same userId is a no-op.
 */
export async function handOffConversation({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  await db.aIConversation.update({
    where: { id },
    data: {
      status: AIConversationStatus.HANDED_OFF,
      handedOffAt: new Date(),
      handedOffById: userId,
    },
  });
}

/** Return ownership to the bot — clears handover metadata. */
export async function reactivateConversation(id: string): Promise<void> {
  await db.aIConversation.update({
    where: { id },
    data: {
      status: AIConversationStatus.ACTIVE,
      handedOffAt: null,
      handedOffById: null,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// internals
// ────────────────────────────────────────────────────────────────────────

type AIConversationRow = Awaited<
  ReturnType<typeof db.aIConversation.findFirstOrThrow>
>;

function toRecord(row: AIConversationRow): ConversationRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientPhone: row.patientPhone,
    patientId: row.patientId,
    status: row.status,
    history: (row.historyJson as unknown as ChatMessage[]) ?? [],
    totalTurns: row.totalTurns,
    totalTokens: row.totalTokens,
    lastInboundAt: row.lastInboundAt,
    lastReadAt: row.lastReadAt,
  };
}
