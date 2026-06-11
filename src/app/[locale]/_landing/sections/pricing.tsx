"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PLAN_PRICING, type PlanKey } from "@/lib/billing/plan-pricing";

// Landing slug → canonical plan key, so the displayed amount is read from the
// single pricing source (`plan-pricing.ts`). The localised suffix stays in the
// message catalogue (per-locale currency + period wording).
const SLUG_TO_PLAN: Record<"starter" | "pro" | "plus", PlanKey> = {
  starter: "STARTER",
  pro: "PRO",
  plus: "CABINET_PLUS",
};

/**
 * Apple-style pricing — three plan cards inside one rounded section.
 * All copy translation-driven.
 */
export function Pricing() {
  const t = useTranslations("Landing.pricing");

  const plans = [
    {
      slug: "starter" as const,
      highlighted: false,
      features: [
        "1 dentiste",
        "Jusqu'à 10 patients",
        "Rappels J-1 WhatsApp",
        "Factures + ordonnances PDF",
        "1 utilisateur",
      ],
    },
    {
      slug: "pro" as const,
      highlighted: true,
      features: [
        "Jusqu'à 3 dentistes",
        "Patients illimités",
        "Bot IA WhatsApp (FR / EN / Darija)",
        "Recalls détartrage automatiques",
        "Plans de paiement + relances",
        "5 utilisateurs",
        "Support par email",
      ],
    },
    {
      slug: "plus" as const,
      highlighted: false,
      features: [
        "Dentistes illimités",
        "Patients illimités",
        "Tout du plan Pro",
        "Voice notes IA (transcription + voix)",
        "Utilisateurs illimités",
        "Support prioritaire WhatsApp",
        "Onboarding personnalisé",
      ],
    },
  ];

  return (
    <section id="pricing" className="relative px-3 py-3">
      <div className="mx-auto max-w-[1024px] px-6 py-20 md:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <div className="text-(--lp-ink-muted) text-[21px] leading-[1.19] font-semibold">
            {t("kicker")}
          </div>
          <h2
            className="text-(--lp-ink) mt-2 text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("headline")}
          </h2>
          <p className="text-(--lp-ink-muted) mx-auto mt-4 max-w-xl text-[19px] leading-[1.21]">
            {t("sub")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                delay: i * 0.08,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`relative flex flex-col p-8 ${
                p.highlighted ? "win11-card-elevated" : "win11-card"
              }`}
              style={
                p.highlighted
                  ? {
                      border: "1px solid rgba(34, 211, 238, 0.45)",
                      boxShadow:
                        "0 1px 2px rgba(0,0,0,0.45), 0 24px 56px -22px rgba(8, 145, 178, 0.45), 0 0 0 1px rgba(34,211,238,0.12)",
                    }
                  : undefined
              }
            >
              {p.highlighted ? (
                <div
                  className="win11-chip absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap"
                  style={{
                    boxShadow:
                      "0 4px 14px -4px rgba(34, 211, 238, 0.5), 0 0 0 1px rgba(255,255,255,0.25) inset",
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
                  </svg>
                  {t("recommended")}
                </div>
              ) : null}

              <div className="text-(--lp-ink) text-xl font-semibold tracking-tight">
                {t(`${p.slug}Name`)}
              </div>
              <p className="text-(--lp-ink-muted) mt-1 text-sm">
                {t(`${p.slug}Sub`)}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-(--lp-ink) text-[56px] leading-none font-semibold tracking-[-0.02em]">
                  {PLAN_PRICING[SLUG_TO_PLAN[p.slug]].amount}
                </span>
                <span className="text-(--lp-ink-muted) text-[13px]">
                  {t(`${p.slug}Suffix`)}
                </span>
              </div>

              <Link
                href={"/signup" as never}
                className="win11-btn-primary mt-6 inline-flex h-11 w-full items-center justify-center px-6 text-[15px]"
              >
                {t(`${p.slug}Cta`)}
              </Link>

              <ul className="mt-7 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg
                      className="mt-0.5 size-4 shrink-0 text-[#0e7490]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-(--lp-ink) leading-[1.4]">{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
