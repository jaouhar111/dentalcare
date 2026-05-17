import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listDentists } from "@/server/actions/dentists";
import { listAppointments, type AppointmentListItem } from "@/server/actions/appointments";
import { activeWaitlistCount } from "@/server/actions/waitlist";
import { db } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/rbac";
import { UserRole } from "@prisma/client";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  minutesSinceMidnight,
  monthGridDays,
  sameDay,
  startOfMonth,
  startOfWeek,
  weekDays,
} from "@/lib/utils/week";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { WeekGrid } from "./week-grid";
import { MonthGrid } from "./month-grid";

export const dynamic = "force-dynamic";

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseView(raw: string | undefined): CalendarView {
  return raw === "day" || raw === "month" ? raw : "week";
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; dentists?: string; view?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { date: rawDate, dentists: rawDentists, view: rawView } = await searchParams;

  const t = await getTranslations("Appointments");
  const me = await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const isDentistView = me.role === UserRole.DENTIST && !!me.dentistId;

  const view = parseView(rawView);
  const anchor = parseDate(rawDate);
  const today = new Date();

  // ─── Compute visible window per view ───
  let rangeStart: Date;
  let rangeEnd: Date; // exclusive
  let isToday: boolean;
  if (view === "day") {
    rangeStart = new Date(anchor);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = addDays(rangeStart, 1);
    isToday = sameDay(anchor, today);
  } else if (view === "month") {
    rangeStart = startOfMonth(anchor);
    rangeEnd = endOfMonth(anchor);
    isToday = anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
  } else {
    rangeStart = startOfWeek(anchor);
    rangeEnd = endOfWeek(anchor);
    isToday = sameDay(startOfWeek(today), rangeStart);
  }

  // Dentists are needed both for the legend and to translate filter param.
  const dentistsResult = await listDentists();
  const allActiveDentists = dentistsResult.ok ? dentistsResult.data.filter((d) => d.isActive) : [];

  // A DENTIST user only ever sees their own row + can't pick other dentists
  // from the filter dropdown. ADMIN + RECEPTIONIST keep the full directory.
  const allDentists = isDentistView
    ? allActiveDentists.filter((d) => d.id === me.dentistId)
    : allActiveDentists;

  const selectedDentistIds = isDentistView
    ? new Set([me.dentistId!])
    : new Set(rawDentists ? rawDentists.split(",").filter(Boolean) : []);
  const dentistsToShow =
    selectedDentistIds.size === 0 ? allDentists.map((d) => d.id) : Array.from(selectedDentistIds);

  // Empty state if no dentists at all.
  if (allDentists.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6 lg:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="bg-card border-border/60 mt-6 rounded-xl border p-10 text-center">
          <p className="text-foreground text-base font-medium">{t("noDentists")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("noDentistsDesc")}</p>
          <Link
            href={"/dentists/new" as never}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
          >
            + {t("new")}
          </Link>
        </div>
      </div>
    );
  }

  // Fetch appointments for the visible window. For the month view we need the
  // full grid window (which can extend ~6 days into prev/next month) so events
  // appear in those leading/trailing cells too.
  const fetchStart = view === "month" ? monthGridDays(anchor)[0]! : rangeStart;
  const fetchEnd =
    view === "month" ? addDays(monthGridDays(anchor)[41]!, 1) : rangeEnd;

  const apptsResult = await listAppointments({
    from: fetchStart.toISOString(),
    to: fetchEnd.toISOString(),
    dentistIds: dentistsToShow.length > 0 ? dentistsToShow : undefined,
  });
  const events = apptsResult.ok ? apptsResult.data : [];

  // Header subtitle.
  let subtitle: string;
  if (view === "day") {
    subtitle = t("subtitleDay", {
      date: anchor.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      count: events.length,
    });
  } else if (view === "month") {
    subtitle = t("subtitleMonth", {
      month: anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      count: events.length,
    });
  } else {
    const startFmt = rangeStart.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const endFmt = new Date(rangeEnd.getTime() - 86_400_000).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    subtitle = t("subtitle", { from: startFmt, to: endFmt, count: events.length });
  }

  const waitlistCount = await activeWaitlistCount();

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground num mt-0.5 text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={"/waitlist" as never}
            className="border-input hover:bg-muted bg-background text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25"
              />
            </svg>
            {t("waitlist")}
            {waitlistCount > 0 && (
              <span className="num ms-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {waitlistCount}
              </span>
            )}
          </Link>
          <Link
            href={"/appointments/new" as never}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
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
            {t("new")}
          </Link>
        </div>
      </header>

      <CalendarToolbar
        view={view}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        anchor={anchor}
        isToday={isToday}
        dentists={allDentists.map((d) => ({
          id: d.id,
          name: `${d.firstName} ${d.lastName}`,
          color: d.color,
        }))}
        selectedDentistIds={selectedDentistIds}
        totalAppointments={events.length}
      />

      {view === "month" ? (
        <MonthGrid
          days={monthGridDays(anchor)}
          events={events}
          monthAnchor={anchor}
        />
      ) : (
        <WeekViewBody
          days={view === "day" ? [rangeStart] : weekDays(anchor)}
          events={events}
          dentistsToShow={dentistsToShow}
          allDentists={allDentists}
          selectedDentistIds={selectedDentistIds}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      )}

      {/* ─── Waitlist banner ─── */}
      {waitlistCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <svg
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292"
            />
          </svg>
          <div className="flex-1 text-sm">
            <div className="num font-medium text-amber-900 dark:text-amber-200">
              {waitlistCount} {t("waitlistBanner.title")}
            </div>
            <div className="mt-0.5 text-amber-700 dark:text-amber-300">
              {t("waitlistBanner.desc")}
            </div>
          </div>
          <Link
            href={"/waitlist" as never}
            className="self-center text-sm font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
          >
            →
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Day + Week share the same renderer (WeekGrid). The grid is parameterised by
 * the number of columns (`days.length`), so 1 = day view, 6 = week view.
 */
async function WeekViewBody({
  days,
  events,
  dentistsToShow,
  allDentists,
  selectedDentistIds,
  rangeStart,
  rangeEnd,
}: {
  days: Date[];
  events: AppointmentListItem[];
  dentistsToShow: string[];
  allDentists: Array<{ id: string }>;
  selectedDentistIds: Set<string>;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const today = new Date();
  const dayMeta = days.map((d) => ({ date: d, isToday: sameDay(d, today) }));

  const schedules = await db.workingSchedule.findMany({
    where: { dentistId: { in: dentistsToShow } },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  });

  const toMin = (s: string) => {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const workingRanges = schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startMin: toMin(s.startTime),
    endMin: toMin(s.endTime),
  }));

  const absences = await db.dentistAbsence.findMany({
    where: {
      dentistId: { in: dentistsToShow },
      startAt: { lt: rangeEnd },
      endAt: { gt: rangeStart },
    },
    select: { startAt: true, endAt: true },
  });

  const absencesByDay: Record<number, Array<{ startMin: number; endMin: number }>> = {};
  for (const a of absences) {
    for (const dm of dayMeta) {
      const dayStart = new Date(dm.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dm.date);
      dayEnd.setHours(23, 59, 59, 999);
      const overlapStart = a.startAt > dayStart ? a.startAt : dayStart;
      const overlapEnd = a.endAt < dayEnd ? a.endAt : dayEnd;
      if (overlapStart < overlapEnd) {
        const dow = dm.date.getDay();
        (absencesByDay[dow] ??= []).push({
          startMin: minutesSinceMidnight(overlapStart),
          endMin: minutesSinceMidnight(overlapEnd),
        });
      }
    }
  }

  return (
    <WeekGrid
      days={dayMeta}
      events={events}
      workingRanges={workingRanges}
      absencesByDay={absencesByDay}
      hasDentistFilter={
        selectedDentistIds.size > 0 && selectedDentistIds.size < allDentists.length
      }
    />
  );
}
