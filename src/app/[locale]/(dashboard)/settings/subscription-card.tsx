import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { planLabel } from "@/lib/billing/plan-capabilities";
import { planPricePartsFr } from "@/lib/billing/plan-pricing";

/**
 * Subscription card displayed at the top of the cabinet's
 * /settings page. Shows:
 *   - Current plan (Starter / Pro / Cabinet+) with monthly price
 *   - Status badge (TRIAL / ACTIVE / PAST_DUE / CANCELLED)
 *   - For TRIAL: visual countdown bar + days remaining + nudge CTA
 *   - For PAST_DUE: action-required warning
 *   - For CANCELLED: contact-support nudge
 *
 * Read-only — the cabinet itself doesn't switch plans (that's
 * SUPER_ADMIN's job from /super-admin/clinics/[id]). The CTA links
 * to the public pricing page so the owner can see what's on each
 * plan before contacting support.
 */

export function SubscriptionCard({
  status,
  plan,
  trialEndsAt,
  createdAt,
  locale,
}: {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialEndsAt: Date | null;
  createdAt: Date;
  locale: string;
}) {
  const planMeta = { name: planLabel(plan), ...planPricePartsFr(plan) };
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // For the TRIAL progress bar — we assume the trial started at
  // `createdAt` (signup flow sets trialEndsAt = createdAt + 14 days).
  let trialDaysRemaining: number | null = null;
  let trialProgressPct = 0;
  if (status === SubscriptionStatus.TRIAL && trialEndsAt) {
    const ms = trialEndsAt.getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(ms / 86_400_000));
    const totalMs = trialEndsAt.getTime() - createdAt.getTime();
    const elapsedMs = Date.now() - createdAt.getTime();
    trialProgressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  }

  const urgent = trialDaysRemaining !== null && trialDaysRemaining <= 3;

  return (
    <div className="border-border/60 bg-card mb-6 overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)]">
      {/* ── Header row: plan + price + status ─────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <div
            className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
            style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
              Plan {planMeta.name}
            </div>
            <div className="text-foreground mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[28px] leading-none font-bold tracking-tight tabular-nums">
                {planMeta.amount}
              </span>
              <span className="text-muted-foreground text-[12px]">{planMeta.suffix}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={status} urgent={urgent} />
      </div>

      {/* ── Body: per-status messaging ────────────────────── */}
      {status === SubscriptionStatus.TRIAL ? (
        <div className="border-t border-black/[0.05] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-foreground text-[15px] font-semibold">
              {trialDaysRemaining === null
                ? "Période d'essai active"
                : trialDaysRemaining === 0
                  ? "Dernier jour d'essai"
                  : trialDaysRemaining === 1
                    ? "1 jour restant"
                    : `${trialDaysRemaining} jours restants`}
            </div>
            {trialEndsAt ? (
              <div className="text-muted-foreground text-[12px]">
                Fin : {dateFmt.format(trialEndsAt)}
              </div>
            ) : null}
          </div>

          {/* Countdown progress bar */}
          <div className="bg-muted/60 mt-3 h-2 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${trialProgressPct}%`,
                background: urgent
                  ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                  : "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
              }}
            />
          </div>

          <p className="text-muted-foreground mt-3 text-[12px] leading-[1.5]">
            {urgent
              ? "Votre essai se termine bientôt. Contactez votre administrateur pour activer un plan payant et éviter l'interruption."
              : "Profitez de toutes les fonctionnalités pendant votre essai gratuit. Aucune carte requise."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="mailto:support@dentalcare.ma?subject=Activer%20mon%20abonnement"
              className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-opacity hover:opacity-90"
            >
              Souscrire un plan
            </a>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground text-[12px] font-medium transition-colors"
            >
              Voir les tarifs ›
            </a>
          </div>
        </div>
      ) : status === SubscriptionStatus.ACTIVE ? (
        <div className="border-t border-emerald-500/15 bg-emerald-500/[0.04] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <div className="text-foreground text-[14px] font-semibold">
                Abonnement actif
              </div>
              <p className="text-muted-foreground mt-0.5 text-[12px] leading-[1.5]">
                Toutes les fonctionnalités du plan {planMeta.name} sont débloquées.
              </p>
            </div>
          </div>
        </div>
      ) : status === SubscriptionStatus.PAST_DUE ? (
        <div className="border-t border-red-500/20 bg-red-500/[0.05] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm0 6v6m0 3v.01" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
              </svg>
            </span>
            <div>
              <div className="text-red-800 text-[14px] font-semibold dark:text-red-200">
                Paiement échoué — action requise
              </div>
              <p className="text-red-700/80 mt-0.5 text-[12px] leading-[1.5] dark:text-red-200/80">
                Mettez à jour vos informations de paiement pour rétablir l&apos;accès complet à votre cabinet.
              </p>
              <a
                href="mailto:support@dentalcare.ma?subject=Paiement%20%C3%A9chou%C3%A9"
                className="mt-3 inline-flex items-center text-[12px] font-semibold text-red-800 underline underline-offset-2 dark:text-red-200"
              >
                Contacter le support
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border-t border-black/[0.05] p-5">
          <div className="text-foreground text-[14px] font-semibold">Abonnement annulé</div>
          <p className="text-muted-foreground mt-0.5 text-[12px] leading-[1.5]">
            Votre cabinet est en accès restreint. Pour réactiver, contactez le support.
          </p>
          <a
            href="mailto:support@dentalcare.ma?subject=R%C3%A9activer%20mon%20cabinet"
            className="mt-3 inline-flex items-center text-[12px] font-semibold text-foreground underline underline-offset-2"
          >
            Réactiver mon cabinet
          </a>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  urgent,
}: {
  status: SubscriptionStatus;
  urgent?: boolean;
}) {
  if (status === SubscriptionStatus.TRIAL) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          urgent
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
        }`}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: urgent ? "#f59e0b" : "#3b82f6" }}
          aria-hidden
        />
        Essai
      </span>
    );
  }
  if (status === SubscriptionStatus.ACTIVE) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        Actif
      </span>
    );
  }
  if (status === SubscriptionStatus.PAST_DUE) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
        <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
        Impayé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
      <span className="size-1.5 rounded-full bg-slate-500" aria-hidden />
      Annulé
    </span>
  );
}
