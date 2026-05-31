import { getTranslations } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { listMedicalTimeline } from "@/server/actions/medical";
import { getCurrentUser } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/utils/format";
import { AddNoteForm } from "./add-note-form";
import { AddRadiographForm } from "./add-radiograph-form";
import { AddPhotoForm } from "./add-photo-form";
import { TimelineEntryCard } from "./timeline-entry";
import type { Locale } from "@/i18n/routing";

const CLINICIAN_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.DENTIST]);

/**
 * Server Component rendered inside the "Dossier médical" tab of the patient
 * detail page. Aggregates notes + radiographs + photos into one chronological
 * timeline plus three "+ Add" affordances above. Heavy lifting (uploads, DB
 * writes) happens in Server Actions inside `add-*-form.tsx`.
 */
export async function RecordsTab({
  patientId,
  patientName,
  photoConsent,
  locale,
}: {
  patientId: string;
  patientName: string;
  photoConsent: boolean;
  locale: Locale;
}) {
  const t = await getTranslations("Records");
  const me = await getCurrentUser();
  const canManage = me ? CLINICIAN_ROLES.has(me.role as UserRole) : false;
  // Receptionists can attach treatment photos but not clinical notes/radios.
  const canTakePhoto = !!me;

  const result = await listMedicalTimeline(patientId);
  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }

  const entries = result.data;

  return (
    <div className="space-y-6">
      {/* ─── Header + actions ─── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
          <p className="page-sub">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && <AddNoteForm patientId={patientId} />}
          {canManage && <AddRadiographForm patientId={patientId} />}
          {canTakePhoto && (
            <AddPhotoForm patientId={patientId} photoConsent={photoConsent} />
          )}
        </div>
      </div>

      {/* ─── Consent banner ─── */}
      {!photoConsent && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <svg
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zM12 15.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-amber-900 dark:text-amber-200">{t("consentRequired")}</p>
        </div>
      )}

      {/* ─── Timeline ─── */}
      {entries.length === 0 ? (
        <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-16 text-center">
          <p className="text-foreground text-base font-medium">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
        </div>
      ) : (
        <ol className="border-border/60 relative space-y-4 border-s ps-6">
          {entries.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="relative">
              <span
                aria-hidden
                className="bg-primary ring-card absolute -start-[31px] top-3 size-2.5 rounded-full ring-4"
              />
              <div className="text-muted-foreground num mb-1 text-xs">
                {formatDate(e.date, locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <TimelineEntryCard
                entry={e}
                patientId={patientId}
                patientName={patientName}
                canManage={canManage}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
