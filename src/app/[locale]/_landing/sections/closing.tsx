"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Apple-style closing — black story card + minimal footer.
 */
export function Closing() {
  const t = useTranslations("Landing.closing");
  const year = new Date().getFullYear();

  return (
    <>
      <section className="px-3 py-3">
        <div
          className="relative mx-auto max-w-[1024px] overflow-hidden rounded-[16px] px-6 py-24 text-center md:py-32"
          style={{
            background:
              "linear-gradient(180deg, #1b1b1f 0%, #0f0f12 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(45% 60% at 50% 0%, rgba(37,211,102,0.22), transparent 70%), radial-gradient(40% 50% at 50% 100%, rgba(201,169,110,0.16), transparent 70%)",
            }}
          />
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
            className="relative mx-auto mt-5 max-w-xl text-[19px] leading-[1.4] text-[#a6a6aa]"
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
              href={"/signup" as never}
              className="win11-btn-primary inline-flex h-11 items-center justify-center px-6 text-[15px]"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href={"/login" as never}
              className="inline-flex h-11 items-center rounded-md border border-white/10 bg-white/[0.06] px-5 text-[15px] font-medium text-[#f3f3f3] backdrop-blur transition-colors hover:bg-white/[0.12]"
            >
              {t("ctaSecondary")} <span aria-hidden className="ml-1">›</span>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="bg-transparent">
        <div className="mx-auto max-w-[1024px] px-6 pt-12 pb-10">
          <p className="text-[var(--lp-ink-dim)] mb-6 text-[12px] leading-[1.5]">
            {t("compliance")}
          </p>
          <div className="border-t border-[var(--lp-line)] pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-[var(--lp-ink-dim)] text-[12px]">
                Copyright © {year} DentalCare. {t("copyright")}
              </div>
              <div className="text-[var(--lp-ink-dim)] flex flex-wrap gap-5 text-[12px]">
                <Link
                  href={"/legal/terms" as never}
                  className="hover:text-[var(--lp-ink)] transition-colors"
                >
                  {t("terms")}
                </Link>
                <Link
                  href={"/legal/privacy" as never}
                  className="hover:text-[var(--lp-ink)] transition-colors"
                >
                  {t("privacy")}
                </Link>
                <a
                  href="mailto:support@dentalcare.ma"
                  className="hover:text-[var(--lp-ink)] transition-colors"
                >
                  {t("contact")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
