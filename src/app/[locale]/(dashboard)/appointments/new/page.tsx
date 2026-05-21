import { UserRole } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listDentists } from "@/server/actions/dentists";
import { getPatient } from "@/server/actions/patients";
import { listCatalogItems } from "@/server/actions/treatments";
import { requireAuth } from "@/lib/auth/rbac";
import { AppointmentForm, type AppointmentFormValues } from "../appointment-form";

function defaultInitial(): AppointmentFormValues {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return {
    patientId: "",
    patientName: "",
    dentistId: "",
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}`,
    durationMin: 30,
    reason: "",
    notes: "",
    catalogItemId: "",
  };
}

export default async function NewAppointmentStandalone({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { patientId } = await searchParams;
  const t = await getTranslations("AppointmentForm");
  const me = await requireAuth();

  const dentistsResult = await listDentists();
  const allDentists = dentistsResult.ok
    ? dentistsResult.data
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}`, color: d.color }))
    : [];

  // A DENTIST user can only ever book on their own agenda — restrict the
  // selectable list to just them so the UI matches the server constraint.
  const lockedDentistId =
    me.role === UserRole.DENTIST && me.dentistId ? me.dentistId : null;
  const dentists = lockedDentistId
    ? allDentists.filter((d) => d.id === lockedDentistId)
    : allDentists;

  const initial = defaultInitial();
  if (lockedDentistId) initial.dentistId = lockedDentistId;
  else if (dentists[0]) initial.dentistId = dentists[0].id;

  // If a patientId is in the URL (e.g. coming from a patient detail page),
  // pre-fill the patient picker so the user only has to pick date/time/dentist.
  if (patientId) {
    const patient = await getPatient(patientId);
    if (patient) {
      initial.patientId = patient.id;
      initial.patientName = `${patient.firstName} ${patient.lastName}`;
    }
  }

  const catalogResult = await listCatalogItems();
  const catalog = catalogResult.ok
    ? catalogResult.data
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, code: c.code, name: c.name, color: c.color }))
    : [];

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={"/appointments" as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("titleCreate")}</h1>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <AppointmentForm
          initial={initial}
          dentists={dentists}
          catalog={catalog}
          lockedDentistId={lockedDentistId}
        />
      </div>
    </div>
  );
}
