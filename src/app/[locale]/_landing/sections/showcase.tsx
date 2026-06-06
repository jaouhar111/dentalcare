"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * Win11 Fluent showcase — full-bleed cabinet photograph framed by the
 * win11-card recipe, with an acrylic chip floating on top to anchor the
 * Mica vocabulary. The gradient overlay now leans on the brand greens
 * and golds instead of pure black so the photo bridges into the rest of
 * the landing's palette.
 */
export function Showcase() {
  const t = useTranslations("Landing.showcase");

  return (
    <section className="px-3 py-3">
      <div
        className="win11-card-elevated relative mx-auto h-[480px] max-w-[1024px] overflow-hidden md:h-[640px]"
        style={{ borderRadius: 24 }}
      >
        <Image
          src="/landing/cabinet-interior.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
        {/* Top tint — keeps the kicker readable on bright photos. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15, 15, 18, 0.55) 0%, rgba(15, 15, 18, 0.18) 30%, transparent 60%)",
          }}
        />
        {/* Brand halo — Mica vibe extended onto the photo edges. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(35% 50% at 0% 100%, rgba(37,211,102,0.20), transparent 70%), radial-gradient(40% 50% at 100% 100%, rgba(201,169,110,0.18), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-start px-6 pt-12 text-center md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            /* Acrylic chip — sits on the photo, mimics Win11's contextual
               "scene" labels on the Settings background-picker. */
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[11px] font-semibold tracking-[0.10em] text-white uppercase backdrop-blur-md"
          >
            <span
              className="size-1.5 rounded-full bg-[#25d366]"
              aria-hidden
            />
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
