/**
 * Trial-expiring sweep — driven by the Inngest cron defined in
 * `src/lib/inngest.ts`. For every TRIAL clinic with `trialEndsAt` due
 * in 3, 1, or 0 days, email the first ADMIN user one nag per `daysLeft`
 * cohort. Idempotent : a re-run on the same calendar day finds the
 * audit row from the first run and skips, so a manual retry never
 * double-emails.
 */

import { SubscriptionStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sendTrialExpiringEmail } from "@/lib/email/send";

/// Days-before-trial-end thresholds we email on. Each tick is treated
/// as an independent cohort so the cron can skip ones already done.
const COHORTS = [3, 1, 0] as const;
type Cohort = (typeof COHORTS)[number];

export interface TrialExpiringSweepResult {
  scanned: number;
  emailed: number;
  skipped: number;
  errors: number;
}

export async function sendTrialExpiringSweep(): Promise<TrialExpiringSweepResult> {
  const now = new Date();
  // Start-of-day "today" in UTC — close enough since Casablanca is UTC+1
  // year-round and the cron fires at 09:00 local (08:00 UTC).
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Cohort windows — `trialEndsAt` between [today + d, today + d + 1 day).
  const windowFor = (d: Cohort) => {
    const start = new Date(today.getTime() + d * 86_400_000);
    const end = new Date(start.getTime() + 86_400_000);
    return { start, end };
  };

  const baseUrl = env.NEXTAUTH_URL ?? "https://app.dentalcare.ma";

  let scanned = 0;
  let emailed = 0;
  let skipped = 0;
  let errors = 0;

  for (const d of COHORTS) {
    const { start, end } = windowFor(d);
    const clinics = await db.clinic.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.TRIAL,
        trialEndsAt: { gte: start, lt: end },
      },
      select: { id: true, name: true, defaultLocale: true, trialEndsAt: true },
    });
    scanned += clinics.length;

    for (const c of clinics) {
      if (!c.trialEndsAt) {
        skipped++;
        continue;
      }
      // Idempotence — skip if we already sent this cohort to this clinic.
      const alreadySent = await db.auditLog.findFirst({
        where: {
          clinicId: c.id,
          action: "clinic.trial.email_sent",
          payloadJson: { path: ["daysLeft"], equals: d },
        },
        select: { id: true },
      });
      if (alreadySent) {
        skipped++;
        continue;
      }

      const admin = await db.user.findFirst({
        where: { clinicId: c.id, role: UserRole.ADMIN },
        select: { email: true, fullName: true },
        orderBy: { createdAt: "asc" },
      });
      if (!admin) {
        skipped++;
        continue;
      }

      const locale = c.defaultLocale === "en" ? "en" : "fr";
      const adminFirstName = admin.fullName?.split(" ")[0] ?? admin.fullName ?? "";
      const trialEndsAtLabel = c.trialEndsAt.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const sent = await sendTrialExpiringEmail({
        to: admin.email,
        adminFirstName,
        clinicName: c.name,
        daysLeft: d,
        trialEndsAtLabel,
        upgradeUrl: `${baseUrl}/${locale}/billing`,
      });

      if (!sent.ok) {
        errors++;
        continue;
      }

      await audit({
        clinicId: c.id,
        action: "clinic.trial.email_sent",
        entity: "Clinic",
        entityId: c.id,
        payload: {
          daysLeft: d,
          messageId: sent.data.id,
          trialEndsAt: c.trialEndsAt.toISOString(),
        },
      });
      emailed++;
    }
  }

  return { scanned, emailed, skipped, errors };
}
