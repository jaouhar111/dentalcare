"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { setClinicFeatureOverride } from "@/server/actions/super-admin";

type Feature = "aiReceptionist" | "voiceNotes" | "recalls" | "paymentPlans";

const FEATURES: { key: Feature; label: string }[] = [
  { key: "aiReceptionist", label: "Réceptionniste IA" },
  { key: "voiceNotes", label: "Notes vocales IA" },
  { key: "recalls", label: "Recalls automatiques" },
  { key: "paymentPlans", label: "Plans de paiement" },
];

const CHOICES: { k: "default" | "on" | "off"; label: string; value: boolean | null }[] = [
  { k: "default", label: "Défaut", value: null },
  { k: "on", label: "Activé", value: true },
  { k: "off", label: "Désactivé", value: false },
];

/**
 * Per-cabinet feature overrides (P2-10). Each feature is a 3-state control:
 * Défaut (= plan), Activé, Désactivé — forcing it on/off regardless of plan.
 */
export function ClinicFeatureFlags({
  clinicId,
  overrides,
  defaults,
}: {
  clinicId: string;
  overrides: Record<Feature, boolean | null>;
  defaults: Record<Feature, boolean>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function set(feature: Feature, value: boolean | null) {
    startTransition(async () => {
      const res = await setClinicFeatureOverride({ clinicId, feature, value });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Fonctionnalité mise à jour.");
      router.refresh();
    });
  }

  return (
    <section className="apple-card">
      <div className="apple-kpi-label mb-1">Fonctionnalités · override du plan</div>
      <p className="text-muted-foreground mb-4 text-[12px]">
        Forcer une fonctionnalité indépendamment du plan (ex. activer l&apos;IA
        pour une démo). « Défaut » suit le plan.
      </p>
      <div className="divide-border/50 divide-y">
        {FEATURES.map((f) => {
          const ov = overrides[f.key];
          const current: "default" | "on" | "off" =
            ov === null ? "default" : ov ? "on" : "off";
          return (
            <div
              key={f.key}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div>
                <div className="text-foreground text-[13px] font-medium">{f.label}</div>
                <div className="text-muted-foreground text-[11px]">
                  Plan : {defaults[f.key] ? "activé" : "désactivé"}
                </div>
              </div>
              <div className="inline-flex rounded-full bg-black/[0.04] p-0.5 ring-1 ring-black/[0.04] dark:bg-white/[0.06]">
                {CHOICES.map((c) => (
                  <button
                    key={c.k}
                    type="button"
                    disabled={isPending}
                    onClick={() => set(f.key, c.value)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                      current === c.k
                        ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
