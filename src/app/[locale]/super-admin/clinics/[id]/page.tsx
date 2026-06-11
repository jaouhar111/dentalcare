import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  AppointmentStatus,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { capabilitiesFor } from "@/lib/billing/plan-capabilities";
import { getClinicDetail } from "@/server/actions/super-admin-clinic";
import { getClinicSubscriptionInvoices } from "@/server/actions/super-admin-billing";
import { ClinicRowActions } from "../../_components/clinic-row-actions";
import { ClinicSuspendControl } from "../../_components/clinic-suspend-control";
import { ClinicFeatureFlags } from "../../_components/clinic-feature-flags";
import { SubscriptionInvoices } from "../../_components/subscription-invoices";
import { PlanPicker } from "../../_components/plan-picker";

export const dynamic = "force-dynamic";

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const [result, subscriptionInvoices] = await Promise.all([
    getClinicDetail(id),
    getClinicSubscriptionInvoices(id),
  ]);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFound();
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const c = result.data;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-muted-foreground flex items-center gap-2 text-[12px]">
        <Link
          href={"/super-admin/subscriptions" as never}
          className="hover:text-foreground"
        >
          ← Abonnements
        </Link>
        <span>·</span>
        <span className="text-foreground">{c.name}</span>
      </nav>

      {/* Suspension banner */}
      {c.suspendedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-300/60 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
          <span className="font-semibold">⛔ Cabinet suspendu</span>
          <span className="text-rose-700/80 dark:text-rose-200/80">
            depuis le {dateFmt.format(c.suspendedAt)}
            {c.suspendedReason ? ` · ${c.suspendedReason}` : ""}
          </span>
        </div>
      ) : null}

      {/* Header card */}
      <section className="apple-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {c.logoUrl ? (
              <span className="border-border/40 bg-white grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logoUrl} alt={c.name} className="h-full w-full object-contain" />
              </span>
            ) : (
              <span
                className="grid size-16 place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
                style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9" />
                </svg>
              </span>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-[12px]">
                <span className="font-mono">{c.slug}</span>
                <SubscriptionBadge status={c.subscriptionStatus} />
                {c.trialDaysRemaining !== null ? (
                  <span
                    className={
                      c.trialDaysRemaining <= 3
                        ? "font-semibold text-amber-600 dark:text-amber-300"
                        : ""
                    }
                  >
                    {c.trialDaysRemaining} j d&apos;essai restants
                  </span>
                ) : null}
                <span>Créé le {dateFmt.format(c.createdAt)}</span>
              </div>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {c.email ? <span>✉️ {c.email}</span> : null}
                {c.phone ? <span>📞 {c.phone}</span> : null}
                {c.address ? <span>📍 {c.address}</span> : null}
                {c.vatNumber ? <span>TVA : {c.vatNumber}</span> : null}
                {c.openwaSessionId ? (
                  <span>WA session : {c.openwaSessionId.slice(0, 8)}…</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ClinicRowActions clinicId={c.id} status={c.subscriptionStatus} />
            <ClinicSuspendControl clinicId={c.id} isSuspended={c.suspendedAt !== null} />
          </div>
        </div>
      </section>

      {/* ── Plan picker — 3 tiers from landing pricing ──────── */}
      <PlanPicker clinicId={c.id} currentPlan={c.plan} />

      {/* ── Feature overrides (per-cabinet) ─────────────────── */}
      {(() => {
        const planCaps = capabilitiesFor({
          plan: c.plan,
          subscriptionStatus: c.subscriptionStatus,
        });
        return (
          <ClinicFeatureFlags
            clinicId={c.id}
            overrides={c.featureOverrides}
            defaults={{
              aiReceptionist: planCaps.aiReceptionist,
              voiceNotes: planCaps.voiceNotes,
              recalls: planCaps.recalls,
              paymentPlans: planCaps.paymentPlans,
            }}
          />
        );
      })()}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Patients" value={c.totals.patients} />
        <Kpi label="Employés actifs" value={c.totals.activeEmployees} />
        <Kpi label="RDV à venir" value={c.totals.upcomingAppointments} />
        <Kpi label="Conversations IA" value={c.totals.aiConversations} />
        <Kpi label="Rappels en attente" value={c.totals.pendingRecalls} />
      </div>

      {/* ── Activity (rolling 30 days) ──────────────────────── */}
      <section className="apple-card">
        <div className="apple-kpi-label mb-3">Activité · 30 derniers jours</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="RDV créés" value={c.usage30d.appointmentsCreated} />
          <Kpi label="Conversations IA" value={c.usage30d.aiConversations} />
          <Kpi label="Échanges IA" value={c.usage30d.aiTurns} />
          <Kpi label="Factures émises" value={c.usage30d.invoicesEmitted} />
        </div>
      </section>

      {/* ── Subscription invoices (platform → cabinet) ──────── */}
      <SubscriptionInvoices
        clinicId={c.id}
        invoices={subscriptionInvoices}
        locale={locale}
      />

      {/* 2-col: employees + recent RDV */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="apple-card">
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            Employés ({c.employees.length})
          </h2>
          {c.employees.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun compte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                    <th className="py-2 pr-3 text-start">Nom</th>
                    <th className="py-2 pr-3 text-start">Rôle</th>
                    <th className="py-2 pr-3 text-start">Statut</th>
                    <th className="py-2 pr-3 text-start">Dernier login</th>
                  </tr>
                </thead>
                <tbody>
                  {c.employees.map((u) => (
                    <tr key={u.id} className="border-border/40 border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-muted-foreground text-[11px]">{u.email}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-2 pr-3 text-[11px]">
                        {u.isActive ? (
                          <span className="text-emerald-700 dark:text-emerald-300">Actif</span>
                        ) : (
                          <span className="text-muted-foreground">Désactivé</span>
                        )}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3 text-[11px]">
                        {u.lastLoginAt ? dateTimeFmt.format(u.lastLoginAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="apple-card">
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            Derniers RDV ({c.recentAppointments.length})
          </h2>
          {c.recentAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun RDV.</p>
          ) : (
            <ul className="space-y-2">
              {c.recentAppointments.map((a) => (
                <li
                  key={a.id}
                  className="border-border/40 flex items-center justify-between gap-3 border-b pb-2 text-[12px] last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-foreground truncate font-medium">
                      {a.patientName}{" "}
                      {a.source === "AI_WHATSAPP" ? (
                        <span className="ml-1 rounded-sm bg-linear-to-br from-emerald-500 to-teal-600 px-1 text-[8px] font-bold text-white align-middle">
                          IA
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {a.dentistName} · {a.reason ?? "—"}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted-foreground text-[11px]">
                      {dateTimeFmt.format(a.startAt)}
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent patients */}
      <section className="apple-card">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          Derniers patients ajoutés ({c.recentPatients.length})
        </h2>
        {c.recentPatients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun patient.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3 text-start">Nom</th>
                  <th className="py-2 pr-3 text-start">Téléphone</th>
                  <th className="py-2 pr-3 text-start">Inscrit</th>
                </tr>
              </thead>
              <tbody>
                {c.recentPatients.map((p) => (
                  <tr key={p.id} className="border-border/40 border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-[12px]">{p.phone}</td>
                    <td className="text-muted-foreground py-2 pr-3 text-[11px]">
                      {dateFmt.format(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="apple-kpi">
      <div className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="kpi-value mt-1">
        <span className="num">{value}</span>
      </div>
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

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, { label: string; cls: string }> = {
    SUPER_ADMIN: { label: "Super-admin", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200" },
    ADMIN: { label: "Admin", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    DENTIST: { label: "Dentiste", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    RECEPTIONIST: { label: "Réception", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  };
  const { label, cls } = map[role];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const cls =
    status === AppointmentStatus.CANCELLED
      ? "text-muted-foreground line-through"
      : status === AppointmentStatus.COMPLETED
        ? "text-emerald-700 dark:text-emerald-300"
        : status === AppointmentStatus.CONFIRMED
          ? "text-blue-700 dark:text-blue-300"
          : "text-foreground/70";
  return <span className={`text-[10px] font-medium ${cls}`}>{status}</span>;
}
