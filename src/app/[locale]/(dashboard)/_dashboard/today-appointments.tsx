import { getTranslations } from "next-intl/server";
import { AppointmentStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils/format";
import { initialsOf } from "@/lib/utils/avatar";
import type { TodayAppointment } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/routing";

/**
 * "Today's appointments" list with the Liquid Glass `.rdv-row` style:
 * left = time chip, middle = patient initials avatar + name + reason,
 * right = colored pill badge. The first non-cancelled row is marked
 * `featured` (accent-tinted) to draw the eye to the next consultation.
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

  const featuredId = items.find((a) => a.status !== AppointmentStatus.CANCELLED)?.id;

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const isFeatured = a.id === featuredId;
        const badge = statusBadgeClass(a.status);
        const [first, last] = a.patientName.split(" ");
        return (
          <li key={a.id}>
            <Link
              href={`/appointments/${a.id}/edit` as never}
              className={isFeatured ? "rdv-row featured" : "rdv-row"}
            >
              <div className="rdv-time">
                {formatDate(a.startAt, locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div
                aria-hidden
                className="avatar-gradient grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold"
              >
                {initialsOf(first ?? "", last ?? "")}
              </div>
              <div className="rdv-info">
                <div className="rdv-name truncate">{a.patientName}</div>
                <div className="rdv-meta-line truncate">
                  {a.reason ? `${a.reason} · ` : ""}
                  {a.durationMin} min · Dr {a.dentistName}
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge}`}
              >
                {tStatus(a.status)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case AppointmentStatus.CONFIRMED:
      return "bg-emerald-50/80 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case AppointmentStatus.SCHEDULED:
      return "bg-sky-50/80 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900";
    case AppointmentStatus.IN_PROGRESS:
      return "bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case AppointmentStatus.CANCELLED:
      return "bg-rose-50/80 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case AppointmentStatus.COMPLETED:
      return "bg-blue-50/80 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    default:
      return "bg-muted/60 text-muted-foreground border-border";
  }
}
