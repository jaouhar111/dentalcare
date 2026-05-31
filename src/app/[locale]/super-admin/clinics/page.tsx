import { setRequestLocale } from "next-intl/server";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getPlatformOverview } from "@/server/actions/super-admin";
import { ClinicRowActions } from "../_components/clinic-row-actions";

export const dynamic = "force-dynamic";

export default async function SuperAdminClinicsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const result = await getPlatformOverview();
  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const { clinics, totals } = result.data;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">Cabinets</h1>
          <p className="page-sub">
            <span className="num">{totals.clinicsTotal}</span> cabinets ·{" "}
            <span className="text-emerald-700 dark:text-emerald-300">{totals.active} actifs</span>{" "}
            ·{" "}
            <span className="text-amber-700 dark:text-amber-300">{totals.trialing} en essai</span>{" "}
            ·{" "}
            <span
              className={totals.pastDue > 0 ? "text-red-700 dark:text-red-300" : ""}
            >
              {totals.pastDue} impayés
            </span>
          </p>
        </div>
      </header>

      <section className="apple-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                <th className="py-2 pr-3">Cabinet</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Essai (j)</th>
                <th className="py-2 pr-3">Patients</th>
                <th className="py-2 pr-3">RDV à venir</th>
                <th className="py-2 pr-3">IA 7j</th>
                <th className="py-2 pr-3">Créé</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr
                  key={c.id}
                  className="border-border/40 hover:bg-accent border-b last:border-0"
                >
                  <td className="py-2 pr-3 font-medium">
                    <Link
                      href={`/super-admin/clinics/${c.id}` as never}
                      className="hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground py-2 pr-3 font-mono text-[11px]">
                    {c.slug}
                  </td>
                  <td className="text-muted-foreground py-2 pr-3 text-[11px]">{c.email}</td>
                  <td className="py-2 pr-3">
                    <SubscriptionBadge status={c.subscriptionStatus} />
                  </td>
                  <td className="num py-2 pr-3 text-[12px]">
                    {c.trialDaysRemaining === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : c.trialDaysRemaining <= 3 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-300">
                        {c.trialDaysRemaining}
                      </span>
                    ) : (
                      c.trialDaysRemaining
                    )}
                  </td>
                  <td className="num py-2 pr-3">{c.patients}</td>
                  <td className="num py-2 pr-3">{c.futureAppointments}</td>
                  <td className="num py-2 pr-3">{c.aiConversations7d}</td>
                  <td className="text-muted-foreground py-2 pr-3 text-[11px]">
                    {dateFmt.format(c.createdAt)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <ClinicRowActions
                      clinicId={c.id}
                      status={c.subscriptionStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const map: Record<SubscriptionStatus, { label: string; cls: string }> = {
    TRIAL: { label: "Essai", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    ACTIVE: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    PAST_DUE: { label: "Impayé", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
    CANCELLED: { label: "Annulé", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
