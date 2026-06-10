import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getPlatformBI } from "@/server/actions/super-admin-bi";

export const dynamic = "force-dynamic";

/**
 * Phase 12 — Stage D
 *
 * Platform-owner BI page (`/super-admin/business-intelligence`).
 * The numbers that drive investment & strategic decisions :
 *   - MRR / ARR + per-plan breakdown
 *   - 12-month churn cohort table
 *   - NPS proxy (% tickets resolved < 24h over 90d)
 *   - 12-month signup sparkline
 *
 * Operational health (latency, error rate) lives at
 * `/super-admin/monitoring` — keep the two pages distinct.
 */
export default async function PlatformBIPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const res = await getPlatformBI();
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }
  const data = res.data;

  const madFmt = new Intl.NumberFormat(locale, {
    style: "decimal",
    maximumFractionDigits: 0,
  });

  const totalCabinets = data.churnCohorts.reduce(
    (s, c) => s + c.totalSignups,
    0,
  );
  const avgRetention =
    data.churnCohorts.length > 0 && totalCabinets > 0
      ? Math.round(
          (data.churnCohorts.reduce((s, c) => s + c.stillActive, 0) /
            totalCabinets) *
            100,
        )
      : 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header>
        <h1 className="text-[#1d1d1f] dark:text-white text-[24px] font-semibold tracking-tight">
          Business Intelligence
        </h1>
        <p className="text-[#6e6e73] dark:text-[#a1a1a6] mt-1 text-[13px]">
          MRR, churn, NPS — décisions de croissance, pas opérationnel.
        </p>
      </header>

      {/* ── KPI strip — 4 numbers that matter most ─────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="MRR"
          value={madFmt.format(data.mrr)}
          unit="MAD / mois"
          accent="emerald"
        />
        <Kpi
          label="ARR projeté"
          value={madFmt.format(data.arr)}
          unit="MAD / an"
          accent="emerald"
        />
        <Kpi
          label="Rétention moyenne"
          value={`${avgRetention}`}
          unit="%"
          sub={`sur ${totalCabinets} cabinets (12 mois)`}
          accent={avgRetention < 80 ? "amber" : "cyan"}
        />
        <Kpi
          label="NPS proxy"
          value={`${data.npsProxy.sla24hRate}`}
          unit="%"
          sub={`${data.npsProxy.resolvedUnder24h}/${data.npsProxy.resolvedTickets} tickets résolus < 24h`}
          accent="cyan"
        />
      </div>

      {/* ── MRR breakdown by plan ──────────────────────────────── */}
      <section className="apple-card">
        <div className="apple-kpi-label mb-3">Répartition MRR par plan</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["STARTER", "PRO", "CABINET_PLUS"] as const).map((plan) => {
            const planMrr = data.mrrByPlan[plan];
            const pct = data.mrr > 0 ? Math.round((planMrr / data.mrr) * 100) : 0;
            const label = {
              STARTER: "Starter",
              PRO: "Pro",
              CABINET_PLUS: "Cabinet+",
            }[plan];
            return (
              <div
                key={plan}
                className="rounded-2xl bg-black/[0.025] p-4 ring-1 ring-black/[0.04]"
              >
                <div className="text-[#6e6e73] text-[11px] font-medium tracking-[0.08em] uppercase">
                  {label}
                </div>
                <div className="text-[#1d1d1f] dark:text-white mt-2 flex items-baseline gap-1.5">
                  <span className="text-[26px] font-semibold tabular-nums tracking-tight">
                    {madFmt.format(planMrr)}
                  </span>
                  <span className="text-[11px] text-[#6e6e73]">MAD/mois</span>
                </div>
                <div className="text-[#6e6e73] mt-1 text-[11px]">
                  {pct} % du MRR total
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="bg-[#0071e3] h-full rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Churn cohort table ──────────────────────────────────── */}
      <section className="apple-card">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="apple-kpi-label">Rétention par cohorte</div>
            <h2 className="text-[#1d1d1f] dark:text-white mt-1 text-[18px] font-semibold tracking-tight">
              Cabinets toujours là, par mois d&apos;inscription
            </h2>
          </div>
          <div className="text-[12px] text-[#6e6e73]">12 derniers mois</div>
        </div>
        {data.churnCohorts.every((c) => c.totalSignups === 0) ? (
          <p className="text-[#6e6e73] text-[14px]">
            Pas encore de cabinets inscrits. La cohorte se remplira dès le
            premier signup.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[#6e6e73] border-b border-black/[0.06] text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3 text-start">Cohorte</th>
                  <th className="py-2 pr-3 text-end">Signups</th>
                  <th className="py-2 pr-3 text-end">Encore actifs</th>
                  <th className="py-2 pr-3 text-end">Rétention</th>
                  <th className="py-2 pl-3 text-start">Tendance</th>
                </tr>
              </thead>
              <tbody>
                {data.churnCohorts.map((c) => (
                  <tr
                    key={c.cohort}
                    className="border-b border-black/[0.04] last:border-0"
                  >
                    <td className="text-[#1d1d1f] dark:text-white py-2.5 pr-3 font-medium tabular-nums">
                      {c.cohort}
                    </td>
                    <td className="py-2.5 pr-3 text-end tabular-nums">
                      {c.totalSignups}
                    </td>
                    <td className="py-2.5 pr-3 text-end tabular-nums">
                      {c.stillActive}
                    </td>
                    <td className="py-2.5 pr-3 text-end">
                      <span
                        className={`tabular-nums font-semibold ${
                          c.retentionPct >= 80
                            ? "text-emerald-700 dark:text-emerald-300"
                            : c.retentionPct >= 60
                              ? "text-amber-700 dark:text-amber-300"
                              : c.totalSignups > 0
                                ? "text-red-700 dark:text-red-300"
                                : "text-[#86868b]"
                        }`}
                      >
                        {c.totalSignups > 0 ? `${c.retentionPct} %` : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className={`h-full rounded-full ${
                            c.retentionPct >= 80
                              ? "bg-emerald-500"
                              : c.retentionPct >= 60
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${c.retentionPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Signups sparkline ────────────────────────────────────── */}
      <section className="apple-card">
        <div className="mb-3">
          <div className="apple-kpi-label">Inscriptions 12 mois</div>
          <h2 className="text-[#1d1d1f] dark:text-white mt-1 text-[18px] font-semibold tracking-tight">
            Volume d&apos;acquisition mois après mois
          </h2>
        </div>
        <SignupsBarChart points={data.signupsLast12Months} />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: "cyan" | "emerald" | "amber";
}) {
  const accentColor = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    cyan: "text-[#0066cc] dark:text-[#2997ff]",
    amber: "text-amber-700 dark:text-amber-300",
  }[accent ?? "cyan"];
  return (
    <div className="apple-kpi">
      <div className="apple-kpi-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`apple-kpi-value ${accentColor}`}>{value}</span>
        {unit ? (
          <span className="text-[11px] text-[#6e6e73]">{unit}</span>
        ) : null}
      </div>
      {sub ? <div className="apple-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function SignupsBarChart({
  points,
}: {
  points: Array<{ month: string; count: number }>;
}) {
  const W = 700;
  const H = 140;
  const PAD = 8;
  const bw = (W - PAD * 2) / points.length - 4;
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-32 w-full"
      role="img"
      aria-label="Inscriptions cabinets 12 derniers mois"
    >
      {points.map((p, i) => {
        const x = PAD + i * (bw + 4);
        const h = (p.count / max) * (H - 32);
        const isCurrent = i === points.length - 1;
        return (
          <g key={p.month}>
            <rect
              x={x}
              y={H - h - 18}
              width={bw}
              height={h}
              rx={3}
              fill={isCurrent ? "#0071e3" : "#0066cc"}
              opacity={isCurrent ? 1 : 0.45}
            />
            <text
              x={x + bw / 2}
              y={H - h - 22}
              fontSize="9"
              textAnchor="middle"
              fill="#1d1d1f"
              fontWeight="600"
            >
              {p.count > 0 ? p.count : ""}
            </text>
            <text
              x={x + bw / 2}
              y={H - 4}
              fontSize="9"
              textAnchor="middle"
              fill="#86868b"
            >
              {p.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
