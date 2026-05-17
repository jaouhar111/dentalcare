import { setRequestLocale } from "next-intl/server";
import type { DentistFormValues } from "../../dentist-form";
import { NewDentistModal } from "./modal-client";

export default async function InterceptedNewDentist({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const initial: DentistFormValues = {
    firstName: "",
    lastName: "",
    specialty: "",
    phone: "",
    email: "",
    color: "#0891B2",
  };

  return <NewDentistModal initial={initial} />;
}
