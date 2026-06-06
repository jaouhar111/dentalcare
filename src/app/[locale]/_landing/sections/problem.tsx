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
        className="relative mx-auto max-w-[1024px] overflow-hidden rounded-[16px] px-6 py-24 text-center md:py-32"
        style={{
          background:
            "linear-gradient(180deg, #1b1b1f 0%, #0f0f12 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Win11 dark Mica accent — two soft halos in the brand colours */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(50% 60% at 20% 0%, rgba(37,211,102,0.18), transparent 70%), radial-gradient(40% 50% at 90% 100%, rgba(201,169,110,0.16), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="relative mb-4 text-[14px] font-semibold tracking-[0.04em] text-[#5fea91] uppercase"
        >
          {t("kicker")}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-3xl text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em] text-[#f3f3f3]"
          style={{ fontFamily: "var(--lp-font-system)" }}
        >
          {t("headline")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="relative mx-auto mt-6 max-w-xl text-[19px] leading-[1.4] text-[#a6a6aa]"
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
            className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/[0.06] px-4 text-[14px] font-medium text-[#f3f3f3] backdrop-blur transition-colors hover:bg-white/[0.12]"
          >
            {t("ctaHow")} <span aria-hidden className="ml-1">›</span>
          </Link>
          <Link
            href={"#pricing" as never}
            className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/[0.06] px-4 text-[14px] font-medium text-[#f3f3f3] backdrop-blur transition-colors hover:bg-white/[0.12]"
          >
            {t("ctaPricing")} <span aria-hidden className="ml-1">›</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
