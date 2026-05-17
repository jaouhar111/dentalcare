import { getTranslations } from "next-intl/server";
import { AppointmentStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils/format";
import type { TodayAppointment } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/routing";

/**
 * "Today's appointments" list matching the mockup. Each row shows time +
 * duration on the left, patient + reason + dentist in the middle, status
 * badge on the right. Clicking a row jumps to the appointment edit page.
 */
export async function TodayAppointments({
  items,
  locale,
}: {
  items: TodayAppointment[];
  locale: Locale;
}) {
  const t = await getTranslations("Dashboard.today");
  const tStatus = await getTranslations("Appointments.status");

  if (items.length === 0) {
    return (
      <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-10 text-center">
        <p className="text-muted-foreground text-sm italic">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-border/60 divide-y">
      {items.map((a) => {
        const tone =
          a.status === AppointmentStatus.CONFIRMED
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
            : a.status === AppointmentStatus.SCHEDULED
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
              : a.status === AppointmentStatus.CANCELLED
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                : a.status === AppointmentStatus.COMPLETED
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                  : "bg-muted text-muted-foreground border-border";
        const glyph =
          a.status === AppointmentStatus.CONFIRMED
            ? "●"
            : a.status === AppointmentStatus.SCHEDULED
              ? "⏳"
              : a.status === AppointmentStatus.CANCELLED
                ? "✕"
                : "○";
        return (
          <li key={a.id}>
            <Link
              href={`/appointments/${a.id}/edit` as never}
              className="hover:bg-muted/30 flex items-center gap-4 py-3 px-1 transition rounded-lg"
            >
              <div className="w-14 text-center">
                <div className="num text-foreground text-sm font-semibold">
                  {formatDate(a.startAt, locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {a.durationMin} min
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate font-medium">{a.patientName}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {a.reason ? `${a.reason} · ` : ""}Dr {a.dentistName}
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}
              >
                {glyph} {tStatus(a.status)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
