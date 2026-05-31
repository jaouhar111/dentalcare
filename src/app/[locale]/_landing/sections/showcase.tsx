"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * Full-bleed photograph showcase card with translated overlay copy.
 */
export function Showcase() {
  const t = useTranslations("Landing.showcase");

  return (
    <section className="bg-white px-3 py-3">
      <div className="relative mx-auto h-[480px] max-w-[1024px] overflow-hidden rounded-[18px] md:h-[640px]">
        <Image
          src="/landing/cabinet-interior.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0) 70%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-start px-6 pt-12 text-center md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-[13px] font-semibold tracking-[0.12em] text-white/90 uppercase"
          >
            {t("kicker")}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 max-w-3xl text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em] text-white"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("headline")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-4 max-w-xl text-[17px] leading-[1.4] text-white/85"
          >
            {t("sub")}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
