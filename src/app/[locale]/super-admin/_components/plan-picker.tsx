"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { SubscriptionPlan } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { setClinicPlan } from "@/server/actions/super-admin";

/**
 * Plan picker — three cards (Starter / Pro / Cabinet+) matching the
 * landing page tiers. SUPER_ADMIN clicks one to switch the cabinet's
 * plan. The currently-active plan gets a thick cyan border + check
 * pill; the other two are clickable.
 *
 * Status (TRIAL / ACTIVE / PAST_DUE / CANCELLED) is orthogonal —
 * see `ClinicRowActions` for that toggle.
 */

type PlanSpec = {
  plan: SubscriptionPlan;
  name: string;
  price: string;
  priceSuffix: string;
  tagline: string;
  features: string[];
};

const PLANS: PlanSpec[] = [
  {
    plan: "STARTER",
    name: "Starter",
    price: "0",
    priceSuffix: "MAD / mois",
    tagline: "Découverte",
    features: [
      "1 dentiste",
      "100 patients max",
      "Rappels J-1",
      "Factures PDF",
      "1 utilisateur",
    ],
  },
  {
    plan: "PRO",
    name: "Pro",
    price: "499",
    priceSuffix: "MAD / mois",
    tagline: "Le plus populaire",
    features: [
      "3 dentistes",
      "Patients illimités",
      "Bot IA WhatsApp",
      "Recalls automatiques",
      "Plans de paiement",
      "5 utilisateurs",
    ],
  },
  {
    plan: "CABINET_PLUS",
    name: "Cabinet+",
    price: "999",
    priceSuffix: "MAD / mois",
    tagline: "Grandes équipes",
    features: [
      "Dentistes illimités",
      "Tout du Pro",
      "Voice notes IA",
      "Utilisateurs illimités",
      "Support prioritaire",
      "Onboarding inclus",
    ],
  },
];

export function PlanPicker({
  clinicId,
  currentPlan,
}: {
  clinicId: string;
  currentPlan: SubscriptionPlan;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(plan: SubscriptionPlan) {
    if (plan === currentPlan) return;
    const name = PLANS.find((p) => p.plan === plan)?.name ?? plan;
    startTransition(async () => {
      const res = await setClinicPlan({ clinicId, plan });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Plan ${name} activé.`);
      router.refresh();
    });
  }

  return (
    <section className="apple-card">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Plan d&apos;abonnement
        </h2>
        <span className="text-muted-foreground text-[11px]">
          Clic = activation immédiate · audit log généré
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = p.plan === currentPlan;
          return (
            <button
              key={p.plan}
              type="button"
              onClick={() => switchTo(p.plan)}
              disabled={isPending || active}
              className={`relative flex flex-col rounded-2xl border p-5 text-start transition ${
                active
                  ? "border-primary bg-primary/5 cursor-default shadow-[0_0_0_3px_var(--accent-glow)]"
                  : "border-border/60 hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
              } ${isPending && !active ? "opacity-60" : ""}`}
            >
              {active ? (
                <span className="bg-primary absolute -top-2.5 -right-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-white uppercase shadow-[0_2px_8px_var(--accent-glow)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Actif
                </span>
              ) : null}
              <div className="text-foreground text-[16px] font-bold tracking-tight">
                {p.name}
              </div>
              <div className="text-muted-foreground mt-0.5 text-[11px]">
                {p.tagline}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-foreground num text-[32px] leading-none font-bold tracking-tight">
                  {p.price}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {p.priceSuffix}
                </span>
              </div>
              <ul className="mt-4 space-y-1.5 text-[12px]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <svg
                      className={`mt-0.5 size-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}
