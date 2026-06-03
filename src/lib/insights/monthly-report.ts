import { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { computeInsightsForReport } from "@/server/actions/insights";
import { renderMonthlyInsightsPdf } from "@/lib/pdf/monthly-insights-pdf";
import type { CabinetInsights } from "@/server/actions/insights";

/**
 * Phase 12 — Stage E
 *
 * Generates the monthly insights PDF for every active clinic and sends
 * it to the cabinet's primary admin email via Resend.
 *
 * Behavior :
 *   - Iterates every clinic with status ACTIVE or TRIAL
 *   - Computes insights for the previous calendar month
 *   - Renders the PDF
 *   - When `RESEND_API_KEY` is set → email it as an attachment
 *   - Otherwise → log the size + filename and skip (dev mode)
 *
 * The function is idempotent for the calendar month — re-running on the
 * same day won't double-send because we tag a `monthly_report.sent`
 * audit row with `period` and check it first.
 */

export async function sendMonthlyInsightsToAllClinics(args: {
  /// "2026-05" — calendar month covered by the report. Defaults to
  /// last completed month.
  periodKey?: string;
}): Promise<{ sent: number; skipped: number; errors: number }> {
  const period = args.periodKey ?? lastMonthKey();
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year!, (month ?? 1) - 1, 1);
  const to = new Date(year!, (month ?? 1) - 1 + 1, 1); // first of next month

  const clinics = await db.clinic.findMany({
    where: {
      subscriptionStatus: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      users: {
        where: { role: "ADMIN", isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, fullName: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const clinic of clinics) {
    try {
      // Idempotence — has a `monthly_report.sent` audit row for this
      // (clinicId, period) already? If so, skip.
      const existing = await db.auditLog.findFirst({
        where: {
          clinicId: clinic.id,
          action: "monthly_report.sent",
          payloadJson: { path: ["period"], equals: period },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      // Recipient — clinic.email overrides first admin's email.
      const to_email = clinic.email ?? clinic.users[0]?.email ?? null;
      if (!to_email) {
        console.warn("[monthly-report] no recipient email", {
          clinicId: clinic.id,
        });
        skipped += 1;
        continue;
      }

      // Compute insights with the session-less variant — this cron runs
      // as a platform task and doesn't have a user context.
      const periodLabel = new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString(
        "fr-FR",
        { month: "long", year: "numeric" },
      );
      const insightsData = await computeInsightsForReport(
        clinic.id,
        from,
        to,
        periodLabel,
      );

      const pdfBuffer = await renderMonthlyInsightsPdf({
        clinicName: clinic.name,
        insights: insightsData,
      });

      // ── Email via Resend (or dev fallback) ─────────────────────────
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        await sendViaResend({
          apiKey: resendKey,
          to: to_email,
          subject: `Votre AI Receptionist en ${insightsData.period.label}`,
          html: buildEmailHtml(
            insightsData,
            clinic.users[0]?.fullName ?? "Docteur",
          ),
          pdf: pdfBuffer,
          filename: `dentalcare-${period}.pdf`,
        });
      } else {
        console.log("[monthly-report] DEV mode (no RESEND_API_KEY)", {
          clinic: clinic.name,
          email: to_email,
          period,
          pdfBytes: pdfBuffer.length,
        });
      }

      await audit({
        clinicId: clinic.id,
        action: "monthly_report.sent",
        entity: "Clinic",
        entityId: clinic.id,
        payload: {
          period,
          recipient: to_email,
          pdfBytes: pdfBuffer.length,
          mode: resendKey ? "resend" : "dev_console",
        },
      });
      sent += 1;
    } catch (err) {
      console.error("[monthly-report] clinic failed", {
        clinicId: clinic.id,
        err,
      });
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}

/** Build a previous-month key like "2026-05". */
function lastMonthKey(): string {
  const now = new Date();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Minimal Resend HTTP call — no SDK, just fetch, so we don't bloat
 * the bundle. Resend API : https://resend.com/docs/api-reference
 */
async function sendViaResend(args: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  pdf: Buffer;
  filename: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env.RESEND_FROM_EMAIL ?? "noreply@dentalcare.ma",
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: [
        {
          filename: args.filename,
          content: args.pdf.toString("base64"),
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

function buildEmailHtml(
  insights: CabinetInsights,
  recipientName: string,
): string {
  const totals = insights.totals;
  return `
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; background: #fbfbfd; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 32px; box-shadow: 0 8px 24px -12px rgba(0,0,0,0.08);">
    <div style="font-size: 11px; color: #0066cc; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">DentalCare — Votre bot ce mois</div>
    <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 12px 0 6px;">${insights.period.label}</h1>
    <p style="color: #6e6e73; font-size: 14px; line-height: 1.55; margin: 0 0 18px;">
      Bonjour ${escapeHtml(recipientName)},<br/>
      voici ce que votre AI Receptionist a fait pour votre cabinet ce mois-ci.
      Le rapport complet est en pièce jointe.
    </p>
    <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
      <tr>
        <td style="background:#f5f5f7; border-radius:12px; padding:14px;">
          <div style="font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:1px;font-weight:600;">RDV pris par l&apos;IA</div>
          <div style="font-size:24px;font-weight:600;margin-top:4px;">${totals.appointmentsCreatedByAI}</div>
        </td>
        <td style="background:#f5f5f7; border-radius:12px; padding:14px;">
          <div style="font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Revenus IA</div>
          <div style="font-size:24px;font-weight:600;margin-top:4px;">${totals.revenueFromAI} MAD</div>
        </td>
      </tr>
      <tr>
        <td style="background:#f5f5f7; border-radius:12px; padding:14px;">
          <div style="font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Temps économisé</div>
          <div style="font-size:24px;font-weight:600;margin-top:4px;">${totals.timeSavedHours} h</div>
        </td>
        <td style="background:#f5f5f7; border-radius:12px; padding:14px;">
          <div style="font-size:10px;color:#6e6e73;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Hors horaires</div>
          <div style="font-size:24px;font-weight:600;margin-top:4px;">${totals.offHoursAppointments}</div>
        </td>
      </tr>
    </table>
    <p style="color: #6e6e73; font-size: 12px; line-height: 1.5; margin-top: 20px;">
      Téléchargez le rapport PDF complet (heatmap d&apos;activité + top questions) en pièce jointe.
    </p>
    <p style="color: #86868b; font-size: 11px; margin-top: 24px;">— L&apos;équipe DentalCare</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
