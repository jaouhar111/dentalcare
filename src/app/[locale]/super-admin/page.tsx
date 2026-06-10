import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth/rbac";
import { getPlatformOverview } from "@/server/actions/super-admin";
import { getSubscriptionsOverview } from "@/server/actions/super-admin-subscriptions";
import { getInboxCounts } from "@/server/actions/super-admin-support";
import { MetricSparkline } from "./_components/metric-sparkline";

export const dynamic = "force-dynamic";

/**
 * Apple-style super-admin dashboard. Trimmed-down v2 — single header
 * line, 4 KPIs (not 6), one sparkline, one unified activity feed,
 * and Apple flat cards (white / #f5f5f7 / 0.04 ring) instead of the
 * glass material. Three actions in parallel since they're independent.
 */
export default async function SuperAdminHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const session = await auth();
  const [overviewRes, subsRes, countsRes] = await Promise.all([
    getPlatformOverview(),
    getSubscriptionsOverview(),
    getInboxCounts(),
  ]);

  if (!overviewRes.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {overviewRes.error.message}
        </div>
      </div>
    );
  }
  const data = overviewRes.data;
  const subs = subsRes.ok ? subsRes.data : null;
  const counts = countsRes.ok
    ? countsRes.data
    : { OPEN: 0, IN_PROGRESS: 0, WAITING_USER: 0, RESOLVED: 0, TOTAL: 0 };

  const firstName = session?.user?.name?.split(" ")[0] ?? "Mehdi";
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const madFmt = new Intl.NumberFormat(locale, {
    style: "decimal",
    maximumFractionDigits: 0,
  });

  const openTickets = counts.OPEN + counts.IN_PROGRESS + counts.WAITING_USER;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      {/* ── Header line — no banner, just type ───────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3 px-1 pt-2">
        <div>
          <h1 className="text-[#1d1d1f] text-[28px] leading-tight font-semibold tracking-tight dark:text-white">
            Bonjour, {firstName}.
          </h1>
          <p className="mt-1 text-[14px] text-[#6e6e73] dark:text-[#a1a1a6]">
            Vue propriétaire — santé de la plateforme à l&apos;instant.
          </p>
        </div>
        {openTickets > 0 ? (
          <Link
            href={"/super-admin/support" as never}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-500/20 transition hover:bg-amber-500/15 dark:text-amber-300"
          >
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            {openTickets} ticket{openTickets > 1 ? "s" : ""} à traiter
            <span aria-hidden>›</span>
          </Link>
        ) : null}
      </header>

      {/* ── 4 KPIs, Apple flat ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="MRR"
          value={subs ? madFmt.format(subs.totals.mrrActive) : "—"}
          sub={`${data.totals.active} cabinets actifs`}
          unit="MAD/mois"
        />
        <Kpi
          label="Cabinets"
          value={`${data.totals.clinicsTotal}`}
          sub={`${data.totals.trialing} en essai · ${data.totals.pastDue} impayés`}
          tone={data.totals.pastDue > 0 ? "warn" : undefined}
        />
        <Kpi
          label="Activité IA (7j)"
          value={`${data.totals.aiConversationsLast7d}`}
          sub="conversations WhatsApp"
        />
        <Kpi
          label="Conversion"
          value={
            subs && subs.totals.conversionRate !== null
              ? `${Math.round(subs.totals.conversionRate * 100)} %`
              : "—"
          }
          sub="essai → payant"
        />
      </div>

      {/* ── Chart + activity feed ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="apple-card">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="apple-kpi-label">Inscriptions 30 jours</div>
              <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums text-[#1d1d1f] dark:text-white">
                {data.signups30d.reduce((s, p) => s + p.count, 0)} nouveaux
              </div>
            </div>
            <Link
              href={"/super-admin/clinics" as never}
              className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
            >
              Voir cabinets ›
            </Link>
          </div>
          <MetricSparkline
            points={data.signups30d}
            color="sky"
            ariaLabel="Nouvelles inscriptions cabinets sur 30 jours"
          />
        </section>

        <section className="apple-card flex flex-col">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="apple-kpi-label">Activité récente</div>
            <Link
              href={"/super-admin/audit" as never}
              className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
            >
              Audit ›
            </Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="text-[14px] text-[#6e6e73]">
              Rien de neuf cette semaine.
            </p>
          ) : (
            <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
              {data.recentActivity.slice(0, 8).map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2.5 border-b border-black/[0.04] pb-3 last:border-0 last:pb-0"
                >
                  <ActivityDot type={a.type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#1d1d1f] dark:text-white">
                      {a.summary}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#6e6e73]">
                      {a.clinicName} · {dateTimeFmt.format(a.at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Per-plan summary tiles (linked) ──────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {subs
          ? (["STARTER", "PRO", "CABINET_PLUS"] as const).map((plan) => {
              const meta = {
                STARTER: { label: "Starter" },
                PRO: { label: "Pro" },
                CABINET_PLUS: { label: "Cabinet+" },
              }[plan];
              return (
                <Link
                  key={plan}
                  href={"/super-admin/subscriptions" as never}
                  className="apple-card group block transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="apple-kpi-label">Plan {meta.label}</div>
                      <div className="mt-1.5 flex items-baseline gap-1.5 text-[#1d1d1f] dark:text-white">
                        <span className="text-[28px] leading-none font-semibold tabular-nums">
                          {subs.perPlan[plan].clinics}
                        </span>
                        <span className="text-[12px] text-[#6e6e73]">
                          cabinets
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-[#6e6e73]">
                        {madFmt.format(subs.perPlan[plan].mrr)} MAD / mois
                      </div>
                    </div>
                    <span className="text-[#86868b] transition-colors group-hover:text-[#0066cc]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })
          : null}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  unit,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  unit?: string;
  tone?: "warn";
}) {
  return (
    <div className="apple-kpi">
      <div className="apple-kpi-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`apple-kpi-value ${tone === "warn" ? "text-amber-700 dark:text-amber-300" : ""}`}
        >
          {value}
        </span>
        {unit ? <span className="text-[11px] text-[#6e6e73]">{unit}</span> : null}
      </div>
      {sub ? <div className="apple-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function ActivityDot({ type }: { type: string }) {
  const map: Record<string, string> = {
    "clinic.signup": "#34c759",
    "subscription.changed": "#8b5cf6",
    "appointment.created": "#0071e3",
  };
  const color = map[type] ?? "#86868b";
  return (
    <span
      className="mt-1.5 size-2 shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden
    />
  );
}
