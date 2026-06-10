import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer";
import { NAV_SECTIONS } from "@/components/nav-data";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { LegalFooter } from "@/components/legal-footer";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { isRtl } from "@/i18n/routing";

/**
 * Admin shell — Liquid Glass pattern.
 *
 * The grid is wrapped by an outer `min-h-screen` flex column with inset
 * padding so both the sidebar and the topbar render as floating glass
 * cards instead of edge-attached panels (mirrors macOS Sonoma's Finder
 * window where chrome floats on top of the wallpaper).
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    // typedRoutes can't statically resolve the locale-prefixed path; cast to satisfy.
    redirect(`/${locale}/login` as never);
  }

  // Subscription paywall — SUPER_ADMIN passes (they need to be able to
  // diagnose blocked tenants). For everyone else, fetch the clinic's
  // subscription state and bounce to /billing when:
  //   - status is PAST_DUE or CANCELLED  (Stripe webhook flips it)
  //   - status is TRIAL and trialEndsAt is in the past (expired)
  // We DON'T gate the /billing page itself, otherwise the user couldn't
  // ever fix the situation.
  // Impersonators (a super-admin acting as a cabinet user) bypass the
  // billing + suspension gates so support is never locked out of the
  // cabinet they came to inspect.
  if (session.user.role !== UserRole.SUPER_ADMIN && !session.impersonator) {
    const clinic = await db.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        suspendedAt: true,
      },
    });
    if (clinic) {
      // Platform-owner suspension takes precedence over billing — a
      // suspended cabinet is fully locked out, not just paywalled.
      if (clinic.suspendedAt) {
        redirect(`/${locale}/suspended` as never);
      }
      const trialExpired =
        clinic.subscriptionStatus === SubscriptionStatus.TRIAL &&
        clinic.trialEndsAt !== null &&
        clinic.trialEndsAt.getTime() < Date.now();
      const blocked =
        clinic.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
        clinic.subscriptionStatus === SubscriptionStatus.CANCELLED ||
        trialExpired;
      // (The /billing page lives at /billing — see below.)
      if (blocked) {
        redirect(`/${locale}/billing` as never);
      }
    }
  }

  // Pre-translate the nav labels server-side and hand them to the
  // mobile drawer (a client component that can't call `getTranslations`
  // itself). Single fetch, then both desktop sidebar + mobile drawer
  // share the same wording.
  const tNav = await getTranslations("Nav");
  const allLabelKeys = new Set<string>();
  for (const section of NAV_SECTIONS) {
    allLabelKeys.add(section.title);
    for (const item of section.items) allLabelKeys.add(item.label);
  }
  const navLabels: Record<string, string> = {};
  for (const k of allLabelKeys) {
    navLabels[k] = tNav(k as never);
  }

  const clinic = await db.clinic.findUnique({
    where: { id: session.user.clinicId },
    select: { name: true, logoUrl: true },
  });

  return (
    <ConfirmDialogProvider>
      {session.impersonator ? (
        <ImpersonationBanner
          userName={session.user.name ?? null}
          clinicName={clinic?.name ?? null}
          impersonatorName={session.impersonator.name}
        />
      ) : null}
      <div className="md:grid md:grid-cols-[260px_1fr] md:gap-4 md:p-4 min-h-screen">
        <AppSidebar role={session.user.role} />
        <MobileSidebarDrawer
          role={session.user.role}
          clinicName={clinic?.name ?? "DentalCare"}
          logoUrl={clinic?.logoUrl ?? null}
          navLabels={navLabels}
        />
        <div className="flex min-w-0 flex-col gap-4 px-3 pt-3 md:px-0 md:pt-0">
          <AppTopbar
            fullName={session.user.name}
            email={session.user.email}
            role={session.user.role}
          />
          <main className="flex flex-1 flex-col">
            <div className="flex-1 px-1 pb-8 md:px-2 md:pb-0">{children}</div>
            <LegalFooter />
          </main>
        </div>
        <Toaster position={isRtl(locale) ? "top-left" : "top-right"} closeButton />
      </div>
    </ConfirmDialogProvider>
  );
}
