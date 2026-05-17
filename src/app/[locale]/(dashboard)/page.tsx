import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db/client";
import { getDashboard } from "@/server/actions/dashboard";
import { formatDate } from "@/lib/utils/format";
import { KpiCards } from "./_dashboard/kpi-cards";
import { MonthlyRevenueChart } from "./_dashboard/monthly-revenue-chart";
import { TopTreatmentsList } from "./_dashboard/top-treatments-list";
import { TodayAppointments } from "./_dashboard/today-appointments";
import { AlertsPanel } from "./_dashboard/alerts-panel";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function DashboardHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) return null;
  const t = await getTranslations("Dashboard");

  const [data, clinic] = await Promise.all([
    getDashboard(),
    db.clinic.findFirst({
      where: { id: session.user.clinicId },
      select: { name: true },
    }),
  ]);

  const dateStr = formatDate(data.generatedAt, locale as Locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const firstName = (session.user.name ?? session.user.email).split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* ─── Header ─── */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("greeting", { name: firstName ?? "" })}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t("subtitle", { date: dateStr, clinic: clinic?.name ?? "" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={"/appointments" as never}
            className="border-input hover:bg-muted bg-background text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition"
          >
            {t("thisWeek")}
          </Link>
          <Link
            href={"/appointments/new" as never}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("newAppointment")}
          </Link>
        </div>
      </header>

      {/* ─── KPI cards ─── */}
      <KpiCards kpi={data.kpi} locale={locale as Locale} />

      {/* ─── Charts row ─── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-card border-border/60 rounded-xl border p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground font-semibold">{t("charts.monthlyRevenue")}</h3>
            <div className="text-muted-foreground text-xs">{t("charts.monthlyRevenueUnit")}</div>
          </div>
          <MonthlyRevenueChart data={data.monthlyRevenue} locale={locale as Locale} />
        </div>
        <div className="bg-card border-border/60 rounded-xl border p-5">
          <h3 className="text-foreground mb-4 font-semibold">{t("charts.topTreatments")}</h3>
          {data.topTreatments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm italic">
              {t("charts.noData")}
            </p>
          ) : (
            <TopTreatmentsList items={data.topTreatments} />
          )}
        </div>
      </div>

      {/* ─── Today + alerts ─── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-card border-border/60 rounded-xl border p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground font-semibold">{t("today.title")}</h3>
            <Link
              href={"/appointments" as never}
              className="text-primary text-xs hover:underline"
            >
              {t("today.viewCalendar")}
            </Link>
          </div>
          <TodayAppointments items={data.todayAppointments} locale={locale as Locale} />
        </div>
        <div className="bg-card border-border/60 rounded-xl border p-5">
          <h3 className="text-foreground mb-4 font-semibold">{t("alerts.title")}</h3>
          <AlertsPanel alerts={data.alerts} />
        </div>
      </div>
    </div>
  );
}
