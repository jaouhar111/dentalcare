"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * Apple "What's new" 2×2 feature grid — translation-driven. The first
 * tile gets the dark treatment so the grid doesn't read as four
 * identical squares.
 */
type Tone = "white" | "dark" | "gray" | "tint";

const TILE_KEYS: { id: 1 | 2 | 3 | 4; tone: Tone; badge: React.ReactNode }[] = [
  { id: 1, tone: "dark", badge: <ChatBadge /> },
  { id: 2, tone: "white", badge: <BellBadge /> },
  { id: 3, tone: "tint", badge: <ClockBadge /> },
  { id: 4, tone: "gray", badge: <GridBadge /> },
];

export function HorizontalFeatures() {
  const t = useTranslations("Landing.features");

  return (
    <section id="features" className="bg-white px-3 py-3">
      <div className="mx-auto max-w-[1024px]">
        <div className="px-3 pt-12 pb-6 text-center md:pt-20 md:pb-10">
          <div className="text-[var(--lp-ink-muted)] text-[21px] leading-[1.19] font-semibold">
            {t("kicker")}
          </div>
          <h2
            className="text-[var(--lp-ink)] mt-2 text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("headline")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {TILE_KEYS.map((tile, i) => (
            <TileCard
              key={tile.id}
              tone={tile.tone}
              badge={tile.badge}
              kicker={t(`t${tile.id}Kicker`)}
              title={t(`t${tile.id}Title`)}
              body={t(`t${tile.id}Body`)}
              delay={i * 0.08}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TileCard({
  tone,
  badge,
  kicker,
  title,
  body,
  delay,
}: {
  tone: Tone;
  badge: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
  delay: number;
}) {
  const isDark = tone === "dark";
  const bg =
    tone === "dark"
      ? "bg-black"
      : tone === "gray"
        ? "bg-[#f5f5f7]"
        : tone === "tint"
          ? "bg-[#fbfbfd]"
          : "bg-white border border-[var(--lp-line)]";
  const text = isDark ? "#f5f5f7" : "var(--lp-ink)";
  const muted = isDark ? "#a1a1a6" : "var(--lp-ink-muted)";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[18px] p-8 md:p-12 ${bg}`}
    >
      <div className="mb-6 md:mb-10">{badge}</div>
      <div
        className="text-[13px] font-semibold tracking-[0.04em] uppercase"
        style={{ color: isDark ? "#2997ff" : "#0066cc" }}
      >
        {kicker}
      </div>
      <h3
        className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.012em] md:text-[36px]"
        style={{ color: text, fontFamily: "var(--lp-font-system)" }}
      >
        {title}
      </h3>
      <p className="mt-3 max-w-md text-[17px] leading-[1.45]" style={{ color: muted }}>
        {body}
      </p>
    </motion.article>
  );
}

function ChatBadge() {
  return (
    <div
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
      style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
      </svg>
    </div>
  );
}

function BellBadge() {
  return (
    <div
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
      style={{ background: "linear-gradient(135deg, #0071e3, #0066cc)" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </div>
  );
}

function ClockBadge() {
  return (
    <div
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
      style={{ background: "linear-gradient(135deg, #34c759, #248a3d)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}

function GridBadge() {
  return (
    <div
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
      style={{ background: "linear-gradient(135deg, #ff9500, #ff6b00)" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    </div>
  );
}
