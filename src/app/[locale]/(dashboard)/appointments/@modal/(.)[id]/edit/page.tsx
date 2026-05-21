import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import { getAppointment } from "@/server/actions/appointments";
import { listDentists } from "@/server/actions/dentists";
import { getCurrentUser } from "@/lib/auth/rbac";
import { splitLocalDateTime } from "@/lib/utils/week";
import type { AppointmentFormValues } from "../../../appointment-form";
import { EditAppointmentModal } from "./modal-client";

export const dynamic = "force-dynamic";

export default async function InterceptedEditAppointment({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const appt = await getAppointment(id);
  if (!appt) notFound();

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

  const me = await getCurrentUser();
  const lockedDentistId =
    me?.role === UserRole.DENTIST && me.dentistId ? me.dentistId : null;

  return (
    <EditAppointmentModal
      initial={initial}
      dentists={dentists}
      patientName={`${appt.patient.firstName} ${appt.patient.lastName}`}
      lockedDentistId={lockedDentistId}
    />
  );
}
