"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Black story card — Apple's premium-product treatment. Translation-driven.
 */
export function Problem() {
  const t = useTranslations("Landing.problem");

  return (
    <section id="story" className="px-3 py-3">
      <div
        className="relative mx-auto max-w-[1024px] overflow-hidden rounded-2xl px-6 py-24 text-center md:py-32"
        style={{
          background:
            "linear-gradient(160deg, #ffffff 0%, #f0fbff 55%, #e2f6fe 100%)",
          boxShadow:
            "0 0 0 1px rgba(8,145,178,0.12) inset, 0 1px 2px rgba(15,23,42,0.04), 0 28px 64px -30px rgba(15,23,42,0.16)",
        }}
      >
        {/* Soft cyan halos bleeding from the corners */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(50% 60% at 18% 0%, rgba(8,145,178,0.12), transparent 70%), radial-gradient(45% 55% at 92% 100%, rgba(2,132,199,0.12), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="relative mb-4 text-sm font-semibold tracking-[0.04em] text-[#0e7490] uppercase"
        >
          {t("kicker")}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-3xl text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em] text-(--lp-ink)"
          style={{ fontFamily: "var(--lp-font-system)" }}
        >
          {t("headline")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="relative mx-auto mt-6 max-w-xl text-[19px] leading-[1.4] text-(--lp-ink-muted)"
        >
          {t("sub")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="relative mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-3"
        >
          <Link
            href={"#features" as never}
            className="win11-btn-subtle inline-flex h-10 items-center px-4 text-sm"
          >
            {t("ctaHow")} <span aria-hidden className="ml-1">›</span>
          </Link>
          <Link
            href={"#pricing" as never}
            className="win11-btn-subtle inline-flex h-10 items-center px-4 text-sm"
          >
            {t("ctaPricing")} <span aria-hidden className="ml-1">›</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
