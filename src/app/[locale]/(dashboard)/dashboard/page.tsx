import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppointmentStatus, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db/client";
import { getDashboard } from "@/server/actions/dashboard";
import { formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Cabinet dashboard — v2 Apple-flat, hero-first.
 *
 * Layout principles (Phase 10):
 *   - Above-the-fold: ONE message — « what do I need to act on today? »
 *     → RDV du jour + RDV demain + WhatsApp inbox preview
 *   - Below-the-fold: KPIs + secondary tiles (patients récents, alertes)
 *   - No glass material, no gradient banner — Apple flat cards everywhere
 *
 * SUPER_ADMIN is bounced to /super-admin so they never see a cabinet
 * dashboard scoped to the platform-clinic (which would be empty).
 */
export default async function DashboardHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === UserRole.SUPER_ADMIN) {
    redirect(`/${locale}/super-admin`);
  }

  const [data, clinic] = await Promise.all([
    getDashboard(),
    db.clinic.findFirst({
      where: { id: session.user.clinicId },
      select: { name: true, aiEnabled: true },
    }),
  ]);

  const dateStr = formatDate(data.generatedAt, locale as Locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const firstName = (session.user.name ?? session.user.email).split(" ")[0];

  // Revenue MoM delta — drives the badge color on the KPI card.
  const revenueDelta =
    data.kpi.revenueLastMonth > 0
      ? Math.round(
          ((data.kpi.revenueThisMonth - data.kpi.revenueLastMonth) /
            data.kpi.revenueLastMonth) *
            100,
        )
      : data.kpi.revenueThisMonth > 0
        ? 100
        : 0;

  const madFmt = new Intl.NumberFormat(locale, {
    style: "decimal",
    maximumFractionDigits: 0,
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const relFmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const noShowAlert = data.noShowRate30d > 15;
  const unreadCount = data.recentConversations.filter((c) => c.isUnread).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 md:px-2">
      {/* ── Header — minimal line, no banner ──────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[#1d1d1f] dark:text-white text-[28px] leading-tight font-semibold tracking-tight">
            Bonjour, {firstName}.
          </h1>
          <p className="mt-1 text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">
            {clinic?.name} · {dateStr}
            {clinic?.aiEnabled === false ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <span className="size-1 rounded-full bg-amber-500" aria-hidden />
                AI Receptionist désactivé
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href={"/appointments/new" as never}
          className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0077ed]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouveau RDV
        </Link>
      </header>

      {/* ── Hero row: RDV du jour (2/3) + Inbox WhatsApp (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* RDV du jour */}
        <section className="apple-card">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="apple-kpi-label">Aujourd&apos;hui</div>
              <h2 className="text-[#1d1d1f] dark:text-white mt-0.5 text-[20px] font-semibold tracking-tight">
                {data.todayAppointments.length === 0
                  ? "Aucun RDV"
                  : `${data.todayAppointments.length} RDV`}
                {data.tomorrowApptsCount > 0 ? (
                  <span className="ml-2 text-[14px] font-normal text-[#6e6e73]">
                    · {data.tomorrowApptsCount} demain
                  </span>
                ) : null}
              </h2>
            </div>
            <Link
              href={"/appointments" as never}
              className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
            >
              Voir agenda ›
            </Link>
          </div>

          {data.todayAppointments.length === 0 ? (
            <div className="rounded-xl bg-black/[0.025] p-8 text-center">
              <p className="text-[14px] text-[#6e6e73]">
                Pas de RDV programmé aujourd&apos;hui — bonne journée 🙂
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.05]">
              {data.todayAppointments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/appointments/${a.id}/edit` as never}
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <div className="text-[#1d1d1f] dark:text-white text-[16px] font-semibold tabular-nums">
                        {timeFmt.format(a.startAt)}
                      </div>
                      <div className="text-[10px] text-[#86868b]">
                        {a.durationMin} min
                      </div>
                    </div>
                    <StatusDot status={a.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[#1d1d1f] dark:text-white truncate text-[14px] font-semibold">
                        {a.patientName}
                      </div>
                      <div className="truncate text-[12px] text-[#6e6e73]">
                        {a.dentistName}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </div>
                    </div>
                    <svg className="size-4 text-[#86868b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Inbox WhatsApp preview */}
        <section className="apple-card flex flex-col">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="apple-kpi-label">
                WhatsApp
                {unreadCount > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums">
                    {unreadCount}
                  </span>
                ) : null}
              </div>
              <h2 className="text-[#1d1d1f] dark:text-white mt-0.5 text-[20px] font-semibold tracking-tight">
                {data.recentConversations.length === 0
                  ? "Inbox vide"
                  : "Conversations"}
              </h2>
            </div>
            <Link
              href={"/conversations" as never}
              className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
            >
              Tout voir ›
            </Link>
          </div>

          {data.recentConversations.length === 0 ? (
            <p className="text-[13px] text-[#6e6e73]">
              Aucun message pour l&apos;instant.
            </p>
          ) : (
            <ul className="flex-1 space-y-2">
              {data.recentConversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/conversations/${c.id}` as never}
                    className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-black/[0.03]"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${c.isUnread ? "bg-[#0071e3]" : "bg-transparent"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[13px] ${c.isUnread ? "text-[#1d1d1f] dark:text-white font-semibold" : "text-[#1d1d1f] dark:text-[#f5f5f7]"}`}
                        >
                          {c.patientName}
                        </span>
                        <span className="text-[10px] text-[#86868b] tabular-nums">
                          {relativeTime(c.lastActivityAt, relFmt)}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-[#6e6e73]">
                        {c.status === "HANDED_OFF"
                          ? "À reprendre"
                          : c.status === "CLOSED"
                            ? "Fermée"
                            : "Bot actif"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── 4 KPIs Apple-flat ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Revenus du mois"
          value={madFmt.format(data.kpi.revenueThisMonth)}
          unit="MAD"
          sub={
            revenueDelta === 0
              ? "vs mois précédent"
              : `${revenueDelta > 0 ? "+" : ""}${revenueDelta}% vs mois précédent`
          }
          tone={revenueDelta < 0 ? "warn" : revenueDelta > 0 ? "good" : undefined}
        />
        <Kpi
          label="Taux no-show 30j"
          value={`${data.noShowRate30d} %`}
          sub={noShowAlert ? "élevé — vérifier les rappels" : "sous contrôle"}
          tone={noShowAlert ? "warn" : "good"}
        />
        <Kpi
          label="RDV confirmés"
          value={`${data.kpi.apptsThisWeekConfirmed}`}
          sub={`sur ${data.kpi.apptsThisWeek} cette semaine`}
        />
        <Kpi
          label="En attente confirmation"
          value={`${data.kpi.apptsThisWeekPending}`}
          sub={
            data.kpi.apptsThisWeekPending > 5
              ? "à relancer"
              : "cette semaine"
          }
          tone={data.kpi.apptsThisWeekPending > 5 ? "warn" : undefined}
        />
      </div>

      {/* ── Below the fold: patients + alertes ────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="apple-card">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="apple-kpi-label">Patients récents</div>
            <Link
              href={"/patients" as never}
              className="text-[12px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
            >
              Tous les patients ›
            </Link>
          </div>
          {data.recentPatients.length === 0 ? (
            <p className="text-[13px] text-[#6e6e73]">
              Pas encore de patient. Importez un CSV ou créez la première fiche.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05]">
              {data.recentPatients.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}` as never}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[12px] font-semibold text-[#1d1d1f]">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#86868b] tabular-nums">
                      {relativeTime(p.createdAt, relFmt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="apple-card">
          <div className="apple-kpi-label mb-3">Alertes</div>
          {data.alerts.length === 0 ? (
            <p className="text-[13px] text-[#6e6e73]">Rien à signaler 🎉</p>
          ) : (
            <ul className="space-y-2.5">
              {data.alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2.5 rounded-xl bg-amber-500/[0.06] p-3 ring-1 ring-amber-500/15"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                      {alertLabel(a.kind, a.count)}
                    </div>
                    {a.details.length > 0 ? (
                      <div className="mt-0.5 truncate text-[11px] text-[#6e6e73]">
                        {a.details.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  const valueColor =
    tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "good"
        ? "text-emerald-700 dark:text-emerald-300"
        : "";
  return (
    <div className="apple-kpi">
      <div className="apple-kpi-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`apple-kpi-value ${valueColor}`}>{value}</span>
        {unit ? <span className="text-[11px] text-[#6e6e73]">{unit}</span> : null}
      </div>
      {sub ? <div className="apple-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function StatusDot({ status }: { status: AppointmentStatus }) {
  const colorMap: Record<AppointmentStatus, string> = {
    SCHEDULED: "#86868b",
    CONFIRMED: "#34c759",
    COMPLETED: "#0071e3",
    CANCELLED: "#86868b",
    NO_SHOW: "#ef4444",
  };
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: colorMap[status] ?? "#86868b" }}
      aria-label={status}
    />
  );
}

function alertLabel(kind: string, count: number): string {
  switch (kind) {
    case "overdue-plans":
      return `${count} échéance${count > 1 ? "s" : ""} de paiement en retard`;
    case "low-stock":
      return `${count} article${count > 1 ? "s" : ""} en stock bas`;
    case "recalls":
      return `${count} recall${count > 1 ? "s" : ""} cette semaine`;
    case "open-invoices":
      return `${count} facture${count > 1 ? "s" : ""} impayée${count > 1 ? "s" : ""}`;
    default:
      return `${count} alerte${count > 1 ? "s" : ""}`;
  }
}

/**
 * Cheap relative time formatter — keeps the bundle small (no date-fns).
 * Falls back to absolute date if older than a week.
 */
function relativeTime(d: Date, fmt: Intl.RelativeTimeFormat): string {
  const diff = d.getTime() - Date.now();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return fmt.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return fmt.format(hours, "hour");
  const days = Math.round(diff / 86_400_000);
  if (Math.abs(days) < 7) return fmt.format(days, "day");
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(d);
}
