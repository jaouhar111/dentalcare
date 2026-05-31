"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import type {
  CreateTicketInput,
  ReplyToTicketInput,
  SupportTicketDetail,
  SupportTicketListItem,
} from "./support-types";

const ANY_STAFF = [
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.RECEPTIONIST,
  UserRole.SUPER_ADMIN,
] as const;

/**
 * Schemas — zod-validated server-side. Subject is capped at the DB
 * VarChar(160) limit so an oversize input returns a usable error
 * instead of a 500.
 */
const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(5000),
  category: z.enum(SupportTicketCategory),
  priority: z.enum(SupportTicketPriority).optional(),
});

const replySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
  newStatus: z.enum(SupportTicketStatus).optional(),
});

/**
 * Cabinet user opens a new support thread. Any staff member can
 * create one — the SUPER_ADMIN is excluded since their own tickets
 * would need a different routing.
 *
 * The ticket is tagged with `clinicId = me.clinicId` so the
 * super-admin inbox can group by clinic and the cabinet only ever
 * sees its own tickets via `listMyTickets`.
 */
export async function createSupportTicket(
  raw: CreateTicketInput,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([
    UserRole.ADMIN,
    UserRole.DENTIST,
    UserRole.RECEPTIONIST,
  ]);
  const parsed = createTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Champs invalides", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const t = await db.supportTicket.create({
    data: {
      clinicId: me.clinicId,
      createdById: me.id,
      subject: data.subject,
      body: data.body,
      category: data.category,
      priority: data.priority ?? SupportTicketPriority.NORMAL,
      status: SupportTicketStatus.OPEN,
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });

  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "support.ticket.created",
    entity: "SupportTicket",
    entityId: t.id,
    payload: { category: data.category, priority: data.priority ?? "NORMAL" },
  });

  revalidatePath("/support");
  revalidatePath("/super-admin/support");
  return ok({ id: t.id });
}

/**
 * Lists tickets opened by the caller's clinic. Sorted by most-recent
 * activity so the bumped threads float to the top. Soft-cap at 100 —
 * cabinets with that many tickets should already have called us.
 */
export async function listMyTickets(): Promise<
  Result<SupportTicketListItem[]>
> {
  const me = await requireRole([...ANY_STAFF]);
  // SUPER_ADMIN doesn't belong to a clinic in the cabinet sense — if
  // they hit this route they get an empty list (their tools are
  // under /super-admin/support instead).
  if (me.role === UserRole.SUPER_ADMIN) return ok([]);

  const rows = await db.supportTicket.findMany({
    where: { clinicId: me.clinicId },
    orderBy: { lastActivityAt: "desc" },
    take: 100,
    select: {
      id: true,
      subject: true,
      status: true,
      category: true,
      priority: true,
      lastActivityAt: true,
      createdAt: true,
      createdBy: { select: { fullName: true } },
      _count: { select: { replies: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      status: r.status,
      category: r.category,
      priority: r.priority,
      lastActivityAt: r.lastActivityAt,
      createdAt: r.createdAt,
      createdByName: r.createdBy.fullName,
      replyCount: r._count.replies,
    })),
  );
}

/**
 * Full ticket detail. Permission gate:
 *   - SUPER_ADMIN sees any ticket.
 *   - Cabinet staff only see tickets owned by their own clinicId.
 */
export async function getTicketDetail(
  ticketId: string,
): Promise<Result<SupportTicketDetail>> {
  const me = await requireRole([...ANY_STAFF]);
  const t = await db.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      clinicId: true,
      subject: true,
      body: true,
      status: true,
      category: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      lastActivityAt: true,
      clinic: { select: { name: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          isFromSuperAdmin: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });
  if (!t) return fail("NOT_FOUND", "Ticket introuvable");
  if (me.role !== UserRole.SUPER_ADMIN && t.clinicId !== me.clinicId) {
    return fail("FORBIDDEN", "Accès refusé");
  }

  return ok({
    id: t.id,
    clinicId: t.clinicId,
    clinicName: t.clinic.name,
    subject: t.subject,
    body: t.body,
    status: t.status,
    category: t.category,
    priority: t.priority,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    lastActivityAt: t.lastActivityAt,
    createdBy: t.createdBy,
    replies: t.replies.map((r) => ({
      id: r.id,
      body: r.body,
      isFromSuperAdmin: r.isFromSuperAdmin,
      createdAt: r.createdAt,
      authorName: r.user.fullName,
    })),
  });
}

/**
 * Add a reply to an existing ticket. The reply's `isFromSuperAdmin`
 * flag is derived from the caller's role so the UI can style bubbles
 * correctly. Status transitions are:
 *   - cabinet reply → status = WAITING_USER → IN_PROGRESS (their turn
 *     now becomes the super-admin's)
 *   - super-admin reply → status = OPEN/WAITING_USER → IN_PROGRESS
 *     (their turn becomes the cabinet's)
 *   - explicit `newStatus` in args overrides the inferred transition
 *     (e.g. close-on-reply when super-admin marks RESOLVED inline).
 */
export async function replyToTicket(
  raw: ReplyToTicketInput,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ANY_STAFF]);
  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Réponse invalide", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const isSuperAdmin = me.role === UserRole.SUPER_ADMIN;

  const ticket = await db.supportTicket.findUnique({
    where: { id: data.ticketId },
    select: { id: true, clinicId: true, status: true },
  });
  if (!ticket) return fail("NOT_FOUND", "Ticket introuvable");
  if (!isSuperAdmin && ticket.clinicId !== me.clinicId) {
    return fail("FORBIDDEN", "Accès refusé");
  }

  // Infer next status if not explicitly provided.
  // After a super-admin reply, ball is in cabinet's court → WAITING_USER.
  // After a cabinet reply, ball is in super-admin's court → IN_PROGRESS.
  const inferredStatus = isSuperAdmin
    ? SupportTicketStatus.WAITING_USER
    : SupportTicketStatus.IN_PROGRESS;
  const nextStatus = data.newStatus ?? inferredStatus;
  const now = new Date();

  const reply = await db.$transaction(async (tx) => {
    const r = await tx.supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        userId: me.id,
        body: data.body,
        isFromSuperAdmin: isSuperAdmin,
      },
      select: { id: true },
    });
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        lastActivityAt: now,
        resolvedAt:
          nextStatus === SupportTicketStatus.RESOLVED ? now : null,
      },
    });
    return r;
  });

  await audit({
    clinicId: ticket.clinicId,
    userId: me.id,
    action: "support.ticket.replied",
    entity: "SupportTicket",
    entityId: ticket.id,
    payload: {
      from: ticket.status,
      to: nextStatus,
      bySuperAdmin: isSuperAdmin,
    },
  });

  revalidatePath(`/support/${ticket.id}`);
  revalidatePath(`/super-admin/support/${ticket.id}`);
  revalidatePath("/support");
  revalidatePath("/super-admin/support");
  return ok({ id: reply.id });
}

/**
 * Either side closes a ticket. Cabinet-side closes are common when
 * the user solves it themselves; super-admin closes after a successful
 * fix. Re-opening is implicit: any new reply bumps the status off
 * RESOLVED via `replyToTicket`.
 */
export async function resolveTicket(
  ticketId: string,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([...ANY_STAFF]);
  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, clinicId: true, status: true },
  });
  if (!ticket) return fail("NOT_FOUND", "Ticket introuvable");
  if (me.role !== UserRole.SUPER_ADMIN && ticket.clinicId !== me.clinicId) {
    return fail("FORBIDDEN", "Accès refusé");
  }
  if (ticket.status === SupportTicketStatus.RESOLVED) {
    return ok({ id: ticket.id });
  }

  const now = new Date();
  await db.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: SupportTicketStatus.RESOLVED,
      resolvedAt: now,
      lastActivityAt: now,
    },
  });
  await audit({
    clinicId: ticket.clinicId,
    userId: me.id,
    action: "support.ticket.resolved",
    entity: "SupportTicket",
    entityId: ticket.id,
    payload: { from: ticket.status },
  });

  revalidatePath(`/support/${ticket.id}`);
  revalidatePath(`/super-admin/support/${ticket.id}`);
  revalidatePath("/support");
  revalidatePath("/super-admin/support");
  return ok({ id: ticket.id });
}
