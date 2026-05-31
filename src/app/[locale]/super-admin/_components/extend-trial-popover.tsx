"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SubscriptionStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { setClinicSubscription } from "@/server/actions/super-admin";

/**
 * Compact "extend trial" widget — preset chips for the common
 * extensions (7 / 14 / 30 j) + a free-form number input for anything
 * else. Calling `setClinicSubscription(TRIAL, extendDays)` extends
 * the trial deadline from `now` (not from the current trialEndsAt) —
 * that's the existing helper's contract.
 */

const PRESETS = [7, 14, 30];

export function ExtendTrialPopover({
  clinicId,
  currentStatus,
}: {
  clinicId: string;
  currentStatus: SubscriptionStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customDays, setCustomDays] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function call(days: number) {
    if (days <= 0 || days > 365) {
      toast.error("Entre 1 et 365 jours.");
      return;
    }
    startTransition(async () => {
      const res = await setClinicSubscription({
        clinicId,
        status: SubscriptionStatus.TRIAL,
        extendDays: days,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Essai prolongé de ${days} jour${days > 1 ? "s" : ""}.`);
      setOpen(false);
      setCustomDays("");
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 text-[11px] font-medium text-[#1d1d1f] ring-1 ring-black/[0.06] transition hover:bg-[#ebebed] dark:bg-white/[0.06] dark:text-white"
      >
        +jours
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <>
          {/* click-outside catcher */}
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 z-40 mt-1.5 w-56 origin-top-right rounded-2xl bg-white p-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] dark:bg-[#1c1c1e] dark:ring-white/[0.08]">
            <div className="mb-2 text-[10px] font-semibold tracking-[0.06em] text-[#6e6e73] uppercase">
              Prolonger l&apos;essai
            </div>
            <div className="mb-3 flex gap-1.5">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isPending}
                  onClick={() => call(d)}
                  className="flex-1 rounded-full bg-[#f5f5f7] px-2 py-1.5 text-[12px] font-semibold text-[#1d1d1f] transition hover:bg-[#ebebed] disabled:opacity-50 dark:bg-white/[0.08] dark:text-white"
                >
                  +{d}j
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="Personnalisé"
                disabled={isPending}
                className="min-w-0 flex-1 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none disabled:opacity-50 dark:bg-white/[0.06]"
              />
              <button
                type="button"
                disabled={isPending || !customDays}
                onClick={() => call(parseInt(customDays, 10))}
                className="bg-[#0071e3] disabled:opacity-50 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0077ed]"
              >
                OK
              </button>
            </div>
            {currentStatus !== SubscriptionStatus.TRIAL ? (
              <p className="mt-2 text-[10px] leading-[1.4] text-[#6e6e73]">
                Le statut sera basculé sur TRIAL.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
