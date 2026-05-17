/**
 * Tagged Result type for Server Actions and callable that might fail.
 *
 * Convention (see SPEC §5.3 & §7): every Server Action returns a Result,
 * never throws on a user-recoverable failure. Reserves throws for
 * truly exceptional/unexpected conditions.
 */
export type Result<T, E = ResultError> = { ok: true; data: T } | { ok: false; error: E };

export interface ResultError {
  code: string;
  message: string;
  /** Optional per-field validation errors (e.g. Zod fieldErrors). */
  fields?: Record<string, string[] | undefined>;
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function err<E = ResultError>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

/** Build a {@link ResultError} from a code + message (+ optional field map). */
export function fail(
  code: string,
  message: string,
  fields?: Record<string, string[] | undefined>,
): { ok: false; error: ResultError } {
  return { ok: false, error: { code, message, ...(fields ? { fields } : {}) } };
}
