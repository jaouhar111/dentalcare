import { setRequestLocale } from "next-intl/server";
import { WaitlistTimePreference } from "@prisma/client";
import { listDentists } from "@/server/actions/dentists";
import type { WaitlistFormValues } from "../../waitlist-form";
import { NewWaitlistModal } from "./modal-client";

export default async function InterceptedNewWaitlistEntry({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const dentistsResult = await listDentists();
  const dentists = dentistsResult.ok
    ? dentistsResult.data
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}` }))
    : [];

  const initial: WaitlistFormValues = {
    patientId: "",
    patientName: "",
    dentistId: "",
    durationMin: 30,
    timePreference: WaitlistTimePreference.ANY,
    notBefore: "",
    notAfter: "",
    reason: "",
  };

  return <NewWaitlistModal initial={initial} dentists={dentists} />;
}
