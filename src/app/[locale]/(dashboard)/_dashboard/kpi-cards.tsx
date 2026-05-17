import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils/format";
import type { KpiBundle } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/routing";

/**
 * 4 KPI cards row matching the dashboard mockup:
 *   1. Revenue this month (with delta vs prev month)
 *   2. Active patients (with new-this-month signal)
 *   3. Appointments this week (with confirmed/pending split)
 *   4. Occupancy rate (with progress bar)
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
  const deltaTone =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Revenue */}
      <Tile
        label={t("revenueMonth")}
        icon={<IconMoney />}
        iconBg="bg-primary/10 text-primary"
      >
        <div className="num text-foreground mt-2 text-3xl font-bold tracking-tight">
          {formatCurrency(kpi.revenueThisMonth, locale)}
        </div>
        <div className={`mt-1 flex items-center gap-1 text-xs ${deltaTone}`}>
          {delta !== 0 && (
            <svg
              className={`size-3 ${delta < 0 ? "rotate-180" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden
            >
              <path d="M10 3l7 7h-4v7H7v-7H3l7-7z" />
            </svg>
          )}
          {deltaLabel}
        </div>
      </Tile>

      {/* Active patients */}
      <Tile
        label={t("activePatients")}
        icon={<IconUsers />}
        iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <div className="num text-foreground mt-2 text-3xl font-bold tracking-tight">
          {kpi.activePatients}
        </div>
        <div className="text-xs mt-1 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          {kpi.newPatientsThisMonth > 0 && (
            <svg className="size-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path d="M10 3l7 7h-4v7H7v-7H3l7-7z" />
            </svg>
          )}
          {tForm("kpi.newThisMonth", { count: kpi.newPatientsThisMonth })}
        </div>
      </Tile>

      {/* Appointments this week */}
      <Tile
        label={t("apptsThisWeek")}
        icon={<IconCalendar />}
        iconBg="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
      >
        <div className="num text-foreground mt-2 text-3xl font-bold tracking-tight">
          {kpi.apptsThisWeek}
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            {t("confirmed", { n: kpi.apptsThisWeekConfirmed })}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            {t("pending", { n: kpi.apptsThisWeekPending })}
          </span>
        </div>
      </Tile>

      {/* Occupancy */}
      <Tile
        label={t("occupancy")}
        icon={<IconClock />}
        iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <div className="num text-foreground mt-2 text-3xl font-bold tracking-tight">
          {kpi.occupancyPct}{" "}
          <span className="text-muted-foreground text-base font-medium">%</span>
        </div>
        <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${kpi.occupancyPct}%` }}
          />
        </div>
      </Tile>
    </div>
  );
}

function Tile({
  label,
  icon,
  iconBg,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border-border/60 rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-xs tracking-wider uppercase">{label}</div>
        <div className={`grid size-8 place-items-center rounded-lg ${iconBg}`}>{icon}</div>
      </div>
      {children}
    </div>
  );
}

function IconMoney() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
