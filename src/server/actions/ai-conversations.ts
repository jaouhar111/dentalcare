"use server";

import { revalidatePath } from "next/cache";
import { Prisma, AIConversationStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  handOffConversation,
  markConversationRead,
  reactivateConversation,
} from "@/lib/ai/conversation";
import { sendText } from "@/lib/whatsapp/client";
import type { ChatMessage } from "@/lib/ai/types";
import type {
  AIConversationDetail,
  AIConversationListItem,
} from "./ai-conversations-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const CLINICIAN = [UserRole.ADMIN, UserRole.DENTIST] as const;

/**
 * List conversations for the current clinic, most-recent first. Pulls
 * the patient name + last message snippet inline so the sidebar UI can
 * render in one round-trip.
 *
 * Optional `status` filter narrows to ACTIVE / HANDED_OFF / CLOSED;
 * default returns all so the admin sees every thread.
 */
export async function listAIConversations(
  raw: { status?: AIConversationStatus; query?: string } = {},
): Promise<Result<AIConversationListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);

  const where: Prisma.AIConversationWhereInput = { clinicId: user.clinicId };
  if (raw.status) where.status = raw.status;
  if (raw.query && raw.query.trim().length > 0) {
    // Search across phone digits + patient name. We strip non-digit chars
    // from the query for the phone branch so "06 63" matches "+212663…".
    const q = raw.query.trim();
    const digits = q.replace(/\D/g, "");
    where.OR = [
      ...(digits.length >= 2
        ? [{ patientPhone: { contains: digits } as Prisma.StringFilter }]
        : []),
      {
        patient: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
          ],
        },
      },
    ];
  }

  const rows = await db.aIConversation.findMany({
    where,
    orderBy: { lastActivityAt: "desc" },
    take: 200,
    select: {
      id: true,
      patientPhone: true,
      patientId: true,
      status: true,
      totalTurns: true,
      totalTokens: true,
      lastActivityAt: true,
      lastInboundAt: true,
      lastReadAt: true,
      historyJson: true,
      patient: { select: { firstName: true, lastName: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      patientPhone: r.patientPhone,
      patientId: r.patientId,
      patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : null,
      status: r.status,
      totalTurns: r.totalTurns,
      totalTokens: r.totalTokens,
      lastActivityAt: r.lastActivityAt,
      lastSnippet: extractLastSnippet(r.historyJson),
      unread: isUnread(r.lastInboundAt, r.lastReadAt),
    })),
  );
}

/**
 * Total of *unread* conversations across the clinic — drives the
 * "Conversations IA" sidebar badge.
 *
 * Definition: ACTIVE or HANDED_OFF rows where `lastInboundAt > lastReadAt`
 * (or `lastReadAt IS NULL`). CLOSED rows never count — they're archives.
 *
 * Cheap query: indexed on `(clinicId, status)`, ~ms even at 10k rows.
 */
export async function getUnreadConversationsCount(): Promise<Result<number>> {
  const user = await requireRole([...ANY_STAFF]);

  // Prisma can't express `field > otherField` in a `where`, so we pull
  // the small candidate set (active + at least one inbound) and filter
  // in JS. Capped at 500 — at that scale we'd auto-close idle rows long
  // before the count itself becomes a perf concern.
  const candidates = await db.aIConversation.findMany({
    where: {
      clinicId: user.clinicId,
      status: { in: [AIConversationStatus.ACTIVE, AIConversationStatus.HANDED_OFF] },
      lastInboundAt: { not: null },
    },
    select: { lastInboundAt: true, lastReadAt: true },
    take: 500,
  });
  const unread = candidates.filter((r) => isUnread(r.lastInboundAt, r.lastReadAt)).length;
  return ok(unread);
}

/**
 * Detail view for a single conversation — full history + handover
 * metadata for the right-pane thread.
 */
export async function getAIConversation(
  id: string,
): Promise<Result<AIConversationDetail>> {
  const user = await requireRole([...ANY_STAFF]);

  const row = await db.aIConversation.findFirst({
    where: { id, clinicId: user.clinicId },
    select: {
      id: true,
      patientPhone: true,
      patientId: true,
      status: true,
      totalTurns: true,
      totalTokens: true,
      lastActivityAt: true,
      createdAt: true,
      handedOffAt: true,
      lastHumanReplyAt: true,
      historyJson: true,
      patient: { select: { firstName: true, lastName: true } },
      handedOffBy: { select: { fullName: true } },
    },
  });
  if (!row) return fail("NOT_FOUND", "Conversation introuvable");

  // Mark as read on view — fire-and-forget so we don't slow the page.
  void markConversationRead(row.id);

  return ok({
    id: row.id,
    patientPhone: row.patientPhone,
    patientId: row.patientId,
    patientName: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : null,
    status: row.status,
    totalTurns: row.totalTurns,
    totalTokens: row.totalTokens,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    handedOffAt: row.handedOffAt,
    handedOffByName: row.handedOffBy?.fullName ?? null,
    lastHumanReplyAt: row.lastHumanReplyAt,
    history: Array.isArray(row.historyJson) ? (row.historyJson as unknown as ChatMessage[]) : [],
  });
}

/**
 * Admin posts a manual reply inside a conversation. Only allowed when
 * the conversation is HANDED_OFF (the bot owns ACTIVE rows and we
 * don't want bot + human stepping on each other). The reply is sent
 * via WhatsApp + appended to the history as an `assistant` message
 * tagged `sentBy: admin:<userId>` so the UI can render it differently.
 */
export async function sendAdminReplyAction(args: {
  id: string;
  body: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const body = args.body.trim();
  if (body.length === 0) return fail("EMPTY", "Message vide");
  if (body.length > 2000) return fail("TOO_LONG", "Message trop long (max 2000 caractères)");

  const [row, clinic] = await Promise.all([
    db.aIConversation.findFirst({
      where: { id: args.id, clinicId: user.clinicId },
      select: { id: true, status: true, patientPhone: true, historyJson: true },
    }),
    db.clinic.findUnique({
      where: { id: user.clinicId },
      select: { openwaSessionId: true },
    }),
  ]);
  if (!row) return fail("NOT_FOUND", "Conversation introuvable");
  if (row.status !== AIConversationStatus.HANDED_OFF) {
    return fail(
      "NOT_HANDED_OFF",
      "Reprenez la main avant de répondre — sinon le bot répondra aussi.",
    );
  }

  // Append the message to history. We use `name = "admin:<userId>"` as a
  // marker the UI reads to render an admin avatar; the chat engine, which
  // never runs on HANDED_OFF rows, would still tolerate the extra field.
  const history: ChatMessage[] = Array.isArray(row.historyJson)
    ? (row.historyJson as unknown as ChatMessage[])
    : [];
  history.push({
    role: "assistant",
    content: body,
    name: `admin:${user.id}`,
  });

  await db.aIConversation.update({
    where: { id: row.id },
    data: {
      historyJson: history as unknown as Prisma.InputJsonValue,
      lastActivityAt: new Date(),
      totalTurns: { increment: 1 },
    },
  });

  const send = await sendText({
    to: row.patientPhone,
    body,
    sessionId: clinic?.openwaSessionId ?? null,
  });
  if (!send.ok) {
    return fail("SEND_FAILED", `Échec de l'envoi : ${send.error}`);
  }

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "ai.conversation.admin_reply",
    entity: "AIConversation",
    entityId: row.id,
    payload: { body, messageId: "messageId" in send ? send.messageId : null },
  });

  revalidatePath("/conversations");
  return ok({ id: row.id });
}

/**
 * Admin (or dentist) takes over the conversation — the bot stops
 * replying until `reactivateAIConversationAction` is called.
 */
export async function handoverAIConversationAction(
  id: string,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);

  const row = await db.aIConversation.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true },
  });
  if (!row) return fail("NOT_FOUND", "Conversation introuvable");
  if (row.status === AIConversationStatus.HANDED_OFF) {
    return ok({ id: row.id }); // already taken over — idempotent
  }

  await handOffConversation({ id: row.id, userId: user.id });
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "ai.conversation.handover",
    entity: "AIConversation",
    entityId: row.id,
    payload: { previousStatus: row.status },
  });

  revalidatePath("/conversations");
  return ok({ id: row.id });
}

/**
 * Hand the conversation back to the bot. Resets `handedOffAt` /
 * `handedOffById` so the audit trail of past handovers is reset to
 * NULL (the audit_log keeps the full history).
 */
export async function reactivateAIConversationAction(
  id: string,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...CLINICIAN]);

  const row = await db.aIConversation.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { id: true, status: true },
  });
  if (!row) return fail("NOT_FOUND", "Conversation introuvable");
  if (row.status === AIConversationStatus.ACTIVE) {
    return ok({ id: row.id });
  }

  await reactivateConversation(row.id);
  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "ai.conversation.reactivate",
    entity: "AIConversation",
    entityId: row.id,
    payload: { previousStatus: row.status },
  });

  revalidatePath("/conversations");
  return ok({ id: row.id });
}

// ────────────────────────────────────────────────────────────────────────

function isUnread(lastInboundAt: Date | null, lastReadAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  if (!lastReadAt) return true;
  return lastInboundAt.getTime() > lastReadAt.getTime();
}

function extractLastSnippet(historyJson: unknown): string {
  if (!Array.isArray(historyJson)) return "";
  const messages = historyJson as ChatMessage[];
  // Walk back from the end and pick the first user OR assistant text
  // (skip tool messages — they're noise in a sidebar preview).
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    if (m.role === "user" || m.role === "assistant") {
      const text = (m.content ?? "").trim();
      return text.length > 80 ? `${text.slice(0, 80)}…` : text;
    }
  }
  return "";
}
