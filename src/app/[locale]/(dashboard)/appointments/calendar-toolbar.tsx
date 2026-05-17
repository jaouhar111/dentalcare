"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

export type CalendarView = "day" | "week" | "month";

interface DentistOption {
  id: string;
  name: string;
  color: string;
}

export function CalendarToolbar({
  view,
  rangeStart,
  rangeEnd,
  anchor,
  isToday,
  dentists,
  selectedDentistIds,
  totalAppointments,
}: {
  view: CalendarView;
  /** Inclusive start of the visible window. */
  rangeStart: Date;
  /** Exclusive end (start of the next window). */
  rangeEnd: Date;
  /** Reference date inside the current window — drives day/month label. */
  anchor: Date;
  isToday: boolean;
  dentists: DentistOption[];
  selectedDentistIds: Set<string>;
  totalAppointments: number;
}) {
  const t = useTranslations("Appointments");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function ymd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function buildHref(date: Date | "today", nextView?: CalendarView): string {
    const params = new URLSearchParams(searchParams.toString());
    if (date === "today") params.delete("date");
    else params.set("date", ymd(date));
    if (nextView && nextView !== "week") params.set("view", nextView);
    else if (nextView === "week") params.delete("view");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function toggleDentist(id: string): string {
    const params = new URLSearchParams(searchParams.toString());
    const next = new Set(selectedDentistIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0 || next.size === dentists.length) {
      params.delete("dentists");
    } else {
      params.set("dentists", Array.from(next).join(","));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // ─── Compute prev/next anchor + visible label per view ───
  const prev = new Date(anchor);
  const next = new Date(anchor);
  let label: string;

  if (view === "day") {
    prev.setDate(prev.getDate() - 1);
    next.setDate(next.getDate() + 1);
    label = anchor.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (view === "month") {
    prev.setMonth(prev.getMonth() - 1);
    next.setMonth(next.getMonth() + 1);
    label = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } else {
    prev.setDate(prev.getDate() - 7);
    next.setDate(next.getDate() + 7);
    const sameMonth = rangeStart.getMonth() === new Date(rangeEnd.getTime() - 86_400_000).getMonth();
    const last = new Date(rangeEnd.getTime() - 86_400_000);
    const startStr = sameMonth
      ? rangeStart.getDate()
      : rangeStart.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const endStr = last.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    label = `${startStr} — ${endStr}`;
  }

  const todayLabel =
    view === "day" ? t("today") : view === "month" ? t("thisMonth") : t("today");

  return (
    <div className="bg-card border-border/60 mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3">
      {/* Prev / Today / Next */}
      <div className="border-input flex items-center overflow-hidden rounded-lg border">
        <Link
          href={buildHref(prev) as never}
          aria-label={t("previous")}
          className="hover:bg-muted text-muted-foreground px-3 py-1.5"
        >
          <svg
            className="size-4 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <Link
          href={buildHref("today") as never}
          className={`border-input hover:bg-muted border-x px-3 py-1.5 text-sm font-medium ${
            isToday ? "text-primary" : "text-foreground"
          }`}
        >
          {todayLabel}
        </Link>
        <Link
          href={buildHref(next) as never}
          aria-label={t("next")}
          className="hover:bg-muted text-muted-foreground px-3 py-1.5"
        >
          <svg
            className="size-4 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      <div className="num font-semibold tracking-tight">{label}</div>
      <div className="text-muted-foreground num text-sm">· {totalAppointments} RDV</div>

      <div className="ml-auto flex items-center gap-3">
        {/* View switcher */}
        <div className="bg-muted inline-flex items-center rounded-lg p-0.5">
          {(["day", "week", "month"] as const).map((v) => {
            const active = v === view;
            return (
              <Link
                key={v}
                href={buildHref(anchor, v) as never}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                {t(`view.${v}`)}
              </Link>
            );
          })}
        </div>

        {/* Dentist checkboxes */}
        <div className="flex flex-wrap items-center gap-2">
          {dentists.map((d) => {
            const active = selectedDentistIds.size === 0 || selectedDentistIds.has(d.id);
            return (
              <Link
                key={d.id}
                href={toggleDentist(d.id) as never}
                className={`flex items-center gap-1.5 text-xs transition ${
                  active ? "text-foreground" : "text-muted-foreground/50 line-through"
                }`}
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: d.color, opacity: active ? 1 : 0.3 }}
                  aria-hidden
                />
                Dr {d.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
