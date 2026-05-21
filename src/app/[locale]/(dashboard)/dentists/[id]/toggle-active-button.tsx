"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { toggleDentistActive } from "@/server/actions/dentists";

/**
 * Toggle a dentist between active/inactive. We never hard-delete since
 * appointments, invoices, and treatments reference the dentist row.
 * Inactive dentists drop out of the appointment + treatment pickers but
 * stay readable for historical reports.
 */
export function ToggleActiveButton({
  dentistId,
  isActive,
  dentistName,
}: {
  dentistId: string;
  isActive: boolean;
  dentistName: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const verb = isActive ? "désactiver" : "réactiver";
      const ok = await confirm({
        title: `${isActive ? "Désactiver" : "Réactiver"} Dr ${dentistName} ?`,
        description: isActive
          ? "Le dentiste ne pourra plus se voir attribuer de nouveaux rendez-vous. Son historique reste consultable."
          : "Le dentiste réapparaîtra dans les sélecteurs de rendez-vous et de soins.",
        confirmLabel: isActive ? "Désactiver" : "Réactiver",
        variant: isActive ? "destructive" : "primary",
      });
      if (!ok) return;

      const res = await toggleDentistActive(dentistId);
      if (!res.ok) {
        toast.error("Impossible de " + verb, { description: res.error.message });
        return;
      }
      toast.success(res.data.isActive ? "Dentiste réactivé" : "Dentiste désactivé");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={
        isActive
          ? "inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          : "inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      }
    >
      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
        {isActive ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        )}
      </svg>
      {isPending ? "…" : isActive ? "Désactiver" : "Réactiver"}
    </button>
  );
}
