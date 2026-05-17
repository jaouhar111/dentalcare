import { CommunicationChannel } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import type { PatientFormValues } from "../../patient-form";
import { NewPatientModal } from "./modal-client";

export default async function InterceptedNewPatient({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
    preferredLocale: (locale as "fr" | "en" | "ar") ?? "fr",
    photoConsent: false,
    allergies: [],
  };

  return <NewPatientModal initial={initial} />;
}
