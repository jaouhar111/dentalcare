"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * Apple.com-grade global navigation.
 *
 * Fixed 44px translucent dark bar with backdrop-filter blur — the exact
 * vocabulary apple.com uses. The bar background is `rgba(22, 22, 23, 0.8)`
 * (Apple's "midnight" near-black, not pure black) with a saturate(180%)
 * blur(20px) backdrop. SF Pro at 12px / 400, link opacity 0.88 → 1 on
 * hover.
 *
 * Content is split into three zones:
 *   - Left: small wordmark
 *   - Center: marketing links (hidden on mobile)
 *   - Right: locale toggle + auth CTAs
 */
export function LandingNav({
  dashboardHref,
  locale,
}: {
  dashboardHref: string | null;
  locale: string;
}) {
  const t = useTranslations("Landing.nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const otherLocale = locale === "fr" ? "en" : "fr";

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50"
      style={{
        height: 44,
        background: scrolled ? "rgba(22, 22, 23, 0.82)" : "rgba(22, 22, 23, 0.72)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        fontFamily: "var(--lp-font-system)",
      }}
    >
      <div className="mx-auto flex h-full max-w-[1024px] items-center justify-between px-4 md:px-6">
        <Link
          href={"/" as never}
          className="flex items-center gap-1.5 text-white opacity-90 transition-opacity hover:opacity-100"
          aria-label="DentalCare"
        >
          <svg viewBox="0 0 64 64" className="size-[18px]" fill="currentColor" aria-hidden>
            <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
          </svg>
          <span className="text-[14px] font-medium tracking-tight">DentalCare</span>
        </Link>

        <ul className="hidden items-center gap-7 text-[12px] font-normal text-white/85 md:flex">
          <li>
            <Link href={"#story" as never} className="transition-opacity hover:text-white">
              {t("overview")}
            </Link>
          </li>
          <li>
            <Link href={"#features" as never} className="transition-opacity hover:text-white">
              {t("features")}
            </Link>
          </li>
          <li>
            <Link href={"#demo" as never} className="transition-opacity hover:text-white">
              {t("demo")}
            </Link>
          </li>
          <li>
            <Link href={"#pricing" as never} className="transition-opacity hover:text-white">
              {t("pricing")}
            </Link>
          </li>
          <li>
            <a
              href="mailto:support@dentalcare.ma"
              className="transition-opacity hover:text-white"
            >
              {t("contact")}
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-5 text-[12px] font-normal text-white/85">
          <Link
            href={"/" as never}
            locale={otherLocale}
            className="hidden transition-opacity hover:text-white sm:inline"
          >
            {otherLocale.toUpperCase()}
          </Link>
          {dashboardHref ? (
            <Link
              href={dashboardHref as never}
              className="transition-opacity hover:text-white"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <>
              <Link
                href={"/login" as never}
                className="hidden transition-opacity hover:text-white sm:inline"
              >
                {t("login")}
              </Link>
              <Link
                href={"/signup" as never}
                className="transition-opacity hover:text-white"
              >
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
