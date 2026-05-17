import { getTranslations } from "next-intl/server";
import { AppointmentStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { minutesSinceMidnight, sameDay } from "@/lib/utils/week";
import type { AppointmentListItem } from "@/server/actions/appointments";

const HOUR_START = 8;
const HOUR_END = 19; // exclusive — 18:00 last label
const PX_PER_HOUR = 64;
const PX_PER_MIN = PX_PER_HOUR / 60;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * PX_PER_HOUR;

type DayMeta = { date: Date; isToday: boolean };

/** Map AppointmentStatus → background + border + text Tailwind classes. */
function statusClasses(status: AppointmentStatus): string {
  switch (status) {
    case AppointmentStatus.CANCELLED:
      return "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 opacity-70";
    case AppointmentStatus.NO_SHOW:
      return "bg-rose-50 border-rose-400 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
    case AppointmentStatus.COMPLETED:
      return "bg-muted/60 border-border text-muted-foreground line-through-once";
    default:
      return "bg-card border-l-4 text-foreground";
  }
}

interface WorkingRange {
  dayOfWeek: number;
  /** Minutes since midnight. */
  startMin: number;
  endMin: number;
}

export async function WeekGrid({
  days,
  events,
  workingRanges,
  absencesByDay,
  hasDentistFilter,
}: {
  days: DayMeta[];
  events: AppointmentListItem[];
  workingRanges: WorkingRange[];
  /** Per day-of-week, list of [startMin,endMin] ranges to hatch as absence. */
  absencesByDay: Record<number, Array<{ startMin: number; endMin: number }>>;
  hasDentistFilter: boolean;
}) {
  const t = await getTranslations("Appointments");

  return (
    <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
      {/* ─── Days header ─── */}
      <div
        className="border-border/60 bg-muted/30 grid border-b"
        style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d.date.toISOString()}
            className={`border-border/60 border-s px-3 py-2 text-center ${
              d.isToday ? "bg-primary/10" : ""
            }`}
          >
            <div
              className={`text-xs ${d.isToday ? "text-primary font-medium" : "text-muted-foreground"}`}
            >
              {t(`days.${d.date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
            </div>
            <div
              className={`num text-sm font-semibold ${d.isToday ? "text-primary" : "text-foreground"}`}
            >
              {d.date.getDate()}
              {d.isToday && " ●"}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Body ─── */}
      <div className="relative" style={{ height: `${TOTAL_HEIGHT}px` }}>
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {/* Time gutter */}
          <div className="border-border/60 relative border-e">
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
              const h = HOUR_START + i;
              return (
                <div
                  key={h}
                  className="text-muted-foreground num absolute end-2 text-xs"
                  style={{ top: `${i * PX_PER_HOUR + 4}px` }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayEvents = events.filter((e) => sameDay(e.startAt, d.date));
            const dow = d.date.getDay();
            const todaysWorking = workingRanges.filter((w) => w.dayOfWeek === dow);
            const todaysAbsences = absencesByDay[dow] ?? [];

            return (
              <div
                key={d.date.toISOString()}
                className={`border-border/60 relative border-s ${d.isToday ? "bg-primary/5" : ""}`}
                style={{
                  backgroundImage: `repeating-linear-gradient(transparent 0 ${PX_PER_HOUR - 1}px, var(--color-border) ${PX_PER_HOUR - 1}px ${PX_PER_HOUR}px)`,
                }}
              >
                {/* Out-of-hours shading: tint everything OUTSIDE working ranges */}
                {!hasDentistFilter && todaysWorking.length > 0 && (
                  <>
                    {/* Before first working range */}
                    <OutOfHoursOverlay
                      top={0}
                      bottom={(todaysWorking[0]!.startMin - HOUR_START * 60) * PX_PER_MIN}
                    />
                    {/* After last working range */}
                    <OutOfHoursOverlay
                      top={
                        (todaysWorking[todaysWorking.length - 1]!.endMin - HOUR_START * 60) *
                        PX_PER_MIN
                      }
                      bottom={TOTAL_HEIGHT}
                    />
                    {/* Gaps between ranges */}
                    {todaysWorking.slice(0, -1).map((r, i) => {
                      const next = todaysWorking[i + 1]!;
                      return (
                        <OutOfHoursOverlay
                          key={i}
                          top={(r.endMin - HOUR_START * 60) * PX_PER_MIN}
                          bottom={(next.startMin - HOUR_START * 60) * PX_PER_MIN}
                        />
                      );
                    })}
                  </>
                )}

                {/* Absences — hatched overlay */}
                {todaysAbsences.map((a, i) => {
                  const top = Math.max(0, (a.startMin - HOUR_START * 60) * PX_PER_MIN);
                  const bottom = Math.min(TOTAL_HEIGHT, (a.endMin - HOUR_START * 60) * PX_PER_MIN);
                  return (
                    <div
                      key={`abs-${i}`}
                      className="text-muted-foreground absolute inset-x-0 grid place-items-center text-xs font-medium"
                      style={{
                        top: `${top}px`,
                        height: `${bottom - top}px`,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgba(148,163,184,0.18) 0 6px, transparent 6px 12px)",
                      }}
                    >
                      {t("closed")}
                    </div>
                  );
                })}

                {/* Appointments */}
                {dayEvents.map((evt) => {
                  const startMin = minutesSinceMidnight(evt.startAt);
                  const endMin = minutesSinceMidnight(evt.endAt);
                  const top = Math.max(0, (startMin - HOUR_START * 60) * PX_PER_MIN);
                  const height = Math.max(24, (endMin - startMin) * PX_PER_MIN);
                  const cls = statusClasses(evt.status);
                  const isCancelled = evt.status === AppointmentStatus.CANCELLED;
                  return (
                    <Link
                      key={evt.id}
                      href={`/appointments/${evt.id}/edit` as never}
                      className={`absolute inset-x-1 overflow-hidden rounded-md p-1.5 text-[11px] leading-tight ring-1 ring-black/5 transition hover:translate-y-[-1px] hover:shadow-sm ${cls}`}
                      style={{
                        top: `${top + 1}px`,
                        height: `${height - 2}px`,
                        borderLeftColor: evt.dentistColor,
                        backgroundColor: isCancelled ? undefined : `${evt.dentistColor}1A`, // 10% alpha
                      }}
                      title={`${evt.patientName} — ${evt.reason ?? ""}`}
                    >
                      <div
                        className={`truncate font-semibold ${isCancelled ? "line-through" : ""}`}
                      >
                        <span className="num">
                          {String(evt.startAt.getHours()).padStart(2, "0")}:
                          {String(evt.startAt.getMinutes()).padStart(2, "0")}
                        </span>{" "}
                        · {evt.patientName}
                      </div>
                      <div
                        className="truncate"
                        style={{
                          color: isCancelled ? undefined : evt.dentistColor,
                          filter: "brightness(0.85)",
                        }}
                      >
                        {evt.reason ?? t(`status.${evt.status}`)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OutOfHoursOverlay({ top, bottom }: { top: number; bottom: number }) {
  if (bottom <= top) return null;
  return (
    <div
      className="bg-muted/40 absolute inset-x-0"
      style={{ top: `${top}px`, height: `${bottom - top}px` }}
      aria-hidden
    />
  );
}
