import { UserRole } from "@prisma/client";
import { getPatientChart } from "@/server/actions/odontogram";
import { listCatalogItems } from "@/server/actions/treatments";
import { getCurrentUser } from "@/lib/auth/rbac";
import { OdontogramClient } from "./odontogram-client";
import type { Locale } from "@/i18n/routing";

/**
 * Server-Component wrapper that fetches the patient's chart + the active
 * catalog (for the plan dialog) and hands them to the interactive client.
 *
 * The chart map is serialized to an array of tuples because Maps don't
 * survive the server → client boundary as-is.
 */
export async function OdontogramTab({
  patientId,
  locale,
}: {
  patientId: string;
  locale: Locale;
}) {
  const me = await getCurrentUser();
  const canEdit = me ? me.role === UserRole.ADMIN || me.role === UserRole.DENTIST : false;

  const [chartResult, catalogResult] = await Promise.all([
    getPatientChart(patientId),
    listCatalogItems(),
  ]);

  if (!chartResult.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {chartResult.error.message}
      </div>
    );
  }
  const initialChart = Array.from(chartResult.data.entries());
  const catalog = catalogResult.ok ? catalogResult.data : [];

  return (
    <OdontogramClient
      patientId={patientId}
      initialChart={initialChart}
      catalog={catalog}
      canEdit={canEdit}
      locale={locale}
    />
  );
}
