"use server";

import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { fail, ok, type Result } from "@/lib/utils/result";
import { revalidatePath } from "next/cache";
import {
  openwaCreateSession,
  openwaGetQr,
  openwaListSessions,
  openwaSessionStatus,
  openwaStartSession,
  type OpenWaSession,
} from "@/lib/whatsapp/client";
import type { OpenwaConnectionState } from "./openwa-session-types";

/**
 * Server actions powering the WhatsApp QR-onboarding panel in
 * `/settings/ai-receptionist`. Three calls keep the client component
 * dumb:
 *   - getOpenwaConnectionState     → initial + polled state
 *   - startOpenwaConnection        → create + start session, return QR
 *   - disconnectOpenwaConnection   → unbind from clinic (keeps the
 *                                    OpenWA session around so a re-link
 *                                    is cheap)
 *
 * All three are ADMIN-only (the clinic owner is the only person who
 * should bind/unbind WhatsApp).
 */

function mapStatus(s: OpenWaSession["status"]): OpenwaConnectionState["state"] {
  switch (s) {
    case "ready":
    case "authenticated":
      return "ready";
    case "qr_ready":
      return "awaiting_scan";
    case "created":
    case "initializing":
      return "connecting";
    case "failed":
    case "disconnected":
      return "failed";
    default:
      return "unknown";
  }
}

export async function getOpenwaConnectionState(): Promise<
  Result<OpenwaConnectionState>
> {
  const me = await requireRole([UserRole.ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: { openwaSessionId: true },
  });

  if (!clinic?.openwaSessionId) {
    return ok({
      state: "not_connected",
      sessionId: null,
      qrCode: null,
      phone: null,
      pushName: null,
      error: null,
    });
  }

  const [statusRes, qrRes] = await Promise.all([
    openwaSessionStatus(clinic.openwaSessionId),
    openwaGetQr(clinic.openwaSessionId),
  ]);

  if (!statusRes.ok) {
    return ok({
      state: "failed",
      sessionId: clinic.openwaSessionId,
      qrCode: null,
      phone: null,
      pushName: null,
      error: statusRes.error,
    });
  }

  const session = statusRes.session;
  return ok({
    state: mapStatus(session.status),
    sessionId: session.id,
    qrCode: qrRes.ok ? qrRes.qrCode : null,
    phone: session.phone ?? null,
    pushName: session.pushName ?? null,
    error: null,
  });
}

/**
 * Either claim an existing OpenWA session (when the clinic already has
 * one but it's been disconnected) OR create a fresh one and start it.
 * Idempotent: re-calling on a `ready` session is a no-op and just
 * returns the current state.
 */
export async function startOpenwaConnection(): Promise<
  Result<OpenwaConnectionState>
> {
  const me = await requireRole([UserRole.ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: { id: true, name: true, slug: true, openwaSessionId: true },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable");

  let sessionId = clinic.openwaSessionId;
  if (!sessionId) {
    // Use the slug so the OpenWA dashboard shows a human-readable name.
    // Fallback to the clinic id when the slug isn't set yet.
    const name = (clinic.slug ?? clinic.id).slice(0, 50);

    // Try create first. If the gateway rejects because the name is
    // already taken (orphan session from a previous failed attempt),
    // look it up by name and re-adopt it. Without this recovery the
    // clinic ends up in a stuck state where every retry returns
    // "name already in use" and the dentist can never connect.
    const created = await openwaCreateSession({ name });
    if (created.ok) {
      sessionId = created.session.id;
    } else {
      const listed = await openwaListSessions();
      if (!listed.ok) return fail("OPENWA_ERROR", listed.error);
      const orphan = listed.sessions.find((s) => s.name === name);
      if (!orphan) return fail("OPENWA_ERROR", created.error);
      sessionId = orphan.id;
    }

    await db.clinic.update({
      where: { id: clinic.id },
      data: { openwaSessionId: sessionId },
    });
    await audit({
      clinicId: clinic.id,
      userId: me.id,
      action: "openwa.session.created",
      entity: "Clinic",
      entityId: clinic.id,
      payload: { sessionId, name, adopted: !created.ok },
    });
  }

  // Always issue `start` — it's idempotent on the gateway side and
  // brings a disconnected session back to life without recreating it.
  const started = await openwaStartSession(sessionId);
  if (!started.ok) return fail("OPENWA_ERROR", started.error);

  revalidatePath("/settings/ai-receptionist");
  return getOpenwaConnectionState();
}

/**
 * Unlink the clinic from its OpenWA session. We do NOT stop the OpenWA
 * session itself — that lets the owner re-bind in one click if they
 * later regret unlinking. Cleaning up dangling OpenWA sessions is a
 * super-admin housekeeping concern.
 */
export async function disconnectOpenwaConnection(): Promise<Result<{ id: string }>> {
  const me = await requireRole([UserRole.ADMIN]);
  const clinic = await db.clinic.findUnique({
    where: { id: me.clinicId },
    select: { id: true, openwaSessionId: true },
  });
  if (!clinic) return fail("NOT_FOUND", "Cabinet introuvable");
  if (!clinic.openwaSessionId) {
    return ok({ id: clinic.id });
  }

  await db.clinic.update({
    where: { id: clinic.id },
    data: { openwaSessionId: null },
  });
  await audit({
    clinicId: clinic.id,
    userId: me.id,
    action: "openwa.session.unlinked",
    entity: "Clinic",
    entityId: clinic.id,
    payload: { previousSessionId: clinic.openwaSessionId },
  });

  revalidatePath("/settings/ai-receptionist");
  return ok({ id: clinic.id });
}
