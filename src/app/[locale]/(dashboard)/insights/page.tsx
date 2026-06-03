import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getCabinetInsights } from "@/server/actions/insights";

export const dynamic = "force-dynamic";

/**
 * Phase 12 — Cabinet ROI dashboard (/insights).
 *
 * "The numbers that sell" — every figure here should make the cabinet
 * pause and think « ce bot me rapporte plus qu'il ne me coûte ».
 *
 * Order of importance, top → bottom :
 *   1. Hero KPIs (4 tiles) — RDV créés par IA, revenus IA, temps économisé, off-hours
 *   2. Heatmap horaire — visualise « le bot bosse pendant que je dors »
 *   3. Top 5 questions — preuves sociales : « voici ce que tes patients demandent »
 *
 * Available to any cabinet staff so the dentist can show it in a sales
 * meeting to a peer. SUPER_ADMIN sees aggregate equivalents on the
 * monitoring page (Phase 10) and on their BI page (Stage D below).
 */
export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);

  const res = await getCabinetInsights();
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6 lg:p-8">
      {/* ── Header — period label + sales-pitch tagline ──────── */}
      <header className="space-y-1">
        <div className="text-[#0066cc] text-[12px] font-semibold tracking-[0.06em] uppercase dark:text-[#2997ff]">
          Insights — {data.period.label}
        </div>
        <h1 className="text-[#1d1d1f] dark:text-white text-[28px] font-semibold tracking-tight">
          Ce que votre AI Receptionist a fait pour vous
        </h1>
        <p className="text-[#6e6e73] dark:text-[#a1a1a6] text-[14px]">
          Toutes les données sont calculées sur la période en cours. Total
          conversations WhatsApp&nbsp;: {data.totalConversations}.
        </p>
      </header>

      {/* ── 4 hero KPIs — Apple flat ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="RDV pris par l'IA"
          value={`${data.totals.appointmentsCreatedByAI}`}
          sub={
            data.totals.appointmentsCreated > 0
              ? `${data.totals.aiBookingShareRate} % du total · ${data.totals.appointmentsCreated} RDV au total`
              : "aucun RDV ce mois"
          }
          accent="cyan"
        />
        <Kpi
          label="Revenus générés"
          value={madFmt.format(data.totals.revenueFromAI)}
          unit="MAD"
          sub="paiements liés aux RDV IA"
          accent="emerald"
        />
        <Kpi
          label="Temps économisé"
          value={`${data.totals.timeSavedHours}`}
          unit="h"
          sub={`${data.totals.aiTurnsCount} messages traités à votre place`}
          accent="violet"
        />
        <Kpi
          label="Patients hors horaires"
          value={`${data.totals.offHoursAppointments}`}
          sub={
            data.totals.appointmentsCreatedByAI > 0
              ? `${data.totals.offHoursShareRate} % entre 22h et 8h`
              : "aucun pour l'instant"
          }
          accent="amber"
        />
      </div>

      {/* ── Heatmap 7×24 ────────────────────────────────────── */}
      <section className="apple-card">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="apple-kpi-label">Heatmap d&apos;activité</div>
            <h2 className="text-[#1d1d1f] dark:text-white mt-1 text-[20px] font-semibold tracking-tight">
              Quand vos patients écrivent
            </h2>
          </div>
          <div className="text-[12px] text-[#6e6e73]">
            heure locale Casablanca
          </div>
        </div>
        <Heatmap grid={data.heatmap} />
      </section>

      {/* ── Top 5 questions ─────────────────────────────────── */}
      <section className="apple-card">
        <div className="mb-4">
          <div className="apple-kpi-label">Top questions des patients</div>
          <h2 className="text-[#1d1d1f] dark:text-white mt-1 text-[20px] font-semibold tracking-tight">
            Ce qu&apos;ils demandent le plus
          </h2>
          <p className="text-[#6e6e73] mt-1 text-[13px]">
            Groupé par signature de message (3 premiers mots normalisés). Utile
            pour repérer les questions récurrentes que vous pourriez
            pré-répondre dans le bot.
          </p>
        </div>

        {data.topQuestions.length === 0 ? (
          <p className="text-[#6e6e73] text-[14px]">
            Pas encore assez de conversations pour identifier des tendances.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {data.topQuestions.map((q, i) => (
              <li
                key={q.signature}
                className="flex items-start gap-3 rounded-xl bg-black/[0.025] p-3"
              >
                <span className="bg-[#0071e3] text-white grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[#1d1d1f] dark:text-white text-[14px] font-semibold">
                    «&nbsp;{q.example}&nbsp;»
                  </div>
                  <div className="text-[#6e6e73] mt-0.5 text-[11px]">
                    Signature&nbsp;: <span className="font-mono">{q.signature}</span> ·{" "}
                    {q.count} occurrence{q.count > 1 ? "s" : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
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
  accent: "cyan" | "emerald" | "violet" | "amber";
}) {
  const accentColor = {
    cyan: "text-[#0066cc] dark:text-[#2997ff]",
    emerald: "text-emerald-700 dark:text-emerald-300",
    violet: "text-violet-700 dark:text-violet-300",
    amber: "text-amber-700 dark:text-amber-300",
  }[accent];
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

/**
 * 7-row × 24-col heatmap. Color intensity scales with max value.
 * Days are labeled in French (Lun-Dim, ISO-style starting Monday).
 */
function Heatmap({ grid }: { grid: number[][] }) {
  // Re-order rows so Monday is first (ISO) — Sunday at index 0 in the
  // grid moves to the end.
  const reordered = [
    grid[1] ?? [],
    grid[2] ?? [],
    grid[3] ?? [],
    grid[4] ?? [],
    grid[5] ?? [],
    grid[6] ?? [],
    grid[0] ?? [],
  ];
  const max = Math.max(1, ...reordered.flat());
  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: "30px repeat(24, minmax(18px, 1fr))",
          gridTemplateRows: "auto repeat(7, 22px)",
        }}
      >
        {/* corner */}
        <div />
        {/* hour labels — show every 3 hours */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`h-${h}`}
            className="text-center text-[9px] text-[#86868b]"
            style={{ visibility: h % 3 === 0 ? "visible" : "hidden" }}
          >
            {h}h
          </div>
        ))}
        {/* rows */}
        {reordered.map((row, dayIdx) => (
          <div key={`row-${dayIdx}`} style={{ display: "contents" }}>
            <div className="self-center pr-1 text-end text-[10px] font-medium text-[#6e6e73]">
              {dayLabels[dayIdx]}
            </div>
            {Array.from({ length: 24 }, (_, h) => {
              const v = row[h] ?? 0;
              const intensity = v / max;
              const bg =
                v === 0
                  ? "rgba(0,0,0,0.04)"
                  : `rgba(0, 113, 227, ${0.15 + intensity * 0.75})`;
              return (
                <div
                  key={`c-${dayIdx}-${h}`}
                  className="rounded-[3px]"
                  style={{ background: bg }}
                  title={`${dayLabels[dayIdx]} ${h}h → ${v} message${v > 1 ? "s" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
