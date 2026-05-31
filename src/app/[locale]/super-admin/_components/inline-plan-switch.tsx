"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { SubscriptionPlan } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { setClinicPlan } from "@/server/actions/super-admin";

/**
 * Tiny inline plan switcher — a native `<select>` styled as a pill,
 * dropped into the subscriptions table row. Calls `setClinicPlan` on
 * change with optimistic UI (toast on success, router.refresh).
 */

const OPTIONS: Array<{ value: SubscriptionPlan; label: string; price: string }> = [
  { value: "STARTER", label: "Starter", price: "0" },
  { value: "PRO", label: "Pro", price: "499" },
  { value: "CABINET_PLUS", label: "Cabinet+", price: "999" },
];

export function InlinePlanSwitch({
  clinicId,
  currentPlan,
}: {
  clinicId: string;
  currentPlan: SubscriptionPlan;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SubscriptionPlan;
    if (next === currentPlan) return;
    const label = OPTIONS.find((o) => o.value === next)?.label ?? next;
    startTransition(async () => {
      const res = await setClinicPlan({ clinicId, plan: next });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Plan ${label} activé.`);
      router.refresh();
    });
  }

  return (
    <select
      value={currentPlan}
      onChange={onChange}
      disabled={isPending}
      aria-label="Changer de plan"
      className="cursor-pointer rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06] transition hover:bg-[#ebebed] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none disabled:opacity-50 dark:bg-white/[0.06] dark:text-white"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
