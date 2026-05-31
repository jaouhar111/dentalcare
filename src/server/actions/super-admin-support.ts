"use server";

import { revalidatePath } from "next/cache";
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
import type { SupportTicketInboxItem } from "./support-types";

/** Filter knobs the super-admin inbox UI exposes. */
export interface InboxFilters {
  status?: SupportTicketStatus | "ALL";
  priority?: SupportTicketPriority | "ALL";
  category?: SupportTicketCategory | "ALL";
}

/**
 * Cross-tenant inbox for the super-admin. Default sort = priority desc
 * then last activity desc — URGENT bugs float to the top, then the
 * conversations that have been waiting longest.
 *
 * One round-trip; the include carries clinic name + logo for the row
 * avatar and the reply count for the "thread depth" hint badge.
 */
export async function listAllTickets(
  filters: InboxFilters = {},
): Promise<Result<SupportTicketInboxItem[]>> {
  await requireRole([UserRole.SUPER_ADMIN]);

  const where: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
  } = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.priority && filters.priority !== "ALL") where.priority = filters.priority;
  if (filters.category && filters.category !== "ALL") where.category = filters.category;

  const rows = await db.supportTicket.findMany({
    where,
    orderBy: [
      { priority: "desc" },
      { lastActivityAt: "desc" },
    ],
    take: 200,
    select: {
      id: true,
      subject: true,
      status: true,
      category: true,
      priority: true,
      lastActivityAt: true,
      createdAt: true,
      clinic: { select: { id: true, name: true, logoUrl: true } },
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
      clinicId: r.clinic.id,
      clinicName: r.clinic.name,
      clinicLogoUrl: r.clinic.logoUrl,
    })),
  );
}

/**
 * Counts grouped by status — drives the inbox tab pills
 * ("Ouverts (3) · En cours (1) · Résolus").
 */
export async function getInboxCounts(): Promise<
  Result<Record<SupportTicketStatus | "TOTAL", number>>
> {
  await requireRole([UserRole.SUPER_ADMIN]);
  const grouped = await db.supportTicket.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<SupportTicketStatus | "TOTAL", number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    WAITING_USER: 0,
    RESOLVED: 0,
    TOTAL: 0,
  };
  for (const g of grouped) {
    out[g.status] = g._count._all;
    out.TOTAL += g._count._all;
  }
  return ok(out);
}

/** Update priority — super-admin only. Used inline in the inbox row. */
export async function setTicketPriority(
  ticketId: string,
  priority: SupportTicketPriority,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const t = await db.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, clinicId: true, priority: true },
  });
  if (!t) return fail("NOT_FOUND", "Ticket introuvable");
  if (t.priority === priority) return ok({ id: t.id });

  await db.supportTicket.update({
    where: { id: t.id },
    data: { priority },
  });
  await audit({
    clinicId: t.clinicId,
    userId: me.id,
    action: "support.ticket.priority_changed",
    entity: "SupportTicket",
    entityId: t.id,
    payload: { from: t.priority, to: priority },
  });
  revalidatePath(`/super-admin/support/${t.id}`);
  revalidatePath("/super-admin/support");
  return ok({ id: t.id });
}

/** Hard status override — super-admin only. Used when the UI needs
 *  to reopen a RESOLVED ticket without a reply, or mark an OPEN one
 *  IN_PROGRESS without typing yet. */
export async function setTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const t = await db.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, clinicId: true, status: true },
  });
  if (!t) return fail("NOT_FOUND", "Ticket introuvable");
  if (t.status === status) return ok({ id: t.id });

  const now = new Date();
  await db.supportTicket.update({
    where: { id: t.id },
    data: {
      status,
      resolvedAt: status === SupportTicketStatus.RESOLVED ? now : null,
      lastActivityAt: now,
    },
  });
  await audit({
    clinicId: t.clinicId,
    userId: me.id,
    action: "support.ticket.status_changed",
    entity: "SupportTicket",
    entityId: t.id,
    payload: { from: t.status, to: status },
  });
  revalidatePath(`/super-admin/support/${t.id}`);
  revalidatePath("/super-admin/support");
  return ok({ id: t.id });
}
