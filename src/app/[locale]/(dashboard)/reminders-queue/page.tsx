import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole, RecallKind } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getRemindersQueue } from "@/server/actions/reminders-queue";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

export default async function RemindersQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const t = await getTranslations("RemindersQueue");

  const result = await getRemindersQueue();
  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {result.error.message}
        </div>
      </div>
    );
  }
  const data = result.data;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dueFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const recentFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-2 lg:py-2">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">{t("title")}</h1>
          <p className="page-sub">{t("subtitle")}</p>
        </div>
      </header>

      {/* KPI strip — single column on phone, 3-up from sm breakpoint */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            {t("kpi.appointments")}
          </div>
          <div className="kpi-value mt-1">
            <span className="num">{data.totals.appointmentsTotal}</span>
          </div>
          <div className="text-muted-foreground mt-1 text-[12px]">
            {t("kpi.appointmentsHelp", {
              sent: data.totals.appointmentsAlreadySent,
            })}
          </div>
        </div>
        <div className="kpi-card">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            {t("kpi.recalls")}
          </div>
          <div className="kpi-value mt-1">
            <span className="num">{data.totals.recallsTotal}</span>
          </div>
          <div className="text-muted-foreground mt-1 text-[12px]">{t("kpi.recallsHelp")}</div>
        </div>
        <div className="kpi-card">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            {t("kpi.failures")}
          </div>
          <div className="kpi-value mt-1">
            <span
              className={`num ${data.totals.failuresTotal > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
            >
              {data.totals.failuresTotal}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 text-[12px]">{t("kpi.failuresHelp")}</div>
        </div>
      </div>

      {/* ── Section 1: upcoming appointment reminders ── */}
      <section className="card-glass mb-6">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {t("sections.appointments")}
        </h2>
        {data.upcomingAppointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("sections.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3">{t("col.startAt")}</th>
                  <th className="py-2 pr-3">{t("col.reminderAt")}</th>
                  <th className="py-2 pr-3">{t("col.patient")}</th>
                  <th className="py-2 pr-3">{t("col.dentist")}</th>
                  <th className="py-2 pr-3">{t("col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingAppointments.map((a) => (
                  <tr key={a.appointmentId} className="border-border/40 border-b last:border-0">
                    <td className="num py-2 pr-3 font-medium">{dateFmt.format(a.startAt)}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-[12px]">
                      {dateFmt.format(a.reminderAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{a.patientName}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {formatMoroccanPhoneShort(a.patientPhone)}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{a.dentistName}</td>
                    <td className="py-2 pr-3">
                      {a.reminderSentAt ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {t("status.sent")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {t("status.queued")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 2: upcoming recalls ── */}
      <section className="card-glass mb-6">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {t("sections.recalls")}
        </h2>
        {data.upcomingRecalls.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("sections.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3">{t("col.dueDate")}</th>
                  <th className="py-2 pr-3">{t("col.patient")}</th>
                  <th className="py-2 pr-3">{t("col.kind")}</th>
                  <th className="py-2 pr-3">{t("col.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingRecalls.map((r) => (
                  <tr key={r.id} className="border-border/40 border-b last:border-0">
                    <td className="num py-2 pr-3 font-medium">{dueFmt.format(r.dueDate)}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.patientName}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {formatMoroccanPhoneShort(r.patientPhone)}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{recallKindLabel(r.kind)}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-[12px]">
                      {r.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 3: recent failures ── */}
      <section className="card-glass">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {t("sections.failures")}
        </h2>
        {data.recentFailures.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("sections.noFailures")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3">{t("col.when")}</th>
                  <th className="py-2 pr-3">{t("col.action")}</th>
                  <th className="py-2 pr-3">{t("col.target")}</th>
                  <th className="py-2 pr-3">{t("col.error")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFailures.map((f) => (
                  <tr key={f.id} className="border-border/40 border-b last:border-0">
                    <td className="num text-muted-foreground py-2 pr-3 text-[12px]">
                      {recentFmt.format(f.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-medium">{f.action}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-[12px]">
                      {f.context ?? f.entity}
                    </td>
                    <td className="py-2 pr-3 text-[12px] text-amber-700 dark:text-amber-300">
                      {f.errorPreview || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function recallKindLabel(kind: RecallKind): string {
  switch (kind) {
    case RecallKind.SCALING:
      return "Détartrage";
    case RecallKind.ANNUAL_CHECKUP:
      return "Contrôle annuel";
    case RecallKind.IMPLANT_FOLLOWUP:
      return "Suivi implant";
    case RecallKind.POST_EXTRACTION:
      return "Suivi extraction";
    case RecallKind.CUSTOM:
      return "Personnalisé";
    default:
      return kind;
  }
}
