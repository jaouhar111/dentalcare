"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import {
  sendUserPasswordReset,
  setUserActive,
} from "@/server/actions/super-admin-users";

/**
 * Inline support actions for a row of the platform users table:
 * deactivate / reactivate an account and send a password-reset email.
 * Disabled (rendered as "—") for the acting super-admin's own row and
 * for other SUPER_ADMIN accounts — the server enforces the same guards.
 */
export function UserRowActions({
  userId,
  isActive,
  canManage,
}: {
  userId: string;
  isActive: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  if (!canManage) {
    return <span className="text-muted-foreground text-[11px]">—</span>;
  }

  function toggleActive() {
    startTransition(async () => {
      if (isActive) {
        const ok = await confirm({
          title: "Désactiver ce compte ?",
          description:
            "L'utilisateur ne pourra plus se connecter tant qu'il n'est pas réactivé.",
          confirmLabel: "Désactiver",
          variant: "destructive",
        });
        if (!ok) return;
      }
      const res = await setUserActive({ userId, isActive: !isActive });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(isActive ? "Compte désactivé." : "Compte réactivé.");
      router.refresh();
    });
  }

  function resetPassword() {
    startTransition(async () => {
      const res = await sendUserPasswordReset({ userId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Email de réinitialisation envoyé.");
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleActive}
        disabled={isPending}
        className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition disabled:opacity-50 ${
          isActive
            ? "text-rose-700 ring-rose-300/70 hover:bg-rose-50 dark:text-rose-300 dark:ring-rose-500/30"
            : "text-emerald-700 ring-emerald-300/70 hover:bg-emerald-50 dark:text-emerald-300 dark:ring-emerald-500/30"
        }`}
      >
        {isActive ? "Désactiver" : "Réactiver"}
      </button>
      <button
        type="button"
        onClick={resetPassword}
        disabled={isPending}
        className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-black/[0.08] transition disabled:opacity-50 dark:ring-white/[0.1]"
      >
        Reset MDP
      </button>
    </div>
  );
}
