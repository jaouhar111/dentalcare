import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { getPatient } from "@/server/actions/patients";
import {
  getNextPatientAppointment,
  getRecentPatientAppointments,
} from "@/server/actions/appointments";
import { getPatientBalance } from "@/server/actions/invoices";
import { listMedicalNotes } from "@/server/actions/medical";
import { AppointmentStatus } from "@prisma/client";
import { getCurrentUser, canDeletePatient } from "@/lib/auth/rbac";
import { ageInYears, formatCurrency, formatDate, formatDateShort } from "@/lib/utils/format";
import { effectiveAppointmentStatus } from "@/lib/utils/appointment-status";
import { formatMoroccanPhone } from "@/lib/utils/phone";
import { avatarColor, initialsOf } from "@/lib/utils/avatar";
import { DeletePatientButton } from "./delete-button";
import { GdprExportButton } from "./gdpr-export-button";
import { HardDeletePatientButton } from "./hard-delete-button";
import { RecordsTab } from "./records/records-tab";
import { OdontogramTab } from "./odontogram/odontogram-tab";
import { PrescriptionsTab } from "./prescriptions/prescriptions-tab";
import { InvoicesTab } from "./invoices/invoices-tab";
import { PlansTab } from "./plans/plans-tab";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Tab = "info" | "records" | "odontogram" | "prescriptions" | "invoices" | "plans";
const TAB_KEYS: Tab[] = ["info", "records", "odontogram", "prescriptions", "invoices", "plans"];

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { tab = "info" } = await searchParams;
  const activeTab: Tab = TAB_KEYS.includes(tab) ? tab : "info";

  const patient = await getPatient(id);
  if (!patient) notFound();

  const me = await getCurrentUser();
  const t = await getTranslations("PatientDetail");
  const tForm = await getTranslations("PatientForm");
  const tPatients = await getTranslations("Patients");

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const color = avatarColor(fullName);
  const age = ageInYears(patient.dob);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-2 lg:py-2">
      <Link
        href={"/patients" as never}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <svg
          className="size-4 rtl:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("backToList")}
      </Link>

      {/* ─── Header card ─────────────────────────────────────────────────── */}
      <div className="bg-card border-border/60 mb-6 rounded-xl border p-4 sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <div
            className={`grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold sm:size-24 sm:text-3xl ${color.bg} ${color.text}`}
            aria-hidden
          >
            {initialsOf(patient.firstName, patient.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="page-h1">{fullName}</h1>
                <p className="page-sub">
                  <span className="num">{tPatients("agePattern", { years: age })}</span>
                  {" · "}
                  {t("bornOn")}{" "}
                  <span className="num">{formatDateShort(patient.dob, locale as Locale)}</span>
                  {patient.cin && (
                    <>
                      {" · "}CIN <span className="num">{patient.cin}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/patients/${patient.id}/edit` as never}
                  className="border-input hover:bg-muted bg-background inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                    />
                  </svg>
                  {tPatients("edit")}
                </Link>
                <Link
                  href={`/appointments/new?patientId=${patient.id}` as never}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25"
                    />
                  </svg>
                  {tPatients("newAppointment")}
                </Link>
                <GdprExportButton patientId={patient.id} patientName={fullName} />
                {me && canDeletePatient(me.role as UserRole) && (
                  <>
                    <DeletePatientButton patientId={patient.id} patientName={fullName} />
                    {me.role === UserRole.ADMIN && (
                      <HardDeletePatientButton
                        patientId={patient.id}
                        patientName={fullName}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={<IconPhone />} value={formatMoroccanPhone(patient.phone)} mono />
              {patient.email && <InfoRow icon={<IconMail />} value={patient.email} />}
              {(patient.address || patient.city) && (
                <InfoRow
                  icon={<IconPin />}
                  value={[patient.address, patient.city].filter(Boolean).join(", ")}
                />
              )}
              {patient.bloodGroup && (
                <InfoRow
                  icon={<IconDrop />}
                  value={`${tForm("fields.bloodGroup")} ${tForm(`bloodGroup.${patient.bloodGroup}`)}`}
                />
              )}
              <InfoRow
                icon={<IconChat />}
                value={tForm(`channel.${patient.preferredChannel}`)}
              />
              <InfoRow
                icon={<IconGlobe />}
                value={tForm(
                  `locale.${(patient.preferredLocale === "fr" || patient.preferredLocale === "en" ? patient.preferredLocale : "fr") as "fr" | "en"}`,
                )}
              />
            </div>

            {/* Badges */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {patient.allergies.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  ⚠ {a.label}
                </span>
              ))}
              {patient.photoConsent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  📸 {t("consentLabel")} · {t("consentYes")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        <nav
          aria-label="Patient sections"
          className="border-border/60 flex flex-wrap border-b cursor-default select-none"
        >
          {TAB_KEYS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Link
                key={tab}
                href={`/patients/${patient.id}?tab=${tab}` as never}
                className={
                  isActive
                    ? "text-primary border-primary -mb-px border-b-2 px-5 py-3 text-sm font-medium whitespace-nowrap"
                    : "text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-5 py-3 text-sm font-medium whitespace-nowrap"
                }
              >
                {t(`tabs.${tab}`)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 sm:p-6">
          {activeTab === "info" ? (
            <InfoTabContent patient={patient} locale={locale as Locale} />
          ) : activeTab === "records" ? (
            <RecordsTab
              patientId={patient.id}
              patientName={fullName}
              photoConsent={patient.photoConsent}
              locale={locale as Locale}
            />
          ) : activeTab === "odontogram" ? (
            <OdontogramTab patientId={patient.id} locale={locale as Locale} />
          ) : activeTab === "prescriptions" ? (
            <PrescriptionsTab
              patientId={patient.id}
              patientLocale={patient.preferredLocale}
              locale={locale as Locale}
            />
          ) : activeTab === "invoices" ? (
            <InvoicesTab patientId={patient.id} locale={locale as Locale} />
          ) : (
            <PlansTab patientId={patient.id} locale={locale as Locale} />
          )}
        </div>
      </div>
    </div>
  );
}

async function InfoTabContent({
  patient,
  locale,
}: {
  patient: NonNullable<Awaited<ReturnType<typeof getPatient>>>;
  locale: Locale;
}) {
  const t = await getTranslations("PatientDetail");
  const tForm = await getTranslations("PatientForm");
  const tAppt = await getTranslations("Appointments");

  const [nextAppt, recentAppts, balanceResult, notesResult] = await Promise.all([
    getNextPatientAppointment(patient.id),
    getRecentPatientAppointments(patient.id, 5),
    getPatientBalance(patient.id),
    listMedicalNotes(patient.id),
  ]);
  const balance = balanceResult.ok ? balanceResult.data : null;
  const notes = notesResult.ok ? notesResult.data : [];
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ─── Left column ─── */}
      <div className="space-y-6 lg:col-span-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
              {t("sections.medicalHistory")}
            </h2>
            <Link
              href={`/patients/${patient.id}?tab=records` as never}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t("viewFullRecord")} →
            </Link>
          </div>

          {patient.medicalHistory && (
            <div className="bg-muted/40 text-foreground/90 mb-3 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">
                {t("antecedents")}
              </p>
              <p className="whitespace-pre-wrap">{patient.medicalHistory}</p>
            </div>
          )}

          {notes.length === 0 ? (
            !patient.medicalHistory && (
              <div className="bg-muted/40 text-foreground/90 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground italic">{t("noMedicalHistory")}</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wider">
                {t("clinicalNotes")} ({notes.length})
              </p>
              <ul className="space-y-2">
                {notes.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className="bg-muted/40 text-foreground/90 rounded-lg p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-foreground font-medium">
                        {n.title ?? "Note clinique"}
                      </span>
                      <span className="text-muted-foreground num text-xs">
                        {dateFmt.format(n.createdAt)} · {n.authorName}
                      </span>
                    </div>
                    <p className="text-foreground/80 mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {n.body.length > 280 ? n.body.slice(0, 280) + "…" : n.body}
                    </p>
                  </li>
                ))}
              </ul>
              {notes.length > 5 && (
                <p className="text-muted-foreground text-xs">
                  + {notes.length - 5} autre{notes.length - 5 > 1 ? "s" : ""} note
                  {notes.length - 5 > 1 ? "s" : ""} (
                  <Link
                    href={`/patients/${patient.id}?tab=records` as never}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    voir tout
                  </Link>
                  )
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            {t("sections.recentConsultations")}
          </h2>
          {recentAppts.length === 0 ? (
            <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-10 text-center">
              <p className="text-muted-foreground text-sm">{t("noRecentConsultations")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAppts.map((a) => {
                const effective = effectiveAppointmentStatus(a.status, a.startAt, a.endAt);
                const isCancelled = effective === AppointmentStatus.CANCELLED;
                const isInProgress = effective === AppointmentStatus.IN_PROGRESS;
                const isNoShow = effective === AppointmentStatus.NO_SHOW;
                const isCompleted = effective === AppointmentStatus.COMPLETED;
                const durationMin = Math.round(
                  (a.endAt.getTime() - a.startAt.getTime()) / 60000,
                );
                // Status dot color matches the badge palette used elsewhere.
                const dotColor = isCancelled || isNoShow
                  ? "bg-rose-500"
                  : isInProgress
                    ? "bg-amber-500 animate-pulse"
                    : isCompleted
                      ? "bg-blue-500"
                      : "bg-emerald-500";
                return (
                  <Link
                    key={a.id}
                    href={`/appointments/${a.id}/edit` as never}
                    className="border-border/60 hover:bg-muted/40 hover:border-border block rounded-lg border p-4 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-2 size-2 shrink-0 rounded-full ${dotColor}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`text-foreground text-sm font-medium ${isCancelled ? "line-through opacity-70" : ""}`}
                          >
                            {a.reason ?? tAppt(`status.${effective}`)}
                          </div>
                          <div className="text-muted-foreground num shrink-0 text-xs">
                            {formatDateShort(a.startAt, locale)}
                          </div>
                        </div>
                        <div className="text-muted-foreground num mt-0.5 text-xs">
                          Dr {a.dentist.firstName} {a.dentist.lastName} · {durationMin} min
                          {" · "}
                          {formatDate(a.startAt, locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {a.notes && (
                          <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
                            {a.notes}
                          </p>
                        )}
                        {a.cancellationReason && isCancelled && (
                          <p className="text-rose-600 dark:text-rose-400 mt-1 text-xs italic">
                            {a.cancellationReason}
                          </p>
                        )}
                        {a.noteCount > 0 && (
                          <p className="text-muted-foreground num mt-1 text-xs">
                            📝 {a.noteCount}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── Right column ─── */}
      <div className="space-y-6">
        <section>
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            {t("sections.nextAppointment")}
          </h2>
          {nextAppt ? (
            (() => {
              const effective = effectiveAppointmentStatus(
                nextAppt.status,
                nextAppt.startAt,
                nextAppt.endAt,
              );
              const isInProgress = effective === AppointmentStatus.IN_PROGRESS;
              const isConfirmed = nextAppt.confirmationReceivedAt !== null;
              const durationMin = Math.round(
                (nextAppt.endAt.getTime() - nextAppt.startAt.getTime()) / 60000,
              );
              return (
                <Link
                  href={`/appointments/${nextAppt.id}/edit` as never}
                  className="bg-primary/5 border-primary/20 hover:border-primary/40 block rounded-lg border p-4 transition"
                >
                  <div className="text-primary num text-xs font-medium">
                    {formatDate(nextAppt.startAt, locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-foreground num mt-1 text-base font-semibold">
                    {formatDate(nextAppt.startAt, locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {` — ${durationMin} min`}
                  </div>
                  {nextAppt.reason && (
                    <div className="text-foreground/80 mt-1 text-sm">{nextAppt.reason}</div>
                  )}
                  <div className="text-muted-foreground mt-1 text-xs">
                    Dr {nextAppt.dentist.firstName} {nextAppt.dentist.lastName}
                    {isConfirmed && (
                      <span className="ms-1 text-emerald-700 dark:text-emerald-400">
                        · ✓ {tAppt(`status.CONFIRMED`)}
                      </span>
                    )}
                    {isInProgress && (
                      <span className="ms-1 animate-pulse text-amber-700 dark:text-amber-400">
                        · ● {tAppt(`status.IN_PROGRESS`)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })()
          ) : (
            <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-8 text-center">
              <p className="text-muted-foreground text-xs">{t("noNextAppointment")}</p>
              <Link
                href={`/appointments/new?patientId=${patient.id}` as never}
                className="text-primary hover:underline mt-2 inline-block text-xs font-medium"
              >
                + {tAppt("new")}
              </Link>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            {t("sections.balance")}
          </h2>
          {balance && (balance.billed > 0 || balance.activeInvoiceCount > 0) ? (
            <Link
              href={`/patients/${patient.id}?tab=invoices` as never}
              className="bg-card border-border/60 hover:border-primary/40 block divide-y rounded-lg border transition"
            >
              <div className="flex justify-between p-3 text-sm">
                <span className="text-muted-foreground">{t("balanceLabels.billed")}</span>
                <span className="num text-foreground font-medium">
                  {formatCurrency(balance.billed, locale)}
                </span>
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="text-muted-foreground">{t("balanceLabels.paid")}</span>
                <span className="num font-medium text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(balance.paid, locale)}
                </span>
              </div>
              <div
                className={`flex justify-between p-3 text-sm ${
                  balance.remaining > 0 ? "bg-rose-50 dark:bg-rose-950/30" : ""
                }`}
              >
                <span
                  className={
                    balance.remaining > 0
                      ? "text-rose-700 dark:text-rose-300 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {t("balanceLabels.remaining")}
                </span>
                <span
                  className={`num font-bold ${
                    balance.remaining > 0
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-foreground"
                  }`}
                >
                  {formatCurrency(balance.remaining, locale)}
                </span>
              </div>
              {balance.overdueCount > 0 && (
                <div className="flex items-center gap-1 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <svg
                    className="size-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("balanceLabels.overdue", { count: balance.overdueCount })}
                </div>
              )}
            </Link>
          ) : (
            <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-6 text-center">
              <p className="text-muted-foreground text-xs">{t("balanceLabels.empty")}</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            {t("sections.preferences")}
          </h2>
          <div className="space-y-2 text-sm">
            <PrefRow
              label={t("channelLabel")}
              value={tForm(`channel.${patient.preferredChannel}`)}
            />
            <PrefRow
              label={t("localeLabel")}
              value={tForm(
                `locale.${(patient.preferredLocale === "fr" || patient.preferredLocale === "en" ? patient.preferredLocale : "fr") as "fr" | "en"}`,
              )}
            />
            <PrefRow
              label={t("consentLabel")}
              value={patient.photoConsent ? `✓ ${t("consentYes")}` : t("consentNo")}
              valueClass={
                patient.photoConsent ? "text-emerald-700 dark:text-emerald-300" : undefined
              }
            />
            <PrefRow
              label={t("patientSince")}
              value={formatDate(patient.createdAt, locale, { year: "numeric", month: "long" })}
              mono
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ icon, value, mono }: { icon: React.ReactNode; value: string; mono?: boolean }) {
  return (
    <div className="text-foreground/90 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0" aria-hidden>
        {icon}
      </span>
      <span className={`truncate ${mono ? "num" : ""}`}>{value}</span>
    </div>
  );
}

function PrefRow({
  label,
  value,
  valueClass,
  mono,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClass ?? ""} ${mono ? "num" : ""}`}>{value}</span>
    </div>
  );
}

function IconPhone() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}
function IconMail() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}
function IconPin() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}
function IconDrop() {
  return (
    <svg className="size-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C9 5 6 9 6 13a6 6 0 0012 0c0-4-3-8-6-11z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}
