import { cache } from "react";
import NextAuth from "next-auth";
import { authConfig } from "./config";

const nextAuth = NextAuth(authConfig);
export const { handlers, signIn, signOut } = nextAuth;

/**
 * Per-request memoised `auth()`.
 *
 * Auth.js v5's `auth()` decodes + verifies the JWT cookie on every
 * call (~50-200ms each). Most pages invoke it 2-3 times per request:
 *   - middleware (proxy.ts) — to guard the route
 *   - `requireRole(...)` in the page itself
 *   - sometimes again inside a nested Server Action
 *
 * Wrapping with React's `cache()` dedupes all calls within the same
 * Server Component render (one request = one decode). The middleware
 * is OUTSIDE that lifecycle so it still pays its own decode, but it
 * was already only paying one — the real waste was inside the page.
 *
 * Net impact: ~400-600ms saved per protected page on the hot path.
 */
export const auth = cache(nextAuth.auth);
