import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SmoothScroll } from "./_landing/smooth-scroll";
import { LandingNav } from "./_landing/sections/nav";
import { Hero } from "./_landing/sections/hero";
import { TrustStrip } from "./_landing/sections/trust-strip";
import { Problem } from "./_landing/sections/problem";
import { HorizontalFeatures } from "./_landing/sections/horizontal-features";
import { Showcase } from "./_landing/sections/showcase";
import { PinnedDemo } from "./_landing/sections/pinned-demo";
import { Pricing } from "./_landing/sections/pricing";
import { Closing } from "./_landing/sections/closing";

export const dynamic = "force-dynamic";

/**
 * Public marketing landing page — apple.com vocabulary.
 *
 * Structure: a stack of rounded "story cards" alternating between
 * white, Apple gray (#f5f5f7), black, and very-soft cyan tint, the
 * way apple.com/iphone presents its product narrative. Each card is
 * inset by 12px so the dividing gap reads as part of the rhythm.
 *
 * Section order:
 *   - Hero       (white)  — wordmark, tagline, two CTAs, phone visual
 *   - TrustStrip (gray)   — three big numbers in a single card
 *   - Problem    (black)  — "Vous avez signé pour soigner."
 *   - Features   (white)  — 2×2 grid of tinted tiles, one dark
 *   - Demo       (gray)   — pinned chat scrub with caption column
 *   - Pricing    (white)  — three plan cards, middle one bordered blue
 *   - Closing    (black)  — final CTA, then thin compliance footer
 *
 * Logged-in users see the page too (no redirect) — useful as a
 * brochure to share with peers; the nav swaps "Essai gratuit" for
 * "Mon dashboard" when a session exists.
 */
export default async function MarketingHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const dashboardHref = session?.user
    ? session.user.role === "SUPER_ADMIN"
      ? "/super-admin"
      : "/dashboard"
    : null;

  return (
    <div className="lp-light min-h-screen">
      <SmoothScroll />
      <LandingNav dashboardHref={dashboardHref} locale={locale} />
      <main className="pt-16">
        <Hero />
        <TrustStrip />
        <Problem />
        <HorizontalFeatures />
        <Showcase />
        <PinnedDemo />
        <Pricing />
        <Closing />
      </main>
    </div>
  );
}
