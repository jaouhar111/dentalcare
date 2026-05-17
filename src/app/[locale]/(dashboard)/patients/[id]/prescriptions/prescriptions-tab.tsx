import { getTranslations } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listPrescriptionsForPatient } from "@/server/actions/prescriptions";
import { listDentists } from "@/server/actions/dentists";
import { getCurrentUser } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/utils/format";
import { PrescriptionFormDialog } from "./prescription-form";
import { DeletePrescriptionButton } from "./delete-button";
import type { Locale } from "@/i18n/routing";

const CLINICIAN_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.DENTIST]);

/**
 * Patient detail tab: lists prescriptions issued for this patient + opens the
 * "new prescription" dialog. Each row links to the print-preview page where
 * the document can be printed, downloaded as PDF, or shared via WhatsApp.
 */
export async function PrescriptionsTab({
  patientId,
  patientLocale,
  locale,
}: {
  patientId: string;
  /// Patient's preferred locale — pre-selected in the new-prescription form.
  patientLocale: string;
  locale: Locale;
}) {
  const t = await getTranslations("Prescriptions");
  const me = await getCurrentUser();
  const canManage = me ? CLINICIAN_ROLES.has(me.role as UserRole) : false;

  const [result, dentistsResult] = await Promise.all([
    listPrescriptionsForPatient(patientId),
    listDentists(),
  ]);

  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const items = result.data;
  const dentists = dentistsResult.ok
    ? dentistsResult.data.filter((d) => d.isActive).map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
      }))
    : [];

  // Receptionist's own dentist link (if any) — used as a sensible default.
  const myDentistId =
    me?.dentistId && dentists.some((d) => d.id === me.dentistId) ? me.dentistId : dentists[0]?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            <span className="num">{items.length}</span>{" "}
            {t("subtitle", { count: items.length }).replace(`${items.length} `, "")}
          </p>
        </div>
        {canManage && dentists.length > 0 && (
          <PrescriptionFormDialog
            mode="create"
            patientId={patientId}
            patientLocale={patientLocale}
            dentists={dentists}
            defaultDentistId={myDentistId ?? ""}
          />
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-16 text-center">
          <p className="text-foreground text-base font-medium">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
        </div>
      ) : (
        <ul className="bg-card border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
          {items.map((p) => (
            <li key={p.id} className="hover:bg-muted/30 transition">
              <div className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-foreground font-medium">
                    {t("items", { count: p.itemCount })}
                  </div>
                  <div className="text-muted-foreground num mt-0.5 text-xs">
                    {t("issuedOn", {
                      date: formatDate(p.issuedAt, locale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                    })}
                    {" · "}
                    {t("issuedBy", { name: p.dentistName })}
                    {p.locale !== locale && (
                      <span className="ms-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {p.locale.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {p.notes && (
                    <p className="text-foreground/70 mt-1 truncate text-xs italic">{p.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/prescriptions/${p.id}` as never}
                    className="border-input hover:bg-muted bg-background inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                  >
                    {t("view")}
                  </Link>
                  {canManage && <DeletePrescriptionButton id={p.id} patientId={patientId} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
