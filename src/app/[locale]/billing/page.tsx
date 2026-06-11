import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * "Paywall" page — what a cabinet user lands on when their clinic's
 * subscription is PAST_DUE / CANCELLED / trial expired. Lives outside
 * the (dashboard) group so the layout-level subscription check doesn't
 * gate the page that explains the gate.
 *
 * Three states drive the copy:
 *   - PAST_DUE   → "Your last payment failed, please update billing"
 *   - CANCELLED  → "Subscription cancelled, contact support to reactivate"
 *   - TRIAL+expired → "Your free trial has ended, subscribe to continue"
 *
 * Once Stripe is wired, the CTA will deep-link into the Stripe Customer
 * Portal for self-service.
 */
export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login` as never);
  }
  // SUPER_ADMIN never lands here — bounce to the owner dashboard.
  if (session.user.role === UserRole.SUPER_ADMIN) {
    redirect(`/${locale}/super-admin` as never);
  }

  const clinic = await db.clinic.findUnique({
    where: { id: session.user.clinicId },
    select: {
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      email: true,
    },
  });
  if (!clinic) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          Cabinet introuvable.
        </div>
      </div>
    );
  }

  const trialExpired =
    clinic.subscriptionStatus === SubscriptionStatus.TRIAL &&
    clinic.trialEndsAt !== null &&
    clinic.trialEndsAt.getTime() < Date.now();

  // If the clinic is actually still in good standing, the user shouldn't
  // be on this page — send them home.
  const stillActive =
    !trialExpired &&
    (clinic.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      clinic.subscriptionStatus === SubscriptionStatus.TRIAL);
  if (stillActive) {
    redirect(`/${locale}/dashboard` as never);
  }

  const { title, subtitle, accent } = pickCopy(clinic.subscriptionStatus, trialExpired);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="card-glass w-full max-w-lg text-center">
        <div
          className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${accent.iconBg}`}
        >
          <svg
            className={`size-7 ${accent.icon}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={accent.iconPath} />
          </svg>
        </div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{subtitle}</p>

        <div className="text-muted-foreground mt-6 space-y-1 text-[12px]">
          <div>
            Cabinet : <span className="text-foreground font-medium">{clinic.name}</span>
          </div>
          {clinic.email ? <div>Contact : {clinic.email}</div> : null}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            disabled
            className="opacity-80"
            title="Stripe checkout — bientôt"
          >
            Reprendre l'abonnement
          </Button>
          <a
            href="mailto:support@dentalcare.ma"
            className="border-input bg-background hover:bg-accent inline-flex items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium"
          >
            Contacter le support
          </a>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/${locale}/login` as never });
          }}
          className="mt-4"
        >
          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}

function pickCopy(status: SubscriptionStatus, trialExpired: boolean) {
  if (status === SubscriptionStatus.PAST_DUE) {
    return {
      title: "Paiement échoué",
      subtitle:
        "Votre dernier paiement n'a pas pu être prélevé. L'accès au cabinet est suspendu jusqu'à la mise à jour de vos informations de facturation.",
      accent: {
        icon: "text-red-600 dark:text-red-300",
        iconBg: "bg-red-500/15",
        iconPath:
          "M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z",
      },
    };
  }
  if (status === SubscriptionStatus.CANCELLED) {
    return {
      title: "Abonnement annulé",
      subtitle:
        "Votre abonnement a été annulé. Contactez le support pour réactiver l'accès à votre cabinet.",
      accent: {
        icon: "text-slate-700 dark:text-slate-300",
        iconBg: "bg-slate-500/15",
        iconPath: "M18.364 18.364L5.636 5.636M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
    };
  }
  if (trialExpired) {
    return {
      title: "Essai gratuit terminé",
      subtitle:
        "Votre période d'essai de 30 jours est arrivée à terme. Souscrivez à un plan pour continuer à utiliser DentalCare.",
      accent: {
        icon: "text-amber-700 dark:text-amber-300",
        iconBg: "bg-amber-500/15",
        iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      },
    };
  }
  return {
    title: "Accès suspendu",
    subtitle: "Contactez le support pour rétablir l'accès.",
    accent: {
      icon: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-500/15",
      iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };
}
