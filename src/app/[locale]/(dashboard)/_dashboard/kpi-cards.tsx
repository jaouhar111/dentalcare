import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils/format";
import type { KpiBundle } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/routing";

/**
 * KPI grid — 4 tiles laid out on a 12-column grid (col-3 each on
 * desktop, full width on mobile). Liquid Glass styling: gradient
 * icon tile, corner glow blob, big tabular-num value.
 */
export async function KpiCards({ kpi, locale }: { kpi: KpiBundle; locale: Locale }) {
  const t = await getTranslations("Dashboard.kpi");
  const tForm = await getTranslations("Dashboard");

  const delta =
    kpi.revenueLastMonth > 0
      ? Math.round(((kpi.revenueThisMonth - kpi.revenueLastMonth) / kpi.revenueLastMonth) * 100)
      : 0;
  const deltaLabel =
    delta === 0
      ? t("deltaNeutral")
      : delta > 0
        ? t("deltaUp", { n: delta })
        : t("deltaDown", { n: delta });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("revenueMonth")}
        icon={<IconMoney />}
        value={formatCurrency(kpi.revenueThisMonth, locale)}
        delta={deltaLabel}
        deltaNegative={delta < 0}
      />

      <KpiTile
        label={t("activePatients")}
        icon={<IconUsers />}
        value={String(kpi.activePatients)}
        delta={tForm("kpi.newThisMonth", { count: kpi.newPatientsThisMonth })}
      />

      <KpiTile
        label={t("apptsThisWeek")}
        icon={<IconCalendar />}
        value={String(kpi.apptsThisWeek)}
        delta={`${t("confirmed", { n: kpi.apptsThisWeekConfirmed })} · ${t("pending", { n: kpi.apptsThisWeekPending })}`}
      />

      <KpiTile
        label={t("occupancy")}
        icon={<IconClock />}
        value={`${kpi.occupancyPct}%`}
        progress={kpi.occupancyPct}
      />
    </div>
  );
}

function KpiTile({
  label,
  icon,
  value,
  delta,
  deltaNegative,
  progress,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  delta?: string;
  deltaNegative?: boolean;
  progress?: number;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={deltaNegative ? "kpi-delta neg" : "kpi-delta"}>{delta}</div>
      )}
      {typeof progress === "number" && (
        <div className="bg-foreground/5 mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
            }}
          />
        </div>
      )}
    </div>
  );
}

function IconMoney() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" x2="12" y1="1" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
