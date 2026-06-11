"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SubscriptionStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { setClinicSubscription } from "@/server/actions/super-admin";

/**
 * Trial-deadline editor. Two ways to set the end, for full flexibility:
 *   - preset chips / free-form days → extend from now (`extendDays`)
 *   - a date picker → pin the exact end day (`trialEndsOn`)
 *
 * Both route through `setClinicSubscription(TRIAL, …)`. The date picker is
 * pre-filled with the current trial end so the owner nudges it rather than
 * retyping. Status is switched to TRIAL when it wasn't already.
 */

const PRESETS = [7, 14, 30];

/** Local `yyyy-mm-dd` for a Date — `toISOString` would shift by the tz. */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function ExtendTrialPopover({
  clinicId,
  currentStatus,
  currentTrialEndsAt,
}: {
  clinicId: string;
  currentStatus: SubscriptionStatus;
  /// ISO string of the current trial end, to pre-fill the date picker.
  currentTrialEndsAt?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customDays, setCustomDays] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(() =>
    currentTrialEndsAt ? toDateInput(new Date(currentTrialEndsAt)) : "",
  );
  const [isPending, startTransition] = useTransition();

  function apply(
    payload: { extendDays: number } | { trialEndsOn: string },
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await setClinicSubscription({
        clinicId,
        status: SubscriptionStatus.TRIAL,
        ...payload,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(successMsg);
      setOpen(false);
      setCustomDays("");
      router.refresh();
    });
  }

  function callDays(days: number) {
    if (!Number.isInteger(days) || days <= 0 || days > 365) {
      toast.error("Entre 1 et 365 jours.");
      return;
    }
    apply(
      { extendDays: days },
      `Essai fixé à ${days} jour${days > 1 ? "s" : ""} à partir d'aujourd'hui.`,
    );
  }

  function callDate() {
    if (!endDate) {
      toast.error("Choisis une date de fin.");
      return;
    }
    apply({ trialEndsOn: endDate }, `Fin d'essai fixée au ${endDate}.`);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 text-[11px] font-medium text-[#1d1d1f] ring-1 ring-black/[0.06] transition hover:bg-[#ebebed] dark:bg-white/[0.06] dark:text-white"
      >
        Essai
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
          <div className="absolute right-0 z-40 mt-1.5 w-64 origin-top-right rounded-2xl bg-white p-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] dark:bg-[#1c1c1e] dark:ring-white/[0.08]">
            {/* ── Date de fin précise ─────────────────────── */}
            <div className="mb-1.5 text-[10px] font-semibold tracking-[0.06em] text-[#6e6e73] uppercase">
              Date de fin d&apos;essai
            </div>
            <div className="mb-3 flex items-center gap-1.5">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending}
                className="min-w-0 flex-1 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[12px] ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none disabled:opacity-50 dark:bg-white/[0.06]"
              />
              <button
                type="button"
                disabled={isPending || !endDate}
                onClick={callDate}
                className="bg-[#0071e3] disabled:opacity-50 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0077ed]"
              >
                Définir
              </button>
            </div>

            <div className="my-2 h-px bg-black/[0.06] dark:bg-white/[0.08]" />

            {/* ── Raccourcis +jours (à partir d'aujourd'hui) ── */}
            <div className="mb-2 text-[10px] font-semibold tracking-[0.06em] text-[#6e6e73] uppercase">
              Ou à partir d&apos;aujourd&apos;hui
            </div>
            <div className="mb-3 flex gap-1.5">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isPending}
                  onClick={() => callDays(d)}
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
                onClick={() => callDays(parseInt(customDays, 10))}
                className="bg-[#1d1d1f] disabled:opacity-50 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black dark:bg-white/[0.14]"
              >
                OK
              </button>
            </div>

            {currentStatus !== SubscriptionStatus.TRIAL ? (
              <p className="mt-2 text-[10px] leading-[1.4] text-[#6e6e73]">
                Le statut sera basculé sur Essai.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
