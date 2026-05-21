"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { toggleDentistActive } from "@/server/actions/dentists";

/**
 * Inline active/inactive pill used inside the dentists table. Clicking it
 * toggles the dentist's active flag (with a confirm dialog) without leaving
 * the list page. `stopPropagation` prevents the row's outer `<Link>` from
 * stealing the click and navigating to the detail page.
 */
export function DentistStatusToggle({
  dentistId,
  dentistName,
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  dentistId: string;
  dentistName: string;
  isActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const ok = await confirm({
        title: isActive
          ? `Désactiver Dr ${dentistName} ?`
          : `Réactiver Dr ${dentistName} ?`,
        description: isActive
          ? "Il ne pourra plus se voir attribuer de nouveaux rendez-vous. Son historique reste consultable."
          : "Il réapparaîtra dans les sélecteurs RDV et soins.",
        confirmLabel: isActive ? "Désactiver" : "Réactiver",
        variant: isActive ? "destructive" : "primary",
      });
      if (!ok) return;

      const res = await toggleDentistActive(dentistId);
      if (!res.ok) {
        toast.error("Impossible de basculer le statut", {
          description: res.error.message,
        });
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
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 transition disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground transition disabled:opacity-50 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
      }
      title={isActive ? "Cliquer pour désactiver" : "Cliquer pour réactiver"}
    >
      {isPending ? (
        <span className="border-current inline-block size-2.5 animate-spin rounded-full border-2 border-t-transparent" />
      ) : (
        <span aria-hidden>{isActive ? "●" : "○"}</span>
      )}
      {isActive ? activeLabel : inactiveLabel}
    </button>
  );
}
