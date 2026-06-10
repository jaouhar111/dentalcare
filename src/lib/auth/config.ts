import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { verifyPassword } from "./password";
import { isAllowed, recordFailure, reset as resetRateLimit } from "./rate-limit";

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
  ip: z.string().optional(),
});

/**
 * Auth.js v5 config.
 *
 * Uses JWT sessions (no DB session table) — keeps Server Components fast
 * (no DB roundtrip on every request) and works in Edge.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        ip: {},
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password, ip } = parsed.data;
        const rateKey = `${ip ?? "unknown"}:${email}`;
        const guard = isAllowed(rateKey);
        if (!guard.allowed) return null;

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            passwordHash: true,
            role: true,
            fullName: true,
            clinicId: true,
            dentist: { select: { id: true } },
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          recordFailure(rateKey);
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
          recordFailure(rateKey);
          return null;
        }

        resetRateLimit(rateKey);

        // Touch last login (best-effort).
        await db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        return {
          id: user.id,
          email,
          name: user.fullName,
          role: user.role,
          clinicId: user.clinicId,
          dentistId: user.dentist?.id ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: unknown; clinicId?: unknown; dentistId?: unknown };
        if (u.role) token.role = u.role as typeof token.role;
        if (u.clinicId) token.clinicId = u.clinicId as typeof token.clinicId;
        if (u.dentistId) token.dentistId = u.dentistId as typeof token.dentistId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as typeof session.user.role;
        session.user.clinicId = token.clinicId as typeof session.user.clinicId;
        session.user.dentistId = token.dentistId as typeof session.user.dentistId;

        // ── Impersonation (support) ───────────────────────────────
        // Only a SUPER_ADMIN can impersonate, so every other account
        // skips this block entirely (no extra cost). Wrapped in
        // try/catch: a DB hiccup must never lock anyone out — we just
        // fall back to the real identity.
        if (token.role === "SUPER_ADMIN" && token.sub) {
          try {
            const sa = await db.user.findUnique({
              where: { id: token.sub },
              select: { impersonatedUserId: true, fullName: true },
            });
            if (sa?.impersonatedUserId) {
              const target = await db.user.findUnique({
                where: { id: sa.impersonatedUserId },
                select: {
                  id: true,
                  role: true,
                  clinicId: true,
                  fullName: true,
                  isActive: true,
                  dentist: { select: { id: true } },
                },
              });
              if (target && target.isActive && target.role !== "SUPER_ADMIN") {
                session.user.id = target.id;
                session.user.role = target.role;
                session.user.clinicId = target.clinicId;
                session.user.dentistId = target.dentist?.id ?? undefined;
                session.user.name = target.fullName;
                session.impersonator = { id: token.sub, name: sa.fullName };
              }
            }
          } catch {
            // fall back to the real super-admin identity
          }
        }
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      // /login is public; everything else under /[locale] requires auth (proxy handles redirect).
      if (path.match(/\/(fr|en|ar)\/(login|forgot-password|reset-password)/)) return true;
      if (path === "/" || path.match(/\/(fr|en|ar)\/?$/)) return true;
      return isLoggedIn;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
