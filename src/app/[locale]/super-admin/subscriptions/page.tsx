import { setRequestLocale } from "next-intl/server";
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getSubscriptionsOverview } from "@/server/actions/super-admin-subscriptions";
import { ClinicRowActions } from "../_components/clinic-row-actions";
import { InlinePlanSwitch } from "../_components/inline-plan-switch";
import { ExtendTrialPopover } from "../_components/extend-trial-popover";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  CABINET_PLUS: "Cabinet+",
};

const STATUS_LABEL: Record<SubscriptionStatus, { label: string; cls: string }> = {
  TRIAL: {
    label: "Essai",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  ACTIVE: {
    label: "Actif",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  PAST_DUE: {
    label: "Impayé",
    cls: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  CANCELLED: {
    label: "Annulé",
    cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
};

/**
 * Global subscriptions overview for the super-admin. Three layers:
 *
 *   1. KPI strip — current MRR, projected MRR if trials convert,
 *      conversion rate, total cabinets.
 *   2. Per-plan breakdown — count + MRR per Starter/Pro/Cabinet+.
 *   3. Table — one row per cabinet with plan, status, days-left,
 *      monthly amount, contact email, quick row actions.
 *
 * No mutations on this page beyond the row actions (Activate / +14j /
 * Impayé). To change PLAN, drill into the cabinet detail and use the
 * PlanPicker — that's where the per-plan features list lives.
 */
export default async function SubscriptionsOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const res = await getSubscriptionsOverview();
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }
  const { rows, totals, perPlan } = res.data;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const madFmt = new Intl.NumberFormat(locale, {
    style: "decimal",
    maximumFractionDigits: 0,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-foreground text-[24px] font-semibold tracking-tight">
          Abonnements
        </h1>
        <p className="text-muted-foreground mt-1 text-[13px]">
          Vue propriétaire — MRR, conversions, statut de chaque cabinet.
        </p>
      </header>

      {/* ── KPI strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="MRR actuel"
          value={`${madFmt.format(totals.mrrActive)}`}
          suffix="MAD / mois"
          tone="emerald"
        />
        <Kpi
          label="MRR projeté"
          value={`${madFmt.format(totals.mrrActive + totals.mrrProjectedIfTrialsConvert)}`}
          suffix="si essais convertissent"
          tone="cyan"
        />
        <Kpi
          label="Conversion essais"
          value={
            totals.conversionRate === null
              ? "—"
              : `${Math.round(totals.conversionRate * 100)} %`
          }
          suffix={
            totals.conversionRate === null
              ? "pas encore de données"
              : "essai → payant"
          }
          tone="violet"
        />
        <Kpi
          label="Total cabinets"
          value={`${totals.clinics}`}
          suffix={`${totals.active} actifs · ${totals.trialing} essai`}
        />
      </div>

      {/* ── Per-plan breakdown ────────────────────────────── */}
      <section className="apple-card">
        <h2 className="text-foreground mb-4 text-sm font-semibold tracking-wider uppercase">
          Répartition par plan
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["STARTER", "PRO", "CABINET_PLUS"] as const).map((plan) => (
            <div
              key={plan}
              className="rounded-2xl bg-black/[0.025] p-5 ring-1 ring-black/[0.04]"
            >
              <div className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
                {PLAN_LABEL[plan]}
              </div>
              <div className="text-foreground mt-2 flex items-baseline gap-2">
                <span className="num text-[32px] leading-none font-bold tracking-tight tabular-nums">
                  {perPlan[plan].clinics}
                </span>
                <span className="text-muted-foreground text-[12px]">
                  cabinets
                </span>
              </div>
              <div className="text-muted-foreground mt-3 text-[12px]">
                MRR :{" "}
                <span className="text-foreground font-semibold">
                  {madFmt.format(perPlan[plan].mrr)} MAD
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Table ─────────────────────────────────────────── */}
      <section className="card-glass overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            Cabinets ({rows.length})
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-[14px]">Aucun cabinet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3 text-start">Cabinet</th>
                  <th className="py-2 pr-3 text-start">Plan</th>
                  <th className="py-2 pr-3 text-start">Statut</th>
                  <th className="py-2 pr-3 text-end">MAD / mois</th>
                  <th className="py-2 pr-3 text-start">Essai</th>
                  <th className="py-2 pr-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const statusStyle = STATUS_LABEL[r.status];
                  const urgent =
                    r.trialDaysRemaining !== null && r.trialDaysRemaining <= 3;
                  return (
                    <tr
                      key={r.id}
                      className="border-border/40 border-b last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          href={`/super-admin/clinics/${r.id}` as never}
                          className="text-foreground hover:text-primary font-medium"
                        >
                          {r.name}
                        </Link>
                        <div className="text-muted-foreground text-[11px]">
                          {r.email ?? "—"} · créé le {dateFmt.format(r.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <InlinePlanSwitch
                          clinicId={r.id}
                          currentPlan={r.plan}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle.cls}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="text-foreground num py-3 pr-3 text-end font-medium tabular-nums">
                        {r.monthlyAmount > 0
                          ? madFmt.format(r.monthlyAmount)
                          : "—"}
                      </td>
                      <td className="py-3 pr-3 text-[12px]">
                        {r.trialDaysRemaining !== null ? (
                          <span
                            className={
                              urgent
                                ? "font-semibold text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground"
                            }
                          >
                            {r.trialDaysRemaining} j
                            {r.trialEndsAt
                              ? ` · fin ${dateFmt.format(r.trialEndsAt)}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <ExtendTrialPopover
                            clinicId={r.id}
                            currentStatus={r.status}
                          />
                          <ClinicRowActions
                            clinicId={r.id}
                            status={r.status}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix: string;
  tone?: "emerald" | "cyan" | "violet";
}) {
  const toneColor =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "cyan"
        ? "text-cyan-700 dark:text-cyan-300"
        : tone === "violet"
          ? "text-violet-700 dark:text-violet-300"
          : "text-foreground";
  return (
    <div className="apple-kpi">
      <div className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className={`mt-1.5 text-[26px] leading-none font-bold tracking-tight tabular-nums ${toneColor}`}>
        {value}
      </div>
      <div className="text-muted-foreground mt-1 text-[11px]">{suffix}</div>
    </div>
  );
}
