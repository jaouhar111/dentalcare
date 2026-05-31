"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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
        "Jusqu'à 100 patients",
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
    <section id="pricing" className="bg-white px-3 py-3">
      <div className="mx-auto max-w-[1024px] rounded-[18px] bg-white px-6 py-20 md:py-28">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <div className="text-[var(--lp-ink-muted)] text-[21px] leading-[1.19] font-semibold">
            {t("kicker")}
          </div>
          <h2
            className="text-[var(--lp-ink)] mt-2 text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("headline")}
          </h2>
          <p className="text-[var(--lp-ink-muted)] mx-auto mt-4 max-w-xl text-[19px] leading-[1.21]">
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
              className="relative flex flex-col rounded-[18px] bg-[#f5f5f7] p-8"
              style={
                p.highlighted
                  ? {
                      boxShadow:
                        "inset 0 0 0 2px #0071e3, 0 12px 30px -18px rgba(0, 113, 227, 0.4)",
                    }
                  : undefined
              }
            >
              {p.highlighted ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0071e3] px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-white uppercase">
                  {t("recommended")}
                </div>
              ) : null}

              <div className="text-[var(--lp-ink)] text-[20px] font-semibold tracking-tight">
                {t(`${p.slug}Name`)}
              </div>
              <p className="text-[var(--lp-ink-muted)] mt-1 text-[14px]">
                {t(`${p.slug}Sub`)}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-[var(--lp-ink)] text-[56px] leading-none font-semibold tracking-[-0.02em]">
                  {t(`${p.slug}Price`)}
                </span>
                <span className="text-[var(--lp-ink-muted)] text-[13px]">
                  {t(`${p.slug}Suffix`)}
                </span>
              </div>

              <Link
                href={"/signup" as never}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0071e3] px-6 text-[15px] font-normal text-white transition-colors hover:bg-[#0077ed]"
              >
                {t(`${p.slug}Cta`)}
              </Link>

              <ul className="mt-7 space-y-3 text-[14px]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg
                      className="mt-0.5 size-4 shrink-0 text-[#0066cc]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[var(--lp-ink)] leading-[1.4]">{f}</span>
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
