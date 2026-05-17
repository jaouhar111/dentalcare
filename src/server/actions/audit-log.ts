"use server";

import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/utils/result";
import type { AuditLogListItem, AuditLogQuery, AuditLogPage } from "./audit-log-types";

/**
 * Paginated, filterable audit log listing — restricted to admins.
 *
 * The audit log is the legal record of all sensitive operations (patient
 * creation/deletion, invoice emission, GDPR exports, etc.). It must NEVER
 * be exposed to non-admins: dentists or receptionists could deduce
 * activity around other staff or patient identifiers.
 */
export async function listAuditLog(
  q: AuditLogQuery,
): Promise<Result<AuditLogPage>> {
  const session = await auth();
  if (!session?.user) return fail("UNAUTHORIZED", "Login required");
  if (session.user.role !== UserRole.ADMIN) {
    return fail("FORBIDDEN", "Admin role required");
  }

  const take = Math.min(Math.max(q.pageSize ?? 50, 1), 200);
  const skip = Math.max(q.offset ?? 0, 0);

  const where = {
    clinicId: session.user.clinicId,
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.action ? { action: { contains: q.action } } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.from || q.to
      ? {
          createdAt: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lt: new Date(q.to) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
  ]);

  // Hydrate userId → display name in a single query (avoid N+1).
  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)));
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const items: AuditLogListItem[] = rows.map((r) => {
    const user = r.userId ? userById.get(r.userId) ?? null : null;
    return {
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      createdAt: r.createdAt.toISOString(),
      payload: r.payloadJson,
      userName: user?.fullName ?? null,
      userEmail: user?.email ?? null,
    };
  });

  return ok({ items, total, offset: skip, pageSize: take });
}

/**
 * Returns a sorted list of distinct entity types present in the audit log
 * for the current clinic — fuels the filter dropdown.
 */
export async function listAuditEntities(): Promise<Result<string[]>> {
  const session = await auth();
  if (!session?.user) return fail("UNAUTHORIZED", "Login required");
  if (session.user.role !== UserRole.ADMIN) {
    return fail("FORBIDDEN", "Admin role required");
  }

  const rows = await db.auditLog.findMany({
    where: { clinicId: session.user.clinicId },
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });
  return ok(rows.map((r) => r.entity));
}
