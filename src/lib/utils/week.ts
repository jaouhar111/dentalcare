/**
 * Time helpers for the appointment calendar.
 *
 * `weekDays` produces an array of 6 Date objects (Mon→Sat) covering the
 * working week that contains `anchor`. The cabinet is closed on Sunday in
 * the mockup so we skip it; if a clinic wants Sunday later we drop this.
 */

export function startOfWeek(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  // Monday = 1; for Sunday (0) we want to back up 6 days to previous Mon.
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function endOfWeek(anchor: Date): Date {
  // End is exclusive (start of Sunday).
  const s = startOfWeek(anchor);
  return addDays(s, 7);
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 6 }, (_, i) => addDays(start, i)); // Mon..Sat
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Combine a yyyy-mm-dd date and HH:mm time into an ISO string in local TZ. */
export function combineLocalDateTime(dateYmd: string, timeHm: string): string {
  // Build "yyyy-mm-ddTHH:mm:00" — interpreted as LOCAL time, then converted to ISO UTC.
  const local = new Date(`${dateYmd}T${timeHm}:00`);
  return local.toISOString();
}

/** Inverse of combineLocalDateTime — produces the local yyyy-mm-dd + HH:mm pair. */
export function splitLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

/** Minutes since 00:00 (local) for an event Date — used to compute offsets in the grid. */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Start of `anchor`'s month, time 00:00 local. */
export function startOfMonth(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

/** First day after the last day of `anchor`'s month (exclusive end). */
export function endOfMonth(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
}

/**
 * 6 weeks × 7 days starting from the Monday of the week containing the 1st
 * of the month. Days outside the current month are still included (greyed
 * out by the renderer) so the grid always has a stable 6-row height.
 */
export function monthGridDays(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}
