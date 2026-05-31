import { getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listWaitlist } from "@/server/actions/waitlist";
import { avatarColor, initialsOf } from "@/lib/utils/avatar";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";
import { formatDateShort } from "@/lib/utils/format";
import { RemoveWaitlistButton } from "./remove-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<WaitlistStatus, string> = {
  WAITING:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  PROPOSED: "bg-primary/10 text-primary border-primary/30",
  ACCEPTED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  DECLINED:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export default async function WaitlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Waitlist");

  const result = await listWaitlist();
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
  const activeCount = items.filter(
    (i) => i.status === WaitlistStatus.WAITING || i.status === WaitlistStatus.PROPOSED,
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-2 lg:py-2">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">{t("title")}</h1>
          <p className="page-sub">
            <span className="num">{activeCount}</span>{" "}
            {t("subtitle", { count: activeCount }).replace(`${activeCount} `, "")}
          </p>
        </div>
        <Link
          href={"/waitlist/new" as never}
          className="btn-gradient-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
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
          {t("add")}
        </Link>
      </header>

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <svg
          className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p className="text-sm text-amber-900 dark:text-amber-200">{t("explainer")}</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border-border/60 rounded-xl border px-6 py-16 text-center">
          <div className="text-foreground text-base font-medium">{t("empty")}</div>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
          <Link
            href={"/waitlist/new" as never}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
          >
            {t("add")}
          </Link>
        </div>
      ) : (
        <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.patient")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.dentist")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.duration")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.window")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.createdAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {items.map((it) => {
                const color = avatarColor(it.patientName);
                const tone = STATUS_TONE[it.status];
                let windowText = t("noWindow");
                if (it.notBefore && it.notAfter) {
                  windowText = t("windowBetween", {
                    from: formatDateShort(it.notBefore, locale as Locale),
                    to: formatDateShort(it.notAfter, locale as Locale),
                  });
                } else if (it.notBefore) {
                  windowText = t("windowFrom", {
                    date: formatDateShort(it.notBefore, locale as Locale),
                  });
                } else if (it.notAfter) {
                  windowText = t("windowUntil", {
                    date: formatDateShort(it.notAfter, locale as Locale),
                  });
                }
                const timePrefLabel =
                  it.timePreference === "ANY"
                    ? t("anyTime")
                    : it.timePreference === "MORNING"
                      ? t("morning")
                      : t("afternoon");
                return (
                  <tr key={it.id} className="hover:bg-muted/30 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                          aria-hidden
                        >
                          {initialsOf(
                            it.patientName.split(" ")[0] ?? "",
                            it.patientName.split(" ")[1] ?? "",
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{it.patientName}</div>
                          <div className="text-muted-foreground num text-xs">
                            {formatMoroccanPhoneShort(it.patientPhone)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {it.dentistName ? `Dr ${it.dentistName}` : t("anyDentist")}
                    </td>
                    <td className="num text-muted-foreground px-4 py-3">{it.durationMin} min</td>
                    <td className="text-muted-foreground px-4 py-3">
                      <div className="text-foreground">{timePrefLabel}</div>
                      <div className="text-muted-foreground num text-xs">{windowText}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}
                      >
                        {t(`status.${it.status}`)}
                      </span>
                      {it.status === "PROPOSED" && it.proposedExpiresAt && (
                        <div className="text-muted-foreground num mt-0.5 text-[10px]">
                          ⏳{" "}
                          {it.proposedExpiresAt.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="num text-muted-foreground px-4 py-3">
                      {formatDateShort(it.createdAt, locale as Locale)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {(it.status === "WAITING" || it.status === "PROPOSED") && (
                        <RemoveWaitlistButton id={it.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
