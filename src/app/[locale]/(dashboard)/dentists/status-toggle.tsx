"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { toggleDentistActive } from "@/server/actions/dentists";

/**
 * Inline active/inactive pill used inside the dentists table. Single-click
 * toggles the dentist's active flag — no confirmation dialog, the action
 * is fully reversible. Uses an optimistic update so the badge flips
 * instantly; on server failure we revert and surface the error.
 */
export function DentistStatusToggle({
  dentistId,
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
  const [optimistic, setOptimistic] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = await toggleDentistActive(dentistId);
      if (!res.ok) {
        // Revert optimistic toggle so the badge matches the truth.
        setOptimistic(!next);
        toast.error("Échec de la mise à jour", { description: res.error.message });
        return;
      }
      // The server is authoritative — re-sync with whatever it returned.
      setOptimistic(res.data.isActive);
      toast.success(res.data.isActive ? "Dentiste réactivé" : "Dentiste désactivé");
      router.refresh();
    });
  }

  const showAsActive = optimistic;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={
        showAsActive
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 transition disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground transition disabled:opacity-60 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
      }
      title={showAsActive ? "Cliquer pour désactiver" : "Cliquer pour réactiver"}
    >
      {isPending ? (
        <span
          aria-hidden
          className="inline-block size-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <span aria-hidden>{showAsActive ? "●" : "○"}</span>
      )}
      {showAsActive ? activeLabel : inactiveLabel}
    </button>
  );
}
