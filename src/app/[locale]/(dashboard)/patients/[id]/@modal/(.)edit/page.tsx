import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPatient } from "@/server/actions/patients";
import type { PatientFormValues } from "../../../patient-form";
import { EditPatientModal } from "./modal-client";

export const dynamic = "force-dynamic";

export default async function InterceptedEditPatient({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
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
    preferredLocale: (patient.preferredLocale as "fr" | "en" | "ar") ?? "fr",
    photoConsent: patient.photoConsent,
    allergies: patient.allergies.map((a) => a.label),
  };

  return (
    <EditPatientModal initial={initial} patientName={`${patient.firstName} ${patient.lastName}`} />
  );
}
