import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/confirm-appointment",
  "/waitlist-respond",
];
const LOCALES = routing.locales;

function stripLocale(pathname: string): { locale: string; rest: string } {
  for (const l of LOCALES) {
    if (pathname === `/${l}` || pathname === `/${l}/`) return { locale: l, rest: "/" };
    if (pathname.startsWith(`/${l}/`)) return { locale: l, rest: pathname.slice(l.length + 1) };
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

function isPublic(rest: string): boolean {
  return PUBLIC_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`));
}

export default async function proxy(req: NextRequest) {
  const { rest, locale } = stripLocale(req.nextUrl.pathname);

  // Public paths: just let next-intl handle locale detection and redirects.
  if (isPublic(rest)) {
    return intlMiddleware(req);
  }

  const session = await auth();
  if (!session?.user) {
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
