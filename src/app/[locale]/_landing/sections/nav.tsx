"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * Windows 11 Fluent global navigation.
 *
 * Floats as a centered pill (Win11 Taskbar inspiration) with acrylic
 * background, soft shadow, and 1px stroke. Text stays near-black for
 * Mica legibility. Links lift via a subtle hover background — the
 * "Reveal" effect from Fluent. Lifts slightly when the page scrolls
 * to telegraph attachment to the Mica surface.
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
      className="fixed inset-x-0 top-3 z-50 flex justify-center px-3"
      style={{ fontFamily: "var(--lp-font-system)" }}
    >
      <div
        className="win11-card flex h-14 w-full max-w-[1100px] items-center gap-2 px-2 transition-all md:gap-4 md:px-3"
        style={{
          borderRadius: 14,
          boxShadow: scrolled
            ? "0 1px 0 rgba(255,255,255,0.8) inset, 0 -1px 0 rgba(0,0,0,0.04) inset, 0 18px 40px -16px rgba(0,0,0,0.24), 0 6px 12px rgba(0,0,0,0.06)"
            : "0 1px 0 rgba(255,255,255,0.8) inset, 0 -1px 0 rgba(0,0,0,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── Brand cluster ─────────────────────────────────────── */}
        <Link
          href={"/" as never}
          className="text-[var(--lp-ink)] group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.04]"
          aria-label="DentalCare"
        >
          <span
            className="relative grid size-9 place-items-center rounded-[10px] text-white"
            style={{
              background:
                "linear-gradient(135deg, #2fe675 0%, #128c7e 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.18) inset, 0 6px 14px -4px rgba(37,211,102,0.45)",
            }}
            aria-hidden
          >
            <svg viewBox="0 0 64 64" className="size-5" fill="currentColor">
              <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
            </svg>
            <span
              className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full"
              style={{
                background: "#34d399",
                boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 0 8px rgba(52,211,153,0.6)",
              }}
              aria-hidden
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight">DentalCare</span>
            <span className="text-[10px] font-medium tracking-[0.06em] text-[#128c7e] uppercase">
              Receptionist IA
            </span>
          </span>
        </Link>

        {/* ── Center vertical divider ───────────────────────────── */}
        <span
          className="mx-1 hidden h-7 w-px bg-black/[0.08] md:block"
          aria-hidden
        />

        {/* ── Center navigation links ───────────────────────────── */}
        <ul className="text-[var(--lp-ink-muted)] hidden flex-1 items-center gap-0.5 text-[13px] md:flex">
          <NavLink href="#story" label={t("overview")} />
          <NavLink href="#features" label={t("features")} />
          <NavLink href="#demo" label={t("demo")} />
          <NavLink href="#pricing" label={t("pricing")} />
          <li>
            <a
              href="mailto:support@dentalcare.ma"
              className="text-[var(--lp-ink-muted)] hover:text-[var(--lp-ink)] hover:bg-black/[0.04] inline-block rounded-md px-3 py-1.5 transition-colors"
            >
              {t("contact")}
            </a>
          </li>
        </ul>

        {/* ── Right cluster — locale + CTA ──────────────────────── */}
        <div className="ml-auto flex items-center gap-2 text-[13px]">
          {/* Trial chip — broadcasts the value-prop right in the nav */}
          {dashboardHref ? null : (
            <span
              className="hidden items-center gap-1.5 rounded-full border border-[#25d366]/30 bg-[#25d366]/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#128c7e] sm:inline-flex"
              aria-hidden
            >
              <span
                className="size-1.5 rounded-full bg-[#25d366]"
                style={{ boxShadow: "0 0 8px rgba(37,211,102,0.7)" }}
              />
              14 j gratuits
            </span>
          )}

          {/* Locale toggle as a pill */}
          <Link
            href={"/" as never}
            locale={otherLocale}
            className="text-[var(--lp-ink-muted)] hover:bg-black/[0.04] hover:text-[var(--lp-ink)] hidden rounded-md px-2.5 py-1.5 font-medium tracking-[0.04em] uppercase transition-colors sm:inline-block"
            aria-label={`Switch to ${otherLocale.toUpperCase()}`}
          >
            {otherLocale.toUpperCase()}
          </Link>

          {dashboardHref ? (
            <Link
              href={dashboardHref as never}
              className="win11-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-[13px]"
            >
              {t("dashboard")}
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <>
              <Link
                href={"/login" as never}
                className="text-[var(--lp-ink)] hidden rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-black/[0.04] sm:inline-block"
              >
                {t("login")}
              </Link>
              <Link
                href={"/signup" as never}
                className="win11-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-[13px]"
              >
                {t("signup")}
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href as never}
        className="text-[var(--lp-ink-muted)] hover:text-[var(--lp-ink)] group relative inline-block rounded-md px-3 py-2 font-medium transition-colors"
      >
        {label}
        <span
          aria-hidden
          className="absolute inset-x-3 bottom-1 h-0.5 origin-center scale-x-0 rounded-full bg-[#25d366] transition-transform duration-200 group-hover:scale-x-100"
        />
      </Link>
    </li>
  );
}
