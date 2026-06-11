"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementLevel, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import type { ActiveAnnouncement } from "./super-admin-announcement-types";

/**
 * The single active platform announcement (or null). Read-only and not
 * role-gated: the dashboard layout calls it for every cabinet user to
 * render the banner. Non-sensitive (a maintenance / product notice).
 */
export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  return db.platformAnnouncement.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, level: true, createdAt: true },
  });
}

/**
 * Publish a new announcement (super-admin). Deactivates any previous
 * active one so only the latest shows. Audited.
 */
export async function publishAnnouncement(input: {
  message: string;
  level: AnnouncementLevel;
}): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const message = input.message?.trim() ?? "";
  if (message.length < 1 || message.length > 500) {
    return fail("INVALID", "Le message doit faire entre 1 et 500 caractères.");
  }
  const level: AnnouncementLevel =
    input.level === AnnouncementLevel.WARNING
      ? AnnouncementLevel.WARNING
      : AnnouncementLevel.INFO;

  await db.platformAnnouncement.updateMany({
    where: { active: true },
    data: { active: false },
  });
  const created = await db.platformAnnouncement.create({
    data: { message, level, createdById: me.id },
    select: { id: true },
  });
  await audit({
    clinicId: me.clinicId,
    userId: me.id,
    action: "superadmin.announcement.publish",
    entity: "PlatformAnnouncement",
    entityId: created.id,
    payload: { level, length: message.length },
  });
  revalidatePath("/super-admin/announcement");
  return ok({ id: created.id });
}

/** Retract the current announcement (deactivate all active). Audited. */
export async function clearAnnouncement(): Promise<Result<null>> {
  const me = await requireRole([UserRole.SUPER_ADMIN]);
  const res = await db.platformAnnouncement.updateMany({
    where: { active: true },
    data: { active: false },
  });
  if (res.count > 0) {
    await audit({
      clinicId: me.clinicId,
      userId: me.id,
      action: "superadmin.announcement.clear",
      entity: "PlatformAnnouncement",
      payload: { count: res.count },
    });
  }
  revalidatePath("/super-admin/announcement");
  return ok(null);
}
