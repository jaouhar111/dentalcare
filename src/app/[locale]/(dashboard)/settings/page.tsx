import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getClinic } from "@/server/actions/clinic";
import { SettingsForm } from "./settings-form";
import { SubscriptionCard } from "./subscription-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN]);
  const t = await getTranslations("Settings");

  const clinic = await getClinic();
  if (!clinic) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          Clinic not found.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="page-h1">{t("title")}</h1>
        <p className="page-sub">{t("subtitle")}</p>
      </header>

      {/* ── Subscription card — plan + countdown progress ───── */}
      <SubscriptionCard
        status={clinic.subscriptionStatus}
        plan={clinic.plan}
        trialEndsAt={clinic.trialEndsAt}
        createdAt={clinic.createdAt}
        locale={locale}
      />

      <SettingsForm
        clinic={{
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email,
          vatNumber: clinic.vatNumber,
          logoUrl: clinic.logoUrl,
          defaultLocale: clinic.defaultLocale,
          invoiceStartingNumber: clinic.invoiceStartingNumber,
        }}
      />

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href={"/users" as never}
          className="bg-card border-border/60 hover:border-primary/40 block rounded-xl border p-4 text-sm transition"
        >
          <div className="text-foreground font-semibold">→ Utilisateurs</div>
          <p className="text-muted-foreground mt-0.5 text-xs">Gérer les comptes du cabinet</p>
        </Link>
        <Link
          href={"/dentists" as never}
          className="bg-card border-border/60 hover:border-primary/40 block rounded-xl border p-4 text-sm transition"
        >
          <div className="text-foreground font-semibold">→ Dentistes</div>
          <p className="text-muted-foreground mt-0.5 text-xs">Horaires, absences, couleurs</p>
        </Link>
        <Link
          href={"/settings/treatments" as never}
          className="bg-card border-border/60 hover:border-primary/40 block rounded-xl border p-4 text-sm transition"
        >
          <div className="text-foreground font-semibold">→ Traitements</div>
          <p className="text-muted-foreground mt-0.5 text-xs">Catalogue + tarifs</p>
        </Link>
      </div>
    </div>
  );
}
