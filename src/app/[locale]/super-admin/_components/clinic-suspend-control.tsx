"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { setClinicSuspended } from "@/server/actions/super-admin";

/**
 * Suspend / reactivate toggle for the clinic detail page. Suspension is a
 * platform-owner lock independent of billing — confirmed before applying,
 * audited server-side.
 */
export function ClinicSuspendControl({
  clinicId,
  isSuspended,
}: {
  clinicId: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (!isSuspended) {
        const ok = await confirm({
          title: "Suspendre ce cabinet ?",
          description:
            "Tous les utilisateurs (sauf super-admin) seront immédiatement bloqués et redirigés vers un écran de suspension, jusqu'à réactivation.",
          confirmLabel: "Suspendre",
          variant: "destructive",
        });
        if (!ok) return;
      }
      const res = await setClinicSuspended({ clinicId, suspended: !isSuspended });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(isSuspended ? "Cabinet réactivé." : "Cabinet suspendu.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={
        isSuspended
          ? "inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          : "inline-flex h-9 items-center rounded-lg border border-rose-300 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
      }
    >
      {isSuspended ? "Réactiver le cabinet" : "Suspendre le cabinet"}
    </button>
  );
}
