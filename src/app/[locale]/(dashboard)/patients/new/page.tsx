import { getTranslations, setRequestLocale } from "next-intl/server";
import { CommunicationChannel } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { PatientForm, type PatientFormValues } from "../patient-form";

export default async function NewPatientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PatientForm");

  const initial: PatientFormValues = {
    firstName: "",
    lastName: "",
    cin: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    address: "",
    city: "",
    bloodGroup: "",
    medicalHistory: "",
    preferredChannel: CommunicationChannel.WHATSAPP,
    preferredLocale: (locale as "fr" | "en") ?? "fr",
    photoConsent: false,
    allergies: [],
  };

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={"/patients" as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("titleCreate")}</h1>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <PatientForm initial={initial} />
      </div>
    </div>
  );
}
