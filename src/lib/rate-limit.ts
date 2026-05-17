/**
 * Distributed rate limiting (Upstash) with an in-memory fallback for dev.
 *
 * # Why two backends
 *
 * On Vercel each request can land on a different serverless worker, so
 * counters held in process memory don't survive. Upstash Redis gives us a
 * shared counter that works regardless of how many lambdas are warm.
 *
 * In dev (single `pnpm dev` worker) we can use a simple in-memory Map — same
 * semantics, zero setup. The two backends expose the same surface so
 * callers don't care which one is active.
 *
 * # Named limiters
 *
 * We expose four named buckets, each tuned to a specific abuse surface:
 *   - `auth`        5 req / 15 min per (IP + email)     — login + reset
 *   - `share`       10 req / hour per (clinic + IP)      — invoice/prescription PDF share
 *   - `passwordReset` 3 req / hour per (IP + email)     — forgot-password form
 *   - `api`         60 req / min per IP                  — general API surface
 *
 * Adding a new limiter? Add a `LimiterName` entry and a config row below.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export type LimiterName = "auth" | "share" | "passwordReset" | "api";

interface LimiterConfig {
  /// Number of requests allowed in the window.
  max: number;
  /// Window length passed to Upstash's `slidingWindow` ("15 m", "1 h", "60 s"…).
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  /// Used as a prefix in Redis keys so different limiters don't collide.
  prefix: string;
}

const CONFIG: Record<LimiterName, LimiterConfig> = {
  auth: { max: 5, window: "15 m", prefix: "rl:auth" },
  share: { max: 10, window: "1 h", prefix: "rl:share" },
  passwordReset: { max: 3, window: "1 h", prefix: "rl:pwreset" },
  api: { max: 60, window: "1 m", prefix: "rl:api" },
};

// ─── Upstash backend ───────────────────────────────────────────────────────

let upstashRedis: Redis | null = null;
const upstashLimiters = new Map<LimiterName, Ratelimit>();

function getUpstashRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (upstashRedis) return upstashRedis;
  upstashRedis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return upstashRedis;
}

function getUpstashLimiter(name: LimiterName): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  const cached = upstashLimiters.get(name);
  if (cached) return cached;
  const cfg = CONFIG[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.max, cfg.window),
    prefix: cfg.prefix,
    analytics: true, // surfaces a per-day report in the Upstash dashboard
  });
  upstashLimiters.set(name, limiter);
  return limiter;
}

// ─── In-memory backend (dev only) ──────────────────────────────────────────

interface MemoryBucket {
  hits: number[];
}

const memoryBuckets = new Map<string, MemoryBucket>();

function windowMillis(window: LimiterConfig["window"]): number {
  const [n, unit] = window.split(" ");
  const value = Number(n);
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return value * 1000;
  }
}

function memoryLimit(name: LimiterName, key: string): {
  success: boolean;
  remaining: number;
  reset: number;
} {
  const cfg = CONFIG[name];
  const winMs = windowMillis(cfg.window);
  const now = Date.now();
  const bucketKey = `${cfg.prefix}:${key}`;
  const bucket = memoryBuckets.get(bucketKey) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > now - winMs);
  if (bucket.hits.length >= cfg.max) {
    const oldest = bucket.hits[0];
    memoryBuckets.set(bucketKey, bucket);
    return { success: false, remaining: 0, reset: oldest + winMs };
  }
  bucket.hits.push(now);
  memoryBuckets.set(bucketKey, bucket);
  return { success: true, remaining: cfg.max - bucket.hits.length, reset: now + winMs };
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  /// How many requests are still allowed in the current window.
  remaining: number;
  /// UNIX millis at which the next slot becomes available.
  reset: number;
  /// Which backend served this decision — useful for ops dashboards.
  backend: "upstash" | "memory";
}

/**
 * Check + record a single hit for the given `(limiter, key)`.
 * Returns whether the request is allowed. The hit is consumed even on
 * failure (so repeated denied requests don't reset the window early).
 */
export async function rateLimit(
  name: LimiterName,
  key: string,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(name);
  if (upstash) {
    const r = await upstash.limit(key);
    return {
      success: r.success,
      remaining: r.remaining,
      reset: r.reset,
      backend: "upstash",
    };
  }
  return { ...memoryLimit(name, key), backend: "memory" };
}

/**
 * Extract a best-effort client IP from a request — used as the key (often
 * combined with email/userId) for limiters.
 *
 * On Vercel the trusted source is `x-forwarded-for`; locally `request.ip` is
 * undefined so we fall back to a constant marker. Never trust the resulting
 * value for security decisions beyond rate limiting.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMIT_CONFIG = CONFIG;
