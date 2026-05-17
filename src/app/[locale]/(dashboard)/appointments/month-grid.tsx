import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppointmentStatus } from "@prisma/client";
import { sameDay } from "@/lib/utils/week";
import type { AppointmentListItem } from "@/server/actions/appointments";

const MAX_VISIBLE_PER_DAY = 3;

export async function MonthGrid({
  days,
  events,
  monthAnchor,
}: {
  /** 42 dates (6 weeks × 7 days). Days outside the current month are dimmed. */
  days: Date[];
  events: AppointmentListItem[];
  /** Used to dim days outside the visible month. */
  monthAnchor: Date;
}) {
  const t = await getTranslations("Appointments");
  const today = new Date();
  const currentMonth = monthAnchor.getMonth();

  // Bucket events by yyyy-mm-dd for O(1) lookup per cell.
  const byDay = new Map<string, AppointmentListItem[]>();
  for (const ev of events) {
    const key = ymd(ev.startAt);
    const arr = byDay.get(key) ?? [];
    arr.push(ev);
    byDay.set(key, arr);
  }

  return (
    <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
      {/* ─── Weekday header row ─── */}
      <div className="border-border/60 bg-muted/30 grid grid-cols-7 border-b">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <div
            key={dow}
            className="text-muted-foreground border-border/60 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider not-first:border-s"
          >
            {t(`days.${dow as 0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
          </div>
        ))}
      </div>

      {/* ─── 6 × 7 grid ─── */}
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === currentMonth;
          const isToday = sameDay(d, today);
          const cellEvents = byDay.get(ymd(d)) ?? [];
          const visible = cellEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const hidden = Math.max(0, cellEvents.length - MAX_VISIBLE_PER_DAY);
          const rowBoundary = idx % 7 !== 0 ? "border-s" : "";
          const colBoundary = idx >= 7 ? "border-t" : "";

          return (
            <Link
              key={d.toISOString()}
              href={`/appointments?view=day&date=${ymd(d)}` as never}
              className={`group border-border/60 hover:bg-muted/30 relative block min-h-[110px] p-2 transition ${rowBoundary} ${colBoundary} ${
                !inMonth ? "bg-muted/10" : ""
              } ${isToday ? "bg-primary/5" : ""}`}
            >
              <div
                className={`num text-xs font-semibold ${
                  isToday
                    ? "text-primary"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {d.getDate()}
                {isToday && " ●"}
              </div>

              <div className="mt-1 space-y-0.5">
                {visible.map((ev) => {
                  const cancelled = ev.status === AppointmentStatus.CANCELLED;
                  return (
                    <div
                      key={ev.id}
                      className={`overflow-hidden rounded px-1.5 py-0.5 text-[10px] leading-tight ring-1 ring-black/5 ${
                        cancelled ? "opacity-60 line-through" : ""
                      }`}
                      style={{
                        backgroundColor: cancelled ? undefined : `${ev.dentistColor}1A`,
                        borderInlineStartWidth: cancelled ? 0 : 3,
                        borderInlineStartStyle: "solid",
                        borderInlineStartColor: ev.dentistColor,
                      }}
                      title={`${ev.patientName} — ${ev.reason ?? ""}`}
                    >
                      <span className="num font-semibold">
                        {String(ev.startAt.getHours()).padStart(2, "0")}:
                        {String(ev.startAt.getMinutes()).padStart(2, "0")}
                      </span>{" "}
                      <span className="truncate">{ev.patientName}</span>
                    </div>
                  );
                })}
                {hidden > 0 && (
                  <div className="text-muted-foreground text-[10px]">
                    +{hidden}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
