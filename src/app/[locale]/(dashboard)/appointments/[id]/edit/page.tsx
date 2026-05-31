import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { getAppointment } from "@/server/actions/appointments";
import { listDentists } from "@/server/actions/dentists";
import { listAppointmentNotes } from "@/server/actions/medical";
import {
  listApplicationsForAppointment,
  listCatalogItems,
} from "@/server/actions/treatments";
import { getCurrentUser } from "@/lib/auth/rbac";
import { splitLocalDateTime } from "@/lib/utils/week";
import { AppointmentForm, type AppointmentFormValues } from "../../appointment-form";
import { SessionNotes } from "./session-notes";
import { SessionTreatments } from "./session-treatments";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function EditAppointmentStandalone({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AppointmentForm");
  const tRecords = await getTranslations("Records");
  const tSession = await getTranslations("Session");

  const appt = await getAppointment(id);
  if (!appt) notFound();

  const me = await getCurrentUser();
  const canManageNotes = me
    ? me.role === UserRole.ADMIN || me.role === UserRole.DENTIST
    : false;

  const notesResult = await listAppointmentNotes(id);
  const notes = notesResult.ok ? notesResult.data : [];

  const [applicationsResult, catalogResult] = await Promise.all([
    listApplicationsForAppointment(id),
    listCatalogItems(),
  ]);
  const applications = applicationsResult.ok ? applicationsResult.data : [];
  const catalog = catalogResult.ok ? catalogResult.data : [];

  const dentistsResult = await listDentists();
  const dentists = dentistsResult.ok
    ? dentistsResult.data
        .filter((d) => d.isActive || d.id === appt.dentistId)
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}`, color: d.color }))
    : [];

  const { date, time } = splitLocalDateTime(appt.startAt.toISOString());
  const durationMin = Math.max(
    15,
    Math.round((appt.endAt.getTime() - appt.startAt.getTime()) / 60_000),
  );

  const initial: AppointmentFormValues = {
    id: appt.id,
    patientId: appt.patient.id,
    patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
    dentistId: appt.dentistId,
    date,
    time,
    durationMin,
    reason: appt.reason ?? "",
    notes: appt.notes ?? "",
    catalogItemId: "",
  };

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={"/appointments" as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("titleEdit")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{initial.patientName}</p>
        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          {appt.source === "AI_WHATSAPP" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
              </svg>
              IA WhatsApp
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
              {appt.source === "RECALL_FOLLOWUP"
                ? "Rappel"
                : appt.source === "WAITLIST_ACCEPT"
                  ? "Liste d'attente"
                  : "Manuel"}
            </span>
          )}
          {appt.createdBy?.fullName ? (
            <span>
              Créé par <span className="text-foreground font-medium">{appt.createdBy.fullName}</span>
            </span>
          ) : null}
        </p>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <AppointmentForm
          initial={initial}
          dentists={dentists}
          catalog={[]}
          lockedDentistId={
            me?.role === UserRole.DENTIST && me.dentistId ? me.dentistId : null
          }
        />
      </div>

      {/* ─── Treatments performed in this séance ─── */}
      <div className="mt-6">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
          {tSession("treatmentsTitle")}
        </h2>
        <SessionTreatments
          appointmentId={appt.id}
          patientId={appt.patient.id}
          dentistId={appt.dentistId}
          applications={applications}
          catalog={catalog}
          canManage={canManageNotes}
          locale={locale as Locale}
        />
      </div>

      {/* ─── Clinical notes for this séance ─── */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            {tRecords("sessionNotesTitle")}
          </h2>
          <Link
            href={`/patients/${appt.patient.id}?tab=records` as never}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {tRecords("viewFullRecord")} →
          </Link>
        </div>
        <SessionNotes
          appointmentId={appt.id}
          patientId={appt.patient.id}
          notes={notes}
          canManage={canManageNotes}
          locale={locale as Locale}
        />
      </div>
    </div>
  );
}
