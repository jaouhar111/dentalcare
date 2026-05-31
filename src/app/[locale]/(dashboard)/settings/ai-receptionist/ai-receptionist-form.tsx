"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AIReceptionistStyle } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateAIReceptionistSettings } from "@/server/actions/ai-receptionist";
import type {
  AIReceptionistSettings,
  AITemplates,
} from "@/server/actions/ai-receptionist-types";
import { DEFAULT_TEMPLATES } from "@/server/actions/ai-receptionist-types";

/**
 * AI Receptionist settings — single form with sticky save bar.
 *
 * Layout
 *  1. Hero kill-switch — big toggle with status copy that flips
 *     between "actif" (green) and "transfert vers équipe" (amber).
 *  2. Tone — segmented control (FRIENDLY / FORMAL) with example bubble.
 *  3. Signature — short input that appears at the end of every reply.
 *  4. Templates — 5 textareas, each with a placeholder showing the
 *     built-in default + variable hints.
 *
 * The form is uncontrolled per-field then submits the diff so a partial
 * edit (e.g. just toggle enabled) goes through with a minimal payload.
 */

type TemplateKey = keyof AITemplates;

const TEMPLATE_FIELDS: Array<{
  key: TemplateKey;
  label: string;
  description: string;
  variables: string[];
}> = [
  {
    key: "bookRdv",
    label: "Prise de rendez-vous",
    description: "Quand un patient demande à prendre rendez-vous.",
    variables: ["{{patientFirstName}}", "{{slots}}", "{{dayLabel}}"],
  },
  {
    key: "urgency",
    label: "Urgence",
    description: "Détecté sur mots-clés : mal, douleur, saigne, gonflé.",
    variables: ["{{patientFirstName}}"],
  },
  {
    key: "openingHours",
    label: "Horaires d'ouverture",
    description: "Quand le patient demande « vous êtes ouverts ? ».",
    variables: ["{{clinicName}}", "{{hours}}"],
  },
  {
    key: "address",
    label: "Adresse",
    description: "Quand le patient demande où se trouve le cabinet.",
    variables: ["{{clinicName}}", "{{address}}"],
  },
  {
    key: "offTopic",
    label: "Hors sujet",
    description: "Pour tout ce qui n'est pas RDV / cabinet.",
    variables: [],
  },
];

export function AIReceptionistForm({
  initial,
}: {
  initial: AIReceptionistSettings;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [style, setStyle] = useState<AIReceptionistStyle>(initial.style);
  const [signature, setSignature] = useState(initial.signature ?? "");
  const [templates, setTemplates] = useState<AITemplates>(initial.templates);
  const [isPending, startTransition] = useTransition();

  const dirty =
    enabled !== initial.enabled ||
    style !== initial.style ||
    (signature ?? "") !== (initial.signature ?? "") ||
    JSON.stringify(templates) !== JSON.stringify(initial.templates);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateAIReceptionistSettings({
        enabled,
        style,
        signature: signature.trim() || null,
        templates,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Réglages enregistrés.");
      router.refresh();
    });
  }

  /**
   * Toggle is its own one-click action — saves immediately so the
   * cabinet doesn't have to navigate to the bottom of the form to
   * activate the kill switch during an incident.
   */
  function toggleEnabledImmediate(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await updateAIReceptionistSettings({ enabled: next });
      if (!res.ok) {
        setEnabled(!next); // rollback
        toast.error(res.error.message);
        return;
      }
      toast.success(
        next
          ? "AI Receptionist activé. Les patients reçoivent les réponses du bot."
          : "AI Receptionist désactivé. Les messages seront transférés à votre équipe.",
      );
      router.refresh();
    });
  }

  function updateTemplate(key: TemplateKey, value: string) {
    setTemplates((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── 1. Kill switch hero ───────────────────────────── */}
      <section className="apple-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
              État
            </div>
            <h2 className="text-foreground mt-1 text-[20px] font-semibold tracking-tight">
              {enabled ? "AI Receptionist actif" : "AI Receptionist désactivé"}
            </h2>
            <p className="text-muted-foreground mt-1.5 max-w-md text-[13px] leading-[1.5]">
              {enabled
                ? "Le bot répond automatiquement aux messages WhatsApp dans les 5 secondes."
                : "Les patients reçoivent un message « un instant, on vous transfère » et votre équipe doit reprendre la main dans l'inbox WhatsApp."}
            </p>
          </div>
          <KillSwitchToggle
            checked={enabled}
            onChange={toggleEnabledImmediate}
            disabled={isPending}
          />
        </div>
      </section>

      {/* ── 2. Tone ─────────────────────────────────────── */}
      <section className="apple-card">
        <div className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          Ton de réponse
        </div>
        <h3 className="text-foreground mt-1 text-[16px] font-semibold">
          Comment le bot parle aux patients
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToneCard
            value="FRIENDLY"
            label="Amical"
            example="Salut Sara ! 👋 Je te propose mardi 14h, ça te va ?"
            active={style === "FRIENDLY"}
            onClick={() => setStyle("FRIENDLY")}
          />
          <ToneCard
            value="FORMAL"
            label="Formel"
            example="Bonjour Mme El Idrissi. Je vous propose mardi à 14h. Cela vous convient-il ?"
            active={style === "FORMAL"}
            onClick={() => setStyle("FORMAL")}
          />
        </div>
      </section>

      {/* ── 3. Signature ────────────────────────────────── */}
      <section className="apple-card">
        <label
          htmlFor="ai-signature"
          className="text-muted-foreground block text-[11px] font-medium tracking-[0.08em] uppercase"
        >
          Signature
        </label>
        <h3 className="text-foreground mt-1 text-[16px] font-semibold">
          Apparaît à la fin de chaque réponse
        </h3>
        <input
          id="ai-signature"
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          maxLength={80}
          placeholder="— Cabinet Hdoud"
          disabled={isPending}
          className="bg-background placeholder:text-muted-foreground/60 focus-visible:ring-primary/40 mt-3 w-full rounded-xl px-3.5 py-2.5 text-[14px] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        />
        <p className="text-muted-foreground mt-2 text-[11px]">
          {signature.length} / 80 caractères · laissez vide pour ne pas signer
        </p>
      </section>

      {/* ── 4. Templates ────────────────────────────────── */}
      <section className="apple-card">
        <div className="mb-4">
          <div className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
            Messages personnalisés
          </div>
          <h3 className="text-foreground mt-1 text-[16px] font-semibold">
            Surcharger les 5 réponses-types du bot
          </h3>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-[1.5]">
            Laissez vide pour utiliser le message par défaut (visible en
            gris dans le champ). Variables disponibles entre <code className="rounded bg-black/[0.04] px-1">{`{{accolades}}`}</code>.
          </p>
        </div>
        <div className="space-y-5">
          {TEMPLATE_FIELDS.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`tpl-${f.key}`}
                className="text-foreground block text-[13px] font-semibold"
              >
                {f.label}
              </label>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {f.description}
              </p>
              <textarea
                id={`tpl-${f.key}`}
                value={templates[f.key] ?? ""}
                onChange={(e) => updateTemplate(f.key, e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={DEFAULT_TEMPLATES[f.key]}
                disabled={isPending}
                className="bg-background placeholder:text-muted-foreground/50 focus-visible:ring-primary/40 mt-2 w-full resize-y rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.5] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              />
              {f.variables.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {f.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        updateTemplate(
                          f.key,
                          (templates[f.key] ?? DEFAULT_TEMPLATES[f.key]) + " " + v,
                        )
                      }
                      className="text-muted-foreground hover:bg-black/[0.05] hover:text-foreground rounded-full bg-black/[0.025] px-2 py-0.5 font-mono text-[10px] transition"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* ── Sticky save bar ─────────────────────────────── */}
      {dirty ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 pl-5 ring-1 ring-black/[0.08] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] dark:bg-[#1c1c1e] dark:ring-white/[0.08]">
          <div className="text-foreground text-[13px]">
            Modifications non enregistrées
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setStyle(initial.style);
                setSignature(initial.signature ?? "");
                setTemplates(initial.templates);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-full px-5"
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

/**
 * iOS-style toggle — big and tactile. Auto-saves on flip.
 */
function KillSwitchToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-black/[0.15] dark:bg-white/[0.2]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ToneCard({
  label,
  example,
  active,
  onClick,
}: {
  value: AIReceptionistStyle;
  label: string;
  example: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-2xl p-4 text-start transition ${
        active
          ? "bg-primary/[0.08] ring-primary/40 ring-2"
          : "bg-black/[0.025] hover:bg-black/[0.04] ring-1 ring-black/[0.04]"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-foreground text-[14px] font-semibold">
          {label}
        </span>
        {active ? (
          <svg className="text-primary size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </div>
      <div className="text-muted-foreground bg-black/[0.04] rounded-xl px-3 py-2 text-[12px] leading-[1.45] italic">
        « {example} »
      </div>
    </button>
  );
}
