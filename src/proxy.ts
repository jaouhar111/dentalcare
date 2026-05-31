import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/confirm-appointment",
  "/waitlist-respond",
];
const LOCALES = routing.locales;

/**
 * Cookie names Auth.js uses for the session token. Prod (HTTPS) sets
 * the `__Secure-` prefix; dev (HTTP) uses the bare name. We accept
 * both so the gate works in either environment.
 */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function stripLocale(pathname: string): { locale: string; rest: string } {
  for (const l of LOCALES) {
    if (pathname === `/${l}` || pathname === `/${l}/`) return { locale: l, rest: "/" };
    if (pathname.startsWith(`/${l}/`)) return { locale: l, rest: pathname.slice(l.length + 1) };
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

function isPublic(rest: string): boolean {
  // Root URL `/` is the public marketing landing page — open to all.
  if (rest === "/" || rest === "") return true;
  return PUBLIC_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`));
}

/**
 * Edge middleware — runs on every protected request. The previous
 * implementation called `auth()` here, which decodes + verifies the
 * JWT (~150-300ms). The page-level `requireRole(...)` does the same
 * verification anyway, so doing it twice was pure waste.
 *
 * New strategy: in the middleware, we only check whether the session
 * cookie EXISTS (~0ms). If absent → 302 to /login. If present, we
 * forward through to the page, where the real verification + role
 * check happens. A spoofed / expired cookie still gets rejected by
 * the page-level `auth()` (which now also benefits from React's
 * `cache()` so it runs at most once per request).
 */
export default async function proxy(req: NextRequest) {
  const { rest, locale } = stripLocale(req.nextUrl.pathname);

  if (isPublic(rest)) {
    return intlMiddleware(req);
  }

  const hasSession = SESSION_COOKIE_NAMES.some((name) =>
    req.cookies.has(name),
  );
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
