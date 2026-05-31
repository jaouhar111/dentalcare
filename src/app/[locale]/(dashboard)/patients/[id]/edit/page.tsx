import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPatient } from "@/server/actions/patients";
import { PatientForm, type PatientFormValues } from "../../patient-form";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PatientForm");
  const patient = await getPatient(id);
  if (!patient) notFound();

  const initial: PatientFormValues = {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    cin: patient.cin ?? "",
    phone: patient.phone,
    email: patient.email ?? "",
    dob: patient.dob.toISOString().slice(0, 10),
    gender: patient.gender ?? "",
    address: patient.address ?? "",
    city: patient.city ?? "",
    bloodGroup: patient.bloodGroup ?? "",
    medicalHistory: patient.medicalHistory ?? "",
    preferredChannel: patient.preferredChannel,
    preferredLocale:
      (patient.preferredLocale === "fr" || patient.preferredLocale === "en"
        ? patient.preferredLocale
        : "fr") as "fr" | "en",
    photoConsent: patient.photoConsent,
    allergies: patient.allergies.map((a) => a.label),
  };

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/patients/${id}` as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("titleEdit")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {patient.firstName} {patient.lastName}
        </p>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <PatientForm initial={initial} />
      </div>
    </div>
  );
}
