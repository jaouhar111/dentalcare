"use server";

import { EventStatus, SubscriptionStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { ok, type Result } from "@/lib/utils/result";
import type { PlatformAlert } from "./super-admin-alerts-types";

/**
 * Derived "things that need attention right now" for the super-admin
 * dashboard — proactive visibility (roadmap P1-6 + P1-8) without a push
 * channel yet. Pure read; each signal maps to a deep link.
 *
 *   Health  : failed outbox jobs, WhatsApp disconnected (AI on, no
 *             session), AI send failures + webhook errors (24 h).
 *   Billing : cabinets PAST_DUE, expired trials not converted.
 */
export async function getPlatformAlerts(): Promise<Result<PlatformAlert[]>> {
  await requireRole([UserRole.SUPER_ADMIN]);
  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pastDue, expiredTrials, waDisconnected, sendFailures, webhookErrors, failedJobs] =
    await Promise.all([
      db.clinic.count({ where: { subscriptionStatus: SubscriptionStatus.PAST_DUE } }),
      db.clinic.count({
        where: { subscriptionStatus: SubscriptionStatus.TRIAL, trialEndsAt: { lt: now } },
      }),
      db.clinic.count({ where: { aiEnabled: true, openwaSessionId: null } }),
      db.auditLog.count({
        where: {
          action: { in: ["ai.conversation.send_failed", "ai.conversation.failed"] },
          createdAt: { gte: day1 },
        },
      }),
      db.auditLog.count({
        where: { action: "whatsapp.webhook.invalid_signature", createdAt: { gte: day1 } },
      }),
      db.eventOutbox.count({ where: { status: EventStatus.FAILED } }),
    ]);

  const s = (n: number) => (n > 1 ? "s" : "");
  const alerts: PlatformAlert[] = [];

  if (failedJobs > 0) {
    alerts.push({
      id: "failed_jobs",
      severity: "critical",
      category: "health",
      title: `${failedJobs} job${s(failedJobs)} en échec`,
      detail: "File d'événements (outbox) : dispatch épuisé, intervention requise.",
      href: "/super-admin/monitoring",
    });
  }
  if (pastDue > 0) {
    alerts.push({
      id: "past_due",
      severity: "critical",
      category: "billing",
      title: `${pastDue} cabinet${s(pastDue)} en impayé`,
      detail: "Paiement échoué — relancer le paiement ou suspendre l'accès.",
      href: "/super-admin/subscriptions",
    });
  }
  if (waDisconnected > 0) {
    alerts.push({
      id: "wa_disconnected",
      severity: "warning",
      category: "health",
      title: `${waDisconnected} cabinet${s(waDisconnected)} WhatsApp déconnecté`,
      detail: "IA activée mais aucune session WhatsApp liée — le bot ne répond pas.",
      href: "/super-admin/monitoring",
    });
  }
  if (sendFailures > 0) {
    alerts.push({
      id: "send_failures",
      severity: "warning",
      category: "health",
      title: `${sendFailures} échec${s(sendFailures)} d'envoi IA (24 h)`,
      detail: "Messages WhatsApp non délivrés.",
      href: "/super-admin/monitoring",
    });
  }
  if (webhookErrors > 0) {
    alerts.push({
      id: "webhook_errors",
      severity: "warning",
      category: "health",
      title: `${webhookErrors} erreur${s(webhookErrors)} webhook (24 h)`,
      detail: "Signatures WhatsApp invalides reçues.",
      href: "/super-admin/monitoring",
    });
  }
  if (expiredTrials > 0) {
    alerts.push({
      id: "expired_trials",
      severity: "warning",
      category: "billing",
      title: `${expiredTrials} essai${s(expiredTrials)} expiré${s(expiredTrials)}`,
      detail: "Période d'essai terminée sans conversion en plan payant.",
      href: "/super-admin/subscriptions",
    });
  }

  // Critical first.
  alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
  );
  return ok(alerts);
}
