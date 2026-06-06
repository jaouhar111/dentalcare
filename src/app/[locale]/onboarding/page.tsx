import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getOnboardingProgress } from "@/server/actions/onboarding";
import { getOpenwaConnectionState } from "@/server/actions/openwa-session";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

/**
 * Onboarding shell — server component that resolves the cabinet's
 * progress (which of the 5 steps are already done) so the client
 * wizard can jump directly to the first incomplete step.
 *
 * DENTIST / RECEPTIONIST users land here only if they navigate
 * directly; we bounce them to /dashboard since only the ADMIN can
 * configure these settings.
 */
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await requireRole([
    UserRole.ADMIN,
    UserRole.DENTIST,
    UserRole.RECEPTIONIST,
    UserRole.SUPER_ADMIN,
  ]);

  if (me.role !== UserRole.ADMIN) {
    redirect(`/${locale}/dashboard`);
  }

  const [res, openwaRes] = await Promise.all([
    getOnboardingProgress(),
    getOpenwaConnectionState(),
  ]);
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }
  if (res.data.completedAt) {
    // Already onboarded — no point staying on this page.
    redirect(`/${locale}/dashboard`);
  }

  // Pick the first incomplete step to focus on (the wizard skips ahead).
  let initialStep = 1;
  if (res.data.hasWhatsApp) initialStep = 2;
  if (res.data.hasWhatsApp && res.data.hasSchedule) initialStep = 3;
  if (res.data.hasWhatsApp && res.data.hasSchedule && res.data.hasDentist) initialStep = 4;
  // Step 5 (AI activation) is always the last step the user explicitly clicks.

  return (
    <div className="min-h-screen bg-[#fbfbfd] p-4 dark:bg-[#1c1c1e]">
      <div className="mx-auto max-w-3xl pt-8 md:pt-16">
        <OnboardingWizard
          initialStep={initialStep}
          progress={res.data}
          initialOpenwaState={openwaRes.ok ? openwaRes.data : null}
        />
      </div>
    </div>
  );
}
