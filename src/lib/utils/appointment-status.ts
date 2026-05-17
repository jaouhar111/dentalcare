import { AppointmentStatus } from "@prisma/client";

/**
 * Returns the status that should be *displayed* for an appointment, given the
 * current time. The DB still holds the user-set status (SCHEDULED / CONFIRMED
 * etc.) but rendering as "scheduled" for a meeting that started two hours ago
 * is misleading. Promotion rules:
 *
 *   - Terminal statuses (CANCELLED, NO_SHOW, COMPLETED, RESCHEDULE_REQUESTED)
 *     are returned as-is — they were explicitly set by a user and should not
 *     be overridden by the clock.
 *   - SCHEDULED / CONFIRMED / IN_PROGRESS rows are promoted by time:
 *       • now is inside [startAt, endAt) → IN_PROGRESS
 *       • now ≥ endAt                    → COMPLETED
 *       • otherwise (now < startAt)      → unchanged
 *
 * The DB row itself is not mutated — promotion happens purely at render time.
 * A background job could materialize these transitions later if needed.
 */
export function effectiveAppointmentStatus(
  status: AppointmentStatus,
  startAt: Date,
  endAt: Date,
  now: Date = new Date(),
): AppointmentStatus {
  if (
    status === AppointmentStatus.CANCELLED ||
    status === AppointmentStatus.NO_SHOW ||
    status === AppointmentStatus.COMPLETED ||
    status === AppointmentStatus.RESCHEDULE_REQUESTED
  ) {
    return status;
  }
  if (now >= endAt) return AppointmentStatus.COMPLETED;
  if (now >= startAt) return AppointmentStatus.IN_PROGRESS;
  return status;
}
