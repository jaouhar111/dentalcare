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
 * Public marketing landing page — light theme, mirrors the dashboard.
 *
 * The whole page sits on the `.lp-premium` theme: the dashboard's own
 * Liquid-Glass mesh (near-white base with soft cyan/blue corner blobs)
 * and white cards (`win11-card`, the Apple-card recipe) with soft
 * shadows, hairline borders and DentalCare cyan accents — no black, no
 * green. Each section is inset by 12px so the gap reads as rhythm.
 *
 * Section order:
 *   - Hero       — wordmark, tagline, two CTAs, mock dashboard preview
 *   - TrustStrip — three gradient numbers in one card
 *   - Problem    — navy story panel with cyan halos
 *   - Features   — 2×2 card grid, one elevated dark tile
 *   - Showcase   — full-bleed cabinet photo in a card frame
 *   - Demo       — pinned chat scrub with caption column
 *   - Pricing    — three plan cards, middle one cyan-bordered
 *   - Closing    — final CTA panel, then thin compliance footer
 *
 * Logged-in users see the page too (no redirect) — useful as a
 * brochure to share with peers; the nav swaps the signup CTA for
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
    <div className="lp-premium min-h-screen">
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
