"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RecallKind } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PatientPicker } from "@/app/[locale]/(dashboard)/appointments/patient-picker";
import { createRecall } from "@/server/actions/recalls";

const KINDS: { value: RecallKind; label: string; defaultMonths: number }[] = [
  { value: RecallKind.SCALING, label: "Détartrage / hygiène (6 mois)", defaultMonths: 6 },
  { value: RecallKind.ANNUAL_CHECKUP, label: "Contrôle annuel (12 mois)", defaultMonths: 12 },
  { value: RecallKind.IMPLANT_FOLLOWUP, label: "Suivi implant / couronne (3 mois)", defaultMonths: 3 },
  { value: RecallKind.POST_EXTRACTION, label: "Post-extraction (1 mois)", defaultMonths: 1 },
  { value: RecallKind.CUSTOM, label: "Personnalisé", defaultMonths: 6 },
];

/**
 * Manual recall creation. Use when the auto-pipeline misses a case —
 * e.g. patient asks for a follow-up unrelated to a recorded treatment,
 * or the dentist forgot to mark the soin as COMPLETED in time.
 */
export function NewRecallDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [kind, setKind] = useState<RecallKind>(RecallKind.SCALING);
  const [dueDate, setDueDate] = useState(() => addMonths(new Date(), 6));
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = !!patient && !!dueDate;

  function onKindChange(next: RecallKind) {
    setKind(next);
    const months = KINDS.find((k) => k.value === next)?.defaultMonths ?? 6;
    setDueDate(addMonths(new Date(), months));
  }

  function reset() {
    setPatient(null);
    setKind(RecallKind.SCALING);
    setDueDate(addMonths(new Date(), 6));
    setReason("");
  }

  function onSubmit() {
    if (!patient) return;
    startTransition(async () => {
      const res = await createRecall({
        patientId: patient.id,
        kind,
        dueDate: toIsoDateInput(dueDate),
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error("Création impossible", { description: res.error.message });
        return;
      }
      toast.success("Rappel créé", {
        description: `${patient.name} — ${KINDS.find((k) => k.value === kind)?.label.split(" (")[0]}, ${formatDateFr(dueDate)}`,
      });
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nouveau rappel
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (isPending) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau rappel</DialogTitle>
          <DialogDescription>
            Crée un rappel manuel pour un patient — hors du flux automatique des soins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-1.5 block text-sm font-medium">
              Patient <span className="text-destructive">*</span>
            </label>
            <PatientPicker
              initialPatient={patient}
              onSelect={(id, name) => setPatient({ id, name })}
            />
          </div>

          <div>
            <label className="text-foreground mb-1.5 block text-sm font-medium">
              Type de rappel <span className="text-destructive">*</span>
            </label>
            <select
              value={kind}
              onChange={(e) => onKindChange(e.target.value as RecallKind)}
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              disabled={isPending}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1.5 block text-sm font-medium">
              Date d'échéance <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={toIsoDateInput(dueDate)}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setDueDate(new Date(v + "T12:00:00"));
              }}
              min={toIsoDateInput(new Date())}
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              disabled={isPending}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Le cron quotidien (10h30 Maroc) enverra le WhatsApp à cette date.
            </p>
          </div>

          <div>
            <label className="text-foreground mb-1.5 block text-sm font-medium">
              Motif (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Ex. Contrôle post-traitement, retouche blanchiment, etc."
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Création…" : "Créer le rappel"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function toIsoDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
