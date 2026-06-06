"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { useTranslations, useLocale } from "next-intl";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Apple-style scroll-driven demo. The chat content is hardcoded in
 * French for the FR build and English for the EN build via the
 * `useLocale()` switch — keeps both flavours authentic without needing
 * one translation key per chat line.
 *
 * The narrative captions (kicker + headline) live in `Landing.demo`.
 */

type Turn = {
  side: "patient" | "bot";
  text: string;
  caption: { label: string; detail: string };
};

const TURNS_FR: Turn[] = [
  {
    side: "patient",
    text: "Bonjour, vous êtes ouverts mardi ?",
    caption: {
      label: "1 / Question simple",
      detail:
        "Le patient pose une question. Le bot lit l'emploi du temps de votre cabinet et répond avec les bonnes heures.",
    },
  },
  {
    side: "bot",
    text: "Oui. Mardi nous sommes ouverts de 9 h à 12 h et de 15 h à 19 h. Voulez-vous prendre rendez-vous ?",
    caption: {
      label: "2 / Réponse instantanée",
      detail:
        "Aucune intervention humaine. Le bot consulte vos horaires d'ouverture en temps réel.",
    },
  },
  {
    side: "patient",
    text: "Oui, jeudi matin si possible.",
    caption: {
      label: "3 / Recherche créneaux",
      detail:
        "Le bot interroge le planning, exclut les RDV existants, les absences et les pauses.",
    },
  },
  {
    side: "bot",
    text: "Pour jeudi matin, voici les créneaux libres : 9 h, 9 h 30, 10 h, 10 h 30. Lequel vous convient ?",
    caption: {
      label: "4 / Créneaux réels",
      detail:
        "Tous les créneaux proposés sont vraiment libres. Le double-booking est impossible.",
    },
  },
  {
    side: "patient",
    text: "10 h pour un détartrage.",
    caption: {
      label: "5 / Confirmation",
      detail:
        "Le patient choisit. Le bot écrit le RDV en base et envoie la confirmation.",
    },
  },
  {
    side: "bot",
    text: "C'est confirmé. RDV jeudi à 10 h. Un rappel vous sera envoyé la veille. À bientôt.",
    caption: {
      label: "6 / RDV créé",
      detail:
        "Le RDV apparaît immédiatement dans votre planning, étiqueté « IA ». Vous n'avez touché à rien.",
    },
  },
];

const TURNS_EN: Turn[] = [
  {
    side: "patient",
    text: "Hi, are you open on Tuesday?",
    caption: {
      label: "1 / Simple question",
      detail:
        "The patient asks. The bot reads your clinic's hours and replies with the right ones.",
    },
  },
  {
    side: "bot",
    text: "Yes. On Tuesday we're open 9 AM–12 PM and 3 PM–7 PM. Would you like to book?",
    caption: {
      label: "2 / Instant reply",
      detail: "No human in the loop. The bot pulls your opening hours in real time.",
    },
  },
  {
    side: "patient",
    text: "Yes, Thursday morning if possible.",
    caption: {
      label: "3 / Slot search",
      detail:
        "The bot queries the schedule, excluding existing appointments, time-off and breaks.",
    },
  },
  {
    side: "bot",
    text: "For Thursday morning, available slots are: 9:00, 9:30, 10:00, 10:30. Which works for you?",
    caption: {
      label: "4 / Real slots",
      detail:
        "Every proposed slot is genuinely free. Double-booking is impossible.",
    },
  },
  {
    side: "patient",
    text: "10:00 for a scaling.",
    caption: {
      label: "5 / Confirmation",
      detail: "The patient picks. The bot writes the appointment to the database and confirms.",
    },
  },
  {
    side: "bot",
    text: "Booked. Appointment Thursday at 10:00. We'll send you a reminder the day before. See you soon.",
    caption: {
      label: "6 / Appointment created",
      detail:
        "It appears in your schedule immediately, flagged as \"AI\". You didn't touch a thing.",
    },
  },
];

export function PinnedDemo() {
  const t = useTranslations("Landing.demo");
  const locale = useLocale();
  const TURNS = locale === "en" ? TURNS_EN : TURNS_FR;

  const wrapRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      gsap.set(messageRefs.current.filter(Boolean), { opacity: 0, y: 18 });
      gsap.set(captionRefs.current.filter(Boolean), { opacity: 0, y: 12 });

      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top top",
        end: () => `+=${TURNS.length * 80}vh`,
        pin: true,
        scrub: 0.8,
        onUpdate: (self) => {
          const progress = self.progress;
          const total = TURNS.length;
          const active = Math.min(total - 1, Math.floor(progress * total));
          messageRefs.current.forEach((el, i) => {
            if (!el) return;
            const reveal = i <= active;
            gsap.to(el, {
              opacity: reveal ? 1 : 0,
              y: reveal ? 0 : 18,
              duration: 0.35,
              overwrite: "auto",
              ease: "power2.out",
            });
          });
          captionRefs.current.forEach((el, i) => {
            if (!el) return;
            const isActive = i === active;
            gsap.to(el, {
              opacity: isActive ? 1 : 0,
              y: isActive ? 0 : 12,
              duration: 0.35,
              overwrite: "auto",
              ease: "power2.out",
            });
          });
        },
      });
    },
    { scope: wrapRef, dependencies: [locale] },
  );

  return (
    <section id="demo" ref={wrapRef} className="relative h-screen overflow-hidden bg-[#faf7f2] px-3">
      <div className="relative mx-auto grid h-full max-w-[1024px] grid-cols-1 items-center gap-12 px-6 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div className="relative order-2 md:order-1">
          <div className="mb-3 text-[13px] font-semibold tracking-[0.04em] text-[#128c7e] uppercase">
            {t("kicker")}
          </div>
          <h2
            className="text-[var(--lp-ink)] text-[clamp(40px,5.5vw,72px)] leading-[1.07] font-semibold tracking-[-0.012em]"
            style={{ fontFamily: "var(--lp-font-system)" }}
          >
            {t("headlineA")}{" "}
            <span className="text-[var(--lp-ink-muted)]">{t("headlineB")}</span>
          </h2>
          <div className="relative mt-10 h-[200px]">
            {TURNS.map((tt, i) => (
              <div
                key={i}
                ref={(el) => {
                  captionRefs.current[i] = el;
                }}
                className="absolute inset-0"
              >
                <div className="text-[12px] font-semibold tracking-[0.04em] text-[#128c7e] uppercase">
                  {tt.caption.label}
                </div>
                <p className="text-[var(--lp-ink)] mt-3 text-[19px] leading-[1.4]">
                  {tt.caption.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative order-1 mx-auto flex h-full max-h-[80vh] w-full max-w-sm items-center md:order-2">
          <div
            className="win11-card-elevated relative h-[640px] w-full overflow-hidden"
            style={{ padding: 16, borderRadius: 36 }}
          >
            <div className="absolute top-3 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1a1d20]" />
            <div className="mt-8 flex items-center gap-3 border-b border-[var(--lp-line)] px-1 pb-3">
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
                <div className="text-[var(--lp-ink-dim)] text-[10px]">
                  {locale === "en" ? "online" : "en ligne"}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2.5 overflow-hidden pr-1">
              {TURNS.map((tt, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    messageRefs.current[i] = el;
                  }}
                  className={
                    tt.side === "patient"
                      ? "ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#dcf8c6] px-3.5 py-2 text-[13px] leading-snug text-[#0c3927]"
                      : "mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--lp-line)] bg-[#faf7f2] px-3.5 py-2 text-[13px] leading-snug text-[var(--lp-ink)]"
                  }
                >
                  {tt.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
