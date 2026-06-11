/**
 * Daily platform-alerts digest — driven by the Inngest cron in
 * `src/lib/inngest.ts`. Computes the active alerts and, if any, emails a
 * digest to every SUPER_ADMIN. Idempotent per calendar day via an audit
 * row, so a manual retry never double-sends.
 *
 * This is the "push" half of roadmap P1-6 (the real-time dashboard panel
 * is the "pull" half). Real-time paging on critical events is a follow-up.
 */
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import { computePlatformAlerts } from "@/lib/platform/alerts";

export interface AlertsDigestResult {
  alerts: number;
  recipients: number;
  emailed: boolean;
  skipped?: string;
}

export async function sendPlatformAlertsDigest(): Promise<AlertsDigestResult> {
  const alerts = await computePlatformAlerts();
  if (alerts.length === 0) {
    return { alerts: 0, recipients: 0, emailed: false, skipped: "no-alerts" };
  }

  const superAdmins = await db.user.findMany({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { id: true, email: true, clinicId: true },
  });
  if (superAdmins.length === 0) {
    return { alerts: alerts.length, recipients: 0, emailed: false, skipped: "no-super-admin" };
  }

  // Idempotence — one digest per calendar day.
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const auditClinicId = superAdmins[0]!.clinicId;
  const already = await db.auditLog.findFirst({
    where: {
      clinicId: auditClinicId,
      action: "superadmin.alert.digest_sent",
      createdAt: { gte: startOfDay },
    },
    select: { id: true },
  });
  if (already) {
    return { alerts: alerts.length, recipients: superAdmins.length, emailed: false, skipped: "already-sent-today" };
  }

  const baseUrl = env.NEXTAUTH_URL ?? "https://app.dentalcare.ma";
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const rows = alerts
    .map((a) => {
      const color = a.severity === "critical" ? "#e11d48" : "#d97706";
      return `<tr>
        <td style="padding:8px 0;vertical-align:top;width:14px"><span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color}"></span></td>
        <td style="padding:8px 0">
          <div style="font-weight:600;color:#0f172a">${a.title}</div>
          <div style="color:#64748b;font-size:13px">${a.detail}</div>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:8px">
    <h2 style="color:#0f172a;font-size:18px">Alertes plateforme — DentalCare</h2>
    <p style="color:#475569;font-size:14px">${alerts.length} alerte(s)${critical > 0 ? ` · <strong style="color:#e11d48">${critical} critique(s)</strong>` : ""} au ${now.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin-top:16px">
      <a href="${baseUrl}/fr/super-admin" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Ouvrir le tableau de bord</a>
    </p>
  </div>`;

  const sent = await sendEmail({
    to: superAdmins.map((u) => u.email),
    subject: `${critical > 0 ? "⚠️ " : ""}DentalCare — ${alerts.length} alerte(s) plateforme`,
    html,
    tags: [{ name: "category", value: "platform-alerts" }],
  });
  if (!sent.ok) {
    return { alerts: alerts.length, recipients: superAdmins.length, emailed: false, skipped: "email-failed" };
  }

  await audit({
    clinicId: auditClinicId,
    action: "superadmin.alert.digest_sent",
    entity: "Platform",
    payload: { alerts: alerts.length, critical, messageId: sent.data.id },
  });

  return { alerts: alerts.length, recipients: superAdmins.length, emailed: true };
}
