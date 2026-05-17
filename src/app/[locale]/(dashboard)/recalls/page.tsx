import { getTranslations, setRequestLocale } from "next-intl/server";
import { RecallStatus, UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listRecalls } from "@/server/actions/recalls";
import { requireRole } from "@/lib/auth/rbac";
import { formatDateShort } from "@/lib/utils/format";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";
import { DisableRecallButton } from "./disable-button";
import { RegenerateRecallButton } from "./regenerate-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Filter = "OPEN" | "PENDING" | "SENT" | "APPOINTMENT_BOOKED" | "DISABLED" | "EXPIRED" | "all";
const FILTERS: Filter[] = ["OPEN", "PENDING", "SENT", "APPOINTMENT_BOOKED", "DISABLED", "EXPIRED", "all"];

export default async function RecallsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: Filter }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const { filter = "OPEN" } = await searchParams;
  const t = await getTranslations("Recalls");

  const result = await listRecalls({ status: FILTERS.includes(filter) ? filter : "OPEN" });
  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {result.error.message}
        </div>
      </div>
    );
  }
  const items = result.data;
  const openCount = items.filter(
    (r) => r.status === RecallStatus.PENDING || r.status === RecallStatus.SENT,
  ).length;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            <span className="num">{openCount}</span>{" "}
            {t("subtitle", { count: openCount }).replace(`${openCount} `, "")}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f;
          const params = new URLSearchParams();
          if (f !== "OPEN") params.set("filter", f);
          const href = params.toString() ? `/recalls?${params.toString()}` : "/recalls";
          return (
            <Link
              key={f}
              href={href as never}
              className={
                active
                  ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
              }
            >
              {t(`tabs.${f}`)}
            </Link>
          );
        })}
      </div>

      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-foreground text-base font-medium">{t("empty")}</div>
            <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.patient")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.kind")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.dueDate")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.sentAt")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/patients/${r.patientId}` as never}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {r.patientName}
                    </Link>
                    <div className="text-muted-foreground num text-xs">
                      {formatMoroccanPhoneShort(r.patientPhone)}
                    </div>
                  </td>
                  <td className="text-foreground px-4 py-3 text-sm">{t(`kind.${r.kind}`)}</td>
                  <td className="num px-4 py-3 text-xs">
                    <span
                      className={
                        r.isOverdue
                          ? "font-semibold text-rose-700"
                          : r.isApproaching
                            ? "font-medium text-amber-700"
                            : "text-muted-foreground"
                      }
                    >
                      {formatDateShort(r.dueDate, locale as Locale)}
                    </span>
                    {r.isOverdue && (
                      <span className="ms-1 text-xs text-rose-700">· {t("overdue")}</span>
                    )}
                  </td>
                  <td className="num text-muted-foreground px-4 py-3 text-xs">
                    {r.sentAt ? formatDateShort(r.sentAt, locale as Locale) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-1">
                      {(r.status === RecallStatus.PENDING || r.status === RecallStatus.SENT) && (
                        <DisableRecallButton id={r.id} />
                      )}
                      {(r.status === RecallStatus.DISABLED ||
                        r.status === RecallStatus.EXPIRED ||
                        r.status === RecallStatus.SENT) && (
                        <RegenerateRecallButton id={r.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

async function StatusBadge({ status }: { status: RecallStatus }) {
  const t = await getTranslations("Recalls.status");
  const tone =
    status === RecallStatus.PENDING
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
      : status === RecallStatus.SENT
        ? "bg-primary/10 text-primary border-primary/30"
        : status === RecallStatus.APPOINTMENT_BOOKED
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
          : status === RecallStatus.DISABLED
            ? "bg-muted text-muted-foreground border-border"
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
      {t(status)}
    </span>
  );
}
