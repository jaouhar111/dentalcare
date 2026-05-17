/**
 * In-memory rate limiter for V1 (cf. plan T1.4).
 * Tracks failed login attempts per IP in a sliding 15-minute window.
 *
 * V2: replace with Upstash Ratelimit for multi-instance safety. The function
 * signatures stay the same so callers don't need to change.
 */

interface Bucket {
  /** UNIX millis of recent failures within the window. */
  hits: number[];
  /** Optional explicit lock-until timestamp (millis). */
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 min lock after threshold

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { hits: [], lockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function prune(b: Bucket, now: number) {
  const threshold = now - WINDOW_MS;
  b.hits = b.hits.filter((t) => t > threshold);
}

/**
 * Check whether a key (typically an IP, optionally combined with email) is currently
 * allowed to attempt. Pure function — does NOT increment.
 */
export function isAllowed(
  key: string,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const b = getBucket(key);
  if (b.lockedUntil > now) {
    return { allowed: false, retryAfterMs: b.lockedUntil - now };
  }
  prune(b, now);
  if (b.hits.length >= MAX_FAILURES) {
    b.lockedUntil = now + LOCK_MS;
    return { allowed: false, retryAfterMs: LOCK_MS };
  }
  return { allowed: true };
}

/** Record a failed attempt for the key. Returns the resulting bucket size. */
export function recordFailure(key: string): number {
  const now = Date.now();
  const b = getBucket(key);
  prune(b, now);
  b.hits.push(now);
  if (b.hits.length >= MAX_FAILURES) {
    b.lockedUntil = now + LOCK_MS;
  }
  return b.hits.length;
}

/** Clear all tracked failures for the key (use on successful login). */
export function reset(key: string): void {
  buckets.delete(key);
}

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS,
  MAX_FAILURES,
  LOCK_MS,
} as const;
