"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * Apple-style trust strip — three centred number-tiles inside a
 * single rounded Apple-gray card. Translation-driven.
 */
export function TrustStrip() {
  const t = useTranslations("Landing.trust");

  return (
    <section className="px-3 py-3">
      <div className="win11-card mx-auto max-w-[1024px] px-6 py-16 text-center md:py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-6">
          <Stat big={t("stat1Big")} caption={t("stat1Caption")} delay={0} />
          <Stat big={t("stat2Big")} caption={t("stat2Caption")} delay={0.1} />
          <Stat big={t("stat3Big")} caption={t("stat3Caption")} delay={0.2} />
        </div>
      </div>
    </section>
  );
}

function Stat({ big, caption, delay }: { big: string; caption: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="bg-clip-text text-[64px] leading-none font-semibold tracking-[-0.02em] text-transparent md:text-[80px]"
        style={{
          fontFamily: "var(--lp-font-system)",
          backgroundImage:
            "linear-gradient(135deg, #155e75 0%, #0891b2 60%, #06b6d4 120%)",
        }}
      >
        {big}
      </div>
      <p className="text-(--lp-ink-muted) mx-auto mt-3 max-w-[14rem] text-[15px] leading-[1.4]">
        {caption}
      </p>
    </motion.div>
  );
}
