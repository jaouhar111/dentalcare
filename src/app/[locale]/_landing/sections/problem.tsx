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
      <div className="mx-auto max-w-[1024px] rounded-[18px] bg-black px-6 py-24 text-center md:py-32">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="mb-4 text-[14px] font-semibold tracking-[0.04em] text-[#2997ff] uppercase"
        >
          {t("kicker")}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em] text-[#f5f5f7]"
          style={{ fontFamily: "var(--lp-font-system)" }}
        >
          {t("headline")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mx-auto mt-6 max-w-xl text-[19px] leading-[1.4] text-[#a1a1a6]"
        >
          {t("sub")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          <Link
            href={"#features" as never}
            className="text-[17px] font-normal text-[#2997ff] hover:underline"
          >
            {t("ctaHow")} <span aria-hidden>›</span>
          </Link>
          <Link
            href={"#pricing" as never}
            className="text-[17px] font-normal text-[#2997ff] hover:underline"
          >
            {t("ctaPricing")} <span aria-hidden>›</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
