"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeroImageSlot } from "../hero-image-slot";

/**
 * Apple-style hero — wordmark, tagline, two CTAs, product visual.
 * All copy comes from `Landing.hero` so FR ↔ EN switches at runtime.
 *
 * Buttons use inline Tailwind utilities (not custom CSS classes) so
 * their colors survive Turbopack's CSS layering rules without
 * depending on a separate `.lp-btn-filled` class.
 */
export function Hero() {
  const t = useTranslations("Landing.hero");

  return (
    <section className="relative pt-24 pb-16 text-center md:pt-32 md:pb-20">
      {/* Mica accent — a soft green halo blooms from behind the wordmark
          to anchor the WhatsApp angle without overwhelming the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] opacity-90"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(37,211,102,0.16), transparent 70%), radial-gradient(40% 60% at 80% 20%, rgba(201,169,110,0.14), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-[1024px] px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[var(--lp-ink)] text-[clamp(48px,8vw,96px)] leading-[1.05] font-semibold tracking-[-0.015em]"
          style={{ fontFamily: "var(--lp-font-system)" }}
        >
          {t("wordmark")}
        </motion.h1>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[var(--lp-ink-muted)] mt-1 text-[clamp(48px,8vw,96px)] leading-[1.05] font-semibold tracking-[-0.015em]"
          style={{ fontFamily: "var(--lp-font-system)" }}
        >
          {t("tagline")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="text-[var(--lp-ink-muted)] mx-auto mt-5 max-w-2xl text-[clamp(19px,1.7vw,28px)] leading-[1.21]"
        >
          {t("sub")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.6 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex justify-center md:mt-16"
        >
          <HeroImageSlot fallback={<div className="w-full max-w-sm"><ChatTile /></div>} />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Synthetic WhatsApp chat tile — rendered when no committed hero
 * image is present. Kept locale-agnostic so it stays acceptable in
 * either FR or EN mode (a French sample chat reads fine to an EN
 * visitor: it demonstrates the product's actual locale).
 */
function ChatTile() {
  const messages = [
    { side: "patient", text: "Bonjour, j'ai mal à une dent depuis hier soir.", delay: 1.0 },
    {
      side: "bot",
      text:
        "Je suis désolé. Voici le créneau d'urgence le plus proche : vendredi 09h00. Ça vous convient ?",
      delay: 1.6,
    },
    { side: "patient", text: "Oui parfait, merci 🙏", delay: 2.6 },
    {
      side: "bot",
      text: "C'est confirmé. RDV vendredi à 09h00. À très vite.",
      delay: 3.2,
    },
  ];

  return (
    <div className="win11-card-elevated relative w-full max-w-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--lp-line)] px-4 py-3">
        <span
          className="grid size-8 place-items-center rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
          </svg>
        </span>
        <div className="leading-tight">
          <div className="text-[var(--lp-ink)] text-[13px] font-semibold">DentalCare</div>
          <div className="text-[var(--lp-ink-dim)] text-[10px]">en ligne · IA active</div>
        </div>
      </div>
      <div className="space-y-3 px-4 py-5">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: m.delay, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className={
              m.side === "patient"
                ? "ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#dcf8c6] px-3.5 py-2 text-[13px] leading-snug text-[#0c3927]"
                : "mr-auto max-w-[82%] rounded-2xl rounded-bl-md bg-[#f5f5f7] px-3.5 py-2 text-[13px] leading-snug text-[var(--lp-ink)]"
            }
          >
            {m.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
