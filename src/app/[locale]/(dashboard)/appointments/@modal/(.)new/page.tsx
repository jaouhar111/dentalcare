import { UserRole } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import { listDentists } from "@/server/actions/dentists";
import { listCatalogItems } from "@/server/actions/treatments";
import { requireAuth } from "@/lib/auth/rbac";
import type { AppointmentFormValues } from "../../appointment-form";
import { NewAppointmentModal } from "./modal-client";

function defaultInitial(): AppointmentFormValues {
  const now = new Date();
  // Round up to the next 15-minute mark for a friendlier default.
  now.setSeconds(0, 0);
  const minutes = now.getMinutes();
  now.setMinutes(Math.ceil((minutes + 1) / 15) * 15);
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

export default async function InterceptedNewAppointment({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireAuth();

  const dentistsResult = await listDentists();
  const allDentists = dentistsResult.ok
    ? dentistsResult.data
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}`, color: d.color }))
    : [];

  const lockedDentistId =
    me.role === UserRole.DENTIST && me.dentistId ? me.dentistId : null;
  const dentists = lockedDentistId
    ? allDentists.filter((d) => d.id === lockedDentistId)
    : allDentists;

  const initial = defaultInitial();
  if (lockedDentistId) initial.dentistId = lockedDentistId;
  else if (dentists[0]) initial.dentistId = dentists[0].id;

  const catalogResult = await listCatalogItems();
  const catalog = catalogResult.ok
    ? catalogResult.data
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, code: c.code, name: c.name, color: c.color }))
    : [];

  return (
    <NewAppointmentModal
      initial={initial}
      dentists={dentists}
      catalog={catalog}
      lockedDentistId={lockedDentistId}
    />
  );
}
