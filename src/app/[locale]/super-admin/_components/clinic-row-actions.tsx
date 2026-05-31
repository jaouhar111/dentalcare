"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { SubscriptionStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { setClinicSubscription } from "@/server/actions/super-admin";

/**
 * Per-row quick actions on the /super-admin clinics table. Three
 * verbs, all idempotent server-side:
 *   - Extend trial: +14 days (or starts a new TRIAL if Cancelled).
 *   - Activate: flip to ACTIVE + clear trialEndsAt.
 *   - Past-due: flip to PAST_DUE (Stripe webhook will use this later).
 */
export function ClinicRowActions({
  clinicId,
  status,
}: {
  clinicId: string;
  status: SubscriptionStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function call(
    newStatus: SubscriptionStatus,
    extendDays?: number,
    successMsg = "Mis à jour.",
  ) {
    startTransition(async () => {
      const res = await setClinicSubscription({ clinicId, status: newStatus, extendDays });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== SubscriptionStatus.ACTIVE ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => call(SubscriptionStatus.ACTIVE, undefined, "Cabinet activé.")}
          className="h-7 px-2 text-[11px]"
        >
          Activer
        </Button>
      ) : null}
      {status === SubscriptionStatus.TRIAL || status === SubscriptionStatus.CANCELLED ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => call(SubscriptionStatus.TRIAL, 14, "Essai prolongé +14 jours.")}
          className="h-7 px-2 text-[11px]"
        >
          +14j
        </Button>
      ) : null}
      {status !== SubscriptionStatus.PAST_DUE && status !== SubscriptionStatus.CANCELLED ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => call(SubscriptionStatus.PAST_DUE, undefined, "Marqué impayé.")}
          className="text-muted-foreground hover:text-amber-700 h-7 px-2 text-[11px]"
        >
          Impayé
        </Button>
      ) : null}
    </div>
  );
}
