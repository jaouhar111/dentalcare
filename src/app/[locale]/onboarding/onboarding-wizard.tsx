"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  onboardingFinish,
  onboardingSkipAll,
  onboardingStepDentist,
  onboardingStepHours,
  onboardingStepPatients,
  onboardingStepWhatsApp,
  type OnboardingProgress,
} from "@/server/actions/onboarding";

/**
 * 5-step onboarding wizard (Phase 10, § 4.12 du cahier).
 *
 * Target: ≤ 5 minutes from cabinet creation to first usable state.
 *
 * Steps :
 *  1. Connect WhatsApp (Phone Number ID — or skip)
 *  2. Horaires (7 day toggles + default 9-12 / 15-19)
 *  3. Dentiste (au moins 1 — nom + spécialité + couleur)
 *  4. Patients (CSV → Phase 11 ; ici "start empty" ou "skip")
 *  5. Activer AI Receptionist (style + signature → renvoie /dashboard)
 *
 * The progress bar at top shows N/5 + green checkmarks for completed.
 * On finish, confetti + push("/dashboard").
 */

const STEPS = [
  { num: 1, label: "WhatsApp" },
  { num: 2, label: "Horaires" },
  { num: 3, label: "Dentiste" },
  { num: 4, label: "Patients" },
  { num: 5, label: "AI Receptionist" },
] as const;

export function OnboardingWizard({
  initialStep,
  progress,
}: {
  initialStep: number;
  progress: OnboardingProgress;
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(initialStep);
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState({
    1: progress.hasWhatsApp,
    2: progress.hasSchedule,
    3: progress.hasDentist,
    4: false,
    5: false,
  });

  function markDone(n: number, next?: number) {
    setCompleted((c) => ({ ...c, [n]: true }));
    if (next !== undefined) setStep(next);
  }

  function skipAll() {
    startTransition(async () => {
      const res = await onboardingSkipAll();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Onboarding passé — vous pouvez le reprendre plus tard depuis Paramètres.");
      router.push("/dashboard");
    });
  }

  return (
    <div>
      {/* Header — progression */}
      <header className="mb-8 text-center">
        <div className="text-[#6e6e73] mb-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.06em] ring-1 ring-black/[0.06] uppercase dark:bg-white/[0.06]">
          Étape {step} / 5 · ≤ 5 min
        </div>
        <h1 className="text-[#1d1d1f] dark:text-white text-[32px] leading-tight font-semibold tracking-tight">
          Bienvenue.
        </h1>
        <p className="text-[#6e6e73] dark:text-[#a1a1a6] mt-2 text-[15px]">
          Cinq étapes rapides pour démarrer votre cabinet.
        </p>
      </header>

      {/* Stepper rail */}
      <ol className="mx-auto mb-8 flex max-w-xl items-center justify-between">
        {STEPS.map((s, i) => {
          const isDone = completed[s.num as keyof typeof completed];
          const isCurrent = step === s.num;
          return (
            <li key={s.num} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => setStep(s.num)}
                className={`relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-[12px] font-bold transition ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-[#0071e3] text-white ring-4 ring-[#0071e3]/20"
                      : "bg-black/[0.06] text-[#6e6e73] dark:bg-white/[0.06]"
                }`}
                aria-label={`Étape ${s.num} : ${s.label}`}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </button>
              {i < STEPS.length - 1 ? (
                <span
                  className={`mx-1 h-px flex-1 ${isDone ? "bg-emerald-500/40" : "bg-black/[0.08]"}`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Step card */}
      <div className="apple-card">
        {step === 1 ? (
          <StepWhatsApp
            isPending={isPending}
            onSkip={() =>
              startTransition(async () => {
                const res = await onboardingStepWhatsApp({ phoneId: "" });
                if (!res.ok) return toast.error(res.error.message);
                markDone(1, 2);
              })
            }
            onSubmit={(phoneId) =>
              startTransition(async () => {
                const res = await onboardingStepWhatsApp({ phoneId });
                if (!res.ok) return toast.error(res.error.message);
                toast.success("Numéro WhatsApp connecté.");
                markDone(1, 2);
              })
            }
          />
        ) : null}

        {step === 2 ? (
          <StepHours
            isPending={isPending}
            onSubmit={(days) =>
              startTransition(async () => {
                const res = await onboardingStepHours({ days });
                if (!res.ok) return toast.error(res.error.message);
                toast.success("Horaires enregistrés.");
                markDone(2, 3);
              })
            }
          />
        ) : null}

        {step === 3 ? (
          <StepDentist
            isPending={isPending}
            onSubmit={(d) =>
              startTransition(async () => {
                const res = await onboardingStepDentist(d);
                if (!res.ok) return toast.error(res.error.message);
                toast.success("Dentiste ajouté.");
                markDone(3, 4);
              })
            }
          />
        ) : null}

        {step === 4 ? (
          <StepPatients
            isPending={isPending}
            onContinue={() =>
              startTransition(async () => {
                const res = await onboardingStepPatients({ skipImport: true });
                if (!res.ok) return toast.error(res.error.message);
                markDone(4, 5);
              })
            }
          />
        ) : null}

        {step === 5 ? (
          <StepFinish
            isPending={isPending}
            onFinish={(aiEnabled) =>
              startTransition(async () => {
                const res = await onboardingFinish({ aiEnabled });
                if (!res.ok) return toast.error(res.error.message);
                toast.success("Configuration terminée 🎉");
                router.push("/dashboard");
              })
            }
          />
        ) : null}
      </div>

      {/* Skip-all footer */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={skipAll}
          disabled={isPending}
          className="text-[12px] text-[#86868b] underline-offset-2 hover:text-[#0066cc] hover:underline disabled:opacity-50"
        >
          Passer tout l&apos;onboarding et configurer plus tard
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Step 1 — WhatsApp ────────────────────────────── */

function StepWhatsApp({
  isPending,
  onSubmit,
  onSkip,
}: {
  isPending: boolean;
  onSubmit: (phoneId: string) => void;
  onSkip: () => void;
}) {
  const [phoneId, setPhoneId] = useState("");
  return (
    <div>
      <StepTitle eyebrow="Étape 1 / 5" title="Connecter WhatsApp" />
      <p className="text-[#6e6e73] mb-5 text-[14px] leading-[1.55]">
        Collez le <strong>Phone Number ID</strong> de votre numéro WhatsApp Business
        (15 chiffres environ). C&apos;est ce qui permet à notre bot de recevoir vos
        messages patients. Vous pouvez le récupérer dans Meta Business Manager →
        WhatsApp → Configuration.
      </p>
      <input
        type="text"
        value={phoneId}
        onChange={(e) => setPhoneId(e.target.value.replace(/\D/g, ""))}
        placeholder="ex. 123456789012345"
        maxLength={20}
        disabled={isPending}
        className="bg-background placeholder:text-muted-foreground/60 focus-visible:ring-primary/40 w-full rounded-xl px-4 py-3 text-[15px] tabular-nums ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={onSkip}
        >
          Pas maintenant
        </Button>
        <Button
          type="button"
          disabled={isPending || phoneId.length < 10}
          onClick={() => onSubmit(phoneId)}
          className="rounded-full px-6"
        >
          {isPending ? "…" : "Connecter →"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── Step 2 — Horaires ────────────────────────────── */

function StepHours({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (
    days: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ) => void;
}) {
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  // Default: weekdays 9-12 + 15-19. Saturday morning. Sunday closed.
  const [active, setActive] = useState<boolean[]>([true, true, true, true, true, true, false]);
  const [hours, setHours] = useState({ start: "09:00", end: "19:00" });

  function toggle(i: number) {
    setActive((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function submit() {
    const days = active
      .map((on, idx) =>
        on
          ? {
              // ISO day-of-week: 1 = Monday … 7 = Sunday. Our enum stores 1-7.
              dayOfWeek: idx === 6 ? 7 : idx + 1,
              startTime: hours.start,
              endTime: hours.end,
            }
          : null,
      )
      .filter(<T,>(x: T | null): x is T => x !== null);
    onSubmit(days);
  }

  return (
    <div>
      <StepTitle eyebrow="Étape 2 / 5" title="Vos horaires d'ouverture" />
      <p className="text-[#6e6e73] mb-5 text-[14px] leading-[1.55]">
        Le bot ne propose des créneaux qu&apos;aux heures où le cabinet est
        ouvert. Vous pouvez tout ajuster ensuite par dentiste.
      </p>

      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => toggle(i)}
            disabled={isPending}
            className={`rounded-xl px-2 py-3 text-[12px] font-semibold transition ${
              active[i]
                ? "bg-[#0071e3] text-white shadow-[0_2px_6px_-2px_rgba(0,113,227,0.45)]"
                : "text-[#86868b] hover:bg-black/[0.04] ring-1 ring-black/[0.06]"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
            Ouverture
          </label>
          <input
            type="time"
            value={hours.start}
            onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))}
            disabled={isPending}
            className="bg-background w-full rounded-xl px-3 py-2.5 text-[14px] tabular-nums ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
          />
        </div>
        <div>
          <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
            Fermeture
          </label>
          <input
            type="time"
            value={hours.end}
            onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))}
            disabled={isPending}
            className="bg-background w-full rounded-xl px-3 py-2.5 text-[14px] tabular-nums ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={isPending || !active.some(Boolean)}
          onClick={submit}
          className="rounded-full px-6"
        >
          {isPending ? "…" : "Continuer →"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── Step 3 — Dentiste ────────────────────────────── */

function StepDentist({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (d: {
    firstName: string;
    lastName: string;
    specialty?: string;
    color?: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const COLORS = ["#06b6d4", "#0891b2", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
  const [color, setColor] = useState(COLORS[0]!);

  return (
    <div>
      <StepTitle eyebrow="Étape 3 / 5" title="Ajouter le premier dentiste" />
      <p className="text-[#6e6e73] mb-5 text-[14px] leading-[1.55]">
        Il faut au moins un dentiste pour que le bot puisse proposer des RDV.
        Vous en ajouterez d&apos;autres depuis le menu Dentistes.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
            Prénom
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={isPending}
            placeholder="Otmane"
            className="bg-background w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
          />
        </div>
        <div>
          <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
            Nom
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isPending}
            placeholder="Hdoud"
            className="bg-background w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
          Spécialité (optionnel)
        </label>
        <input
          type="text"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          disabled={isPending}
          placeholder="Implantologie, orthodontie…"
          className="bg-background w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
        />
      </div>

      <div className="mt-4">
        <label className="text-[#6e6e73] mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase">
          Couleur agenda
        </label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              disabled={isPending}
              className={`size-9 rounded-full transition ${color === c ? "ring-2 ring-[#0071e3] ring-offset-2" : "hover:scale-110"}`}
              style={{ background: c }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={isPending || firstName.length < 1 || lastName.length < 1}
          onClick={() => onSubmit({ firstName, lastName, specialty: specialty || undefined, color })}
          className="rounded-full px-6"
        >
          {isPending ? "…" : "Ajouter le dentiste →"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── Step 4 — Patients ────────────────────────────── */

function StepPatients({
  isPending,
  onContinue,
}: {
  isPending: boolean;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepTitle eyebrow="Étape 4 / 5" title="Patients" />
      <p className="text-[#6e6e73] mb-5 text-[14px] leading-[1.55]">
        Vous commencez sans patient — le bot WhatsApp les ajoute
        automatiquement quand ils écrivent pour la première fois. Vous
        pourrez aussi en créer manuellement depuis le menu Patients.
      </p>

      <div className="rounded-2xl bg-black/[0.025] p-5 ring-1 ring-black/[0.04]">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Import CSV — bientôt disponible
        </div>
        <p className="text-[12px] text-[#6e6e73]">
          La fonctionnalité d&apos;import par fichier CSV arrive en Phase 11.
          Pour l&apos;instant, lancez votre cabinet à vide et laissez
          l&apos;AI Receptionist enrichir votre base au fil des conversations.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={isPending}
          onClick={onContinue}
          className="rounded-full px-6"
        >
          {isPending ? "…" : "Continuer à vide →"}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────── Step 5 — Activer ────────────────────────────── */

function StepFinish({
  isPending,
  onFinish,
}: {
  isPending: boolean;
  onFinish: (aiEnabled: boolean) => void;
}) {
  const [aiEnabled, setAiEnabled] = useState(true);
  return (
    <div>
      <StepTitle eyebrow="Étape 5 / 5 · dernière étape" title="Activer l'AI Receptionist" />
      <p className="text-[#6e6e73] mb-5 text-[14px] leading-[1.55]">
        Le bot répond automatiquement aux messages WhatsApp 24/7. Vous
        pouvez le désactiver à tout moment depuis Paramètres →
        AI Receptionist.
      </p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAiEnabled(true)}
          disabled={isPending}
          className={`flex w-full items-start gap-3 rounded-2xl p-4 text-start transition ${
            aiEnabled
              ? "bg-[#0071e3]/8 ring-[#0071e3]/40 ring-2"
              : "bg-black/[0.025] hover:bg-black/[0.04] ring-1 ring-black/[0.04]"
          }`}
        >
          <span
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${aiEnabled ? "bg-[#0071e3] text-white" : "ring-2 ring-black/[0.15]"}`}
          >
            {aiEnabled ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Activer l&apos;AI Receptionist (recommandé)
            </div>
            <div className="mt-1 text-[12px] text-[#6e6e73]">
              Le bot répond automatiquement, prend les RDV et envoie les
              rappels. Vous gardez la main à tout moment depuis l&apos;inbox.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setAiEnabled(false)}
          disabled={isPending}
          className={`flex w-full items-start gap-3 rounded-2xl p-4 text-start transition ${
            !aiEnabled
              ? "bg-[#0071e3]/8 ring-[#0071e3]/40 ring-2"
              : "bg-black/[0.025] hover:bg-black/[0.04] ring-1 ring-black/[0.04]"
          }`}
        >
          <span
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${!aiEnabled ? "bg-[#0071e3] text-white" : "ring-2 ring-black/[0.15]"}`}
          >
            {!aiEnabled ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Plus tard — uniquement la gestion cabinet
            </div>
            <div className="mt-1 text-[12px] text-[#6e6e73]">
              Vous utilisez DentalCare pour le planning et les factures,
              vos messages WhatsApp restent gérés manuellement.
            </div>
          </div>
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => onFinish(aiEnabled)}
          className="rounded-full px-6"
        >
          {isPending ? "…" : "Terminer 🎉"}
        </Button>
      </div>
    </div>
  );
}

function StepTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-[#0066cc] text-[11px] font-semibold tracking-[0.08em] uppercase">
        {eyebrow}
      </div>
      <h2 className="text-[#1d1d1f] dark:text-white mt-1 text-[22px] font-semibold tracking-tight">
        {title}
      </h2>
    </div>
  );
}
