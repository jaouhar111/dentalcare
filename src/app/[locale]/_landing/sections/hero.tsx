"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Hero — split layout: copy + CTAs on the left, the product hero image
 * (a 3D WhatsApp-booking scene) on the right. The section background is
 * set to the image's own background colour (#f1f6f9) so the image's
 * edges dissolve into the page and its content appears to float
 * directly on the hero. All copy comes from `Landing.hero`.
 */
export function Hero() {
  const t = useTranslations("Landing.hero");

  return (
    <section
      className="relative flex min-h-[88vh] items-center overflow-hidden px-6 pt-28 pb-16 md:pt-32"
      style={{ background: "#f1f6f9" }}
    >
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-14">
        {/* ── Copy ───────────────────────────────────────────────── */}
        <div className="text-center md:text-start">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-(--lp-ink) text-[clamp(40px,5vw,66px)] leading-[1.05] font-semibold tracking-[-0.015em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("wordmark")}
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-(--lp-ink-muted) mt-1 text-[clamp(40px,5vw,66px)] leading-[1.05] font-semibold tracking-[-0.015em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("tagline")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="text-(--lp-ink-muted) mx-auto mt-5 max-w-xl text-[clamp(17px,1.4vw,21px)] leading-[1.4] md:mx-0"
          >
            {t("sub")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 md:justify-start"
          >
            <Link
              href={"/signup" as never}
              className="win11-btn-primary inline-flex h-11 items-center justify-center px-6 text-[15px]"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href={"#story" as never}
              className="win11-btn-subtle inline-flex h-11 items-center justify-center px-5 text-[15px]"
            >
              {t("ctaSecondary")} <span aria-hidden className="ml-1">›</span>
            </Link>
          </motion.div>
        </div>

        {/* ── Product image (blends into the #f1f6f9 background) ──── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center md:justify-end"
        >
          <Image
            src="/landing/hero.jpeg"
            alt="DentalCare — la réceptionniste IA prend les rendez-vous sur WhatsApp, avec calendrier et statistiques en temps réel"
            width={896}
            height={1200}
            priority
            sizes="(min-width: 768px) 480px, 88vw"
            className="h-auto w-full max-w-[400px] md:max-w-[480px]"
          />
        </motion.div>
      </div>
    </section>
  );
}
