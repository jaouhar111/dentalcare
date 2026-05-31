import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getMonitoringSnapshot } from "@/server/actions/super-admin-monitoring";

export const dynamic = "force-dynamic";

/**
 * Super-admin monitoring page (Phase 10, § 4.10.4 du cahier).
 *
 * "Si WhatsApp casse = business cassé" → cette page doit être :
 *  - lisible au premier coup d'oeil
 *  - rafraîchie souvent (force-dynamic + page polled côté nav)
 *  - utile en incident (recent errors avec lien direct cabinet)
 *
 * Layout :
 *  1. Banner santé global (vert / amber / rouge selon error rate)
 *  2. 6 KPIs : conversations, tours, taux handover, échecs envois,
 *     erreurs webhook, cabinets actifs vs AI désactivé
 *  3. Sparkline 14 jours (volume conversations + tours)
 *  4. Latence p50 / p95 / p99
 *  5. Recent errors (avec clinic link)
 */
export default async function MonitoringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const res = await getMonitoringSnapshot();
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }
  const { totals, latency, activity14d, recentErrors, generatedAt } = res.data;

  // Health verdict — drives the banner color/copy. Rule of thumb:
  //   webhook errors > 0 = critical
  //   send failure rate > 5% = warn
  //   handover rate > 20% = info (bot underperforming)
  const sendFailureRate =
    totals.turns24h > 0
      ? Math.round((totals.sendFailures24h / totals.turns24h) * 100)
      : 0;
  const health: "ok" | "info" | "warn" | "critical" =
    totals.webhookErrors24h > 0
      ? "critical"
      : sendFailureRate > 5
        ? "warn"
        : totals.handoverRate24h > 20
          ? "info"
          : "ok";

  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[#1d1d1f] dark:text-white text-[24px] font-semibold tracking-tight">
            Monitoring IA & WhatsApp
          </h1>
          <p className="mt-1 text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">
            État de santé du bot — dernière analyse : {dateTimeFmt.format(generatedAt)}
          </p>
        </div>
      </header>

      <HealthBanner verdict={health} totals={totals} sendFailureRate={sendFailureRate} />

      {/* 6 KPIs Apple-flat */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Conversations 24h" value={`${totals.conversations24h}`} />
        <Kpi label="Tours bot 24h" value={`${totals.turns24h}`} />
        <Kpi
          label="Handover rate"
          value={`${totals.handoverRate24h} %`}
          sub="bot → humain"
          tone={totals.handoverRate24h > 20 ? "warn" : undefined}
        />
        <Kpi
          label="Échecs envoi"
          value={`${totals.sendFailures24h}`}
          sub={`${sendFailureRate} % des tours`}
          tone={sendFailureRate > 5 ? "warn" : undefined}
        />
        <Kpi
          label="Erreurs webhook"
          value={`${totals.webhookErrors24h}`}
          sub="signature invalide"
          tone={totals.webhookErrors24h > 0 ? "critical" : undefined}
        />
        <Kpi
          label="Cabinets AI ON"
          value={`${totals.aiEnabledClinics}`}
          sub={`${totals.aiDisabledClinics} désactivés · ${totals.activeClinics} actifs`}
        />
      </div>

      {/* Activity sparkline + latency side-by-side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="apple-card">
          <div className="apple-kpi-label mb-3">Activité 14 jours</div>
          <ActivityChart points={activity14d} />
          <p className="mt-3 text-[11px] text-[#86868b]">
            Total : {activity14d.reduce((s, p) => s + p.conversations, 0)} conversations · {activity14d.reduce((s, p) => s + p.turns, 0)} tours bot
          </p>
        </section>

        <section className="apple-card">
          <div className="apple-kpi-label mb-3">Latence bot (parse → send)</div>
          {latency.samples === 0 ? (
            <p className="text-[13px] text-[#6e6e73]">
              Aucun échantillon dans les dernières 24h.
            </p>
          ) : (
            <div className="space-y-3">
              <LatencyRow label="p50" value={latency.p50} threshold={2000} />
              <LatencyRow label="p95" value={latency.p95} threshold={5000} />
              <LatencyRow label="p99" value={latency.p99} threshold={10000} />
              <p className="text-[11px] text-[#86868b]">
                Mesuré sur {latency.samples} tours · cible p95 ≤ 5 s
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Recent errors */}
      <section className="apple-card">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="apple-kpi-label">Erreurs récentes</div>
          <Link
            href={"/super-admin/audit" as never}
            className="text-[13px] font-medium text-[#0066cc] hover:underline dark:text-[#2997ff]"
          >
            Voir audit complet ›
          </Link>
        </div>
        {recentErrors.length === 0 ? (
          <div className="rounded-xl bg-emerald-500/[0.06] p-6 text-center ring-1 ring-emerald-500/15">
            <p className="text-[14px] font-medium text-emerald-800 dark:text-emerald-200">
              Aucune erreur récente 🎉
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {recentErrors.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <ErrorDot action={e.action} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
                    {errorLabel(e.action)}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#6e6e73]">
                    <Link
                      href={`/super-admin/clinics/${e.clinicId}` as never}
                      className="font-medium hover:text-[#0066cc] hover:underline"
                    >
                      🏥 {e.clinicName}
                    </Link>
                    <span>·</span>
                    <span className="font-mono">{e.action}</span>
                    <span>·</span>
                    <span className="tabular-nums">{dateTimeFmt.format(e.at)}</span>
                  </div>
                  {e.payload ? (
                    <pre className="mt-1.5 max-w-full overflow-x-auto rounded-md bg-black/[0.04] p-2 font-mono text-[10px] text-[#6e6e73]">
                      {JSON.stringify(e.payload, null, 0).slice(0, 200)}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HealthBanner({
  verdict,
  totals,
  sendFailureRate,
}: {
  verdict: "ok" | "info" | "warn" | "critical";
  totals: { webhookErrors24h: number; handoverRate24h: number; sendFailures24h: number };
  sendFailureRate: number;
}) {
  const styles = {
    ok: {
      bg: "bg-emerald-500/[0.08] ring-emerald-500/20",
      dot: "bg-emerald-500",
      title: "Système sain",
      body: "Toutes les métriques sont dans les seuils. Aucune action requise.",
    },
    info: {
      bg: "bg-blue-500/[0.08] ring-blue-500/20",
      dot: "bg-blue-500",
      title: "À surveiller",
      body: `Taux de handover bot → humain à ${totals.handoverRate24h} %. Le bot pourrait être amélioré sur certaines questions.`,
    },
    warn: {
      bg: "bg-amber-500/[0.08] ring-amber-500/20",
      dot: "bg-amber-500",
      title: "Dégradation détectée",
      body: `${totals.sendFailures24h} échecs d'envoi WhatsApp sur 24h (${sendFailureRate}%). Vérifier le token Meta et les templates approuvés.`,
    },
    critical: {
      bg: "bg-red-500/[0.10] ring-red-500/25",
      dot: "bg-red-500",
      title: "INCIDENT — Action requise",
      body: `${totals.webhookErrors24h} erreur(s) de signature webhook détectée(s). Le bot ne reçoit peut-être plus les messages. Vérifier WHATSAPP_APP_SECRET en prod.`,
    },
  }[verdict];

  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${styles.bg}`}>
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${styles.dot}`} />
      <div>
        <div className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
          {styles.title}
        </div>
        <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6e6e73] dark:text-[#a1a1a6]">
          {styles.body}
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "critical";
}) {
  const valueColor =
    tone === "critical"
      ? "text-red-700 dark:text-red-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "";
  return (
    <div className="apple-kpi">
      <div className="apple-kpi-label">{label}</div>
      <div className={`apple-kpi-value ${valueColor}`}>{value}</div>
      {sub ? <div className="apple-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function ActivityChart({
  points,
}: {
  points: { date: string; conversations: number; turns: number }[];
}) {
  // SVG inline sparkline — no chart lib. Two stacked bars per day:
  // turns (back, lighter) and conversations (front, accent).
  const W = 600;
  const H = 120;
  const PAD = 4;
  const bw = (W - PAD * 2) / points.length - 2;
  const maxTurns = Math.max(1, ...points.map((p) => p.turns));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-32 w-full"
      role="img"
      aria-label="Activité bot sur 14 jours"
    >
      {points.map((p, i) => {
        const x = PAD + i * (bw + 2);
        const tH = (p.turns / maxTurns) * (H - 24);
        const cH = (p.conversations / maxTurns) * (H - 24);
        const today = i === points.length - 1;
        return (
          <g key={p.date}>
            <rect
              x={x}
              y={H - tH - 18}
              width={bw}
              height={tH}
              rx={2}
              fill={today ? "#0071e3" : "#0071e3"}
              opacity={today ? 0.25 : 0.12}
            />
            <rect
              x={x}
              y={H - cH - 18}
              width={bw}
              height={cH}
              rx={2}
              fill={today ? "#0071e3" : "#0066cc"}
              opacity={today ? 1 : 0.5}
            />
            {i % 2 === 0 ? (
              <text
                x={x + bw / 2}
                y={H - 4}
                fontSize="8"
                textAnchor="middle"
                fill="#86868b"
              >
                {p.date.slice(8)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function LatencyRow({
  label,
  value,
  threshold,
}: {
  label: string;
  value: number | null;
  threshold: number;
}) {
  const ms = value ?? 0;
  const isAlert = value !== null && value > threshold;
  const pct = value !== null ? Math.min(100, (ms / threshold) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-[#6e6e73]">{label}</span>
        <span
          className={`text-[14px] font-semibold tabular-nums ${
            isAlert ? "text-amber-700 dark:text-amber-300" : "text-[#1d1d1f] dark:text-white"
          }`}
        >
          {value === null ? "—" : `${ms} ms`}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full ${
            isAlert ? "bg-amber-500" : "bg-[#0071e3]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ErrorDot({ action }: { action: string }) {
  const color = action.includes("webhook")
    ? "#ef4444"
    : action.includes("disabled_handoff")
      ? "#f59e0b"
      : "#ef4444";
  return (
    <span
      className="mt-1.5 size-2 shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden
    />
  );
}

function errorLabel(action: string): string {
  switch (action) {
    case "whatsapp.webhook.invalid_signature":
      return "Signature webhook invalide";
    case "ai.conversation.send_failed":
      return "Échec d'envoi WhatsApp";
    case "ai.conversation.failed":
      return "Erreur moteur IA";
    case "ai.conversation.disabled_handoff":
      return "Bot désactivé — handover auto";
    default:
      return action;
  }
}
