"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPrescription } from "@/server/actions/prescriptions";

interface DentistOption {
  id: string;
  name: string;
}

interface DraftItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const EMPTY_ITEM: DraftItem = {
  drug: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export function PrescriptionFormDialog({
  patientId,
  patientLocale,
  dentists,
  defaultDentistId,
}: {
  mode: "create";
  patientId: string;
  patientLocale: string;
  dentists: DentistOption[];
  defaultDentistId: string;
}) {
  const t = useTranslations("Prescriptions");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [dentistId, setDentistId] = useState(defaultDentistId);
  const [docLocale, setDocLocale] = useState<"fr" | "en" | "ar">(
    (["fr", "en", "ar"].includes(patientLocale) ? patientLocale : "fr") as "fr" | "en" | "ar",
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);

  function reset() {
    setDentistId(defaultDentistId);
    setDocLocale("fr");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
  }

  function patch(idx: number, key: keyof DraftItem, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  const validItems = items.filter((i) => i.drug.trim().length > 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (validItems.length === 0) {
      toast.error(tToast("error"), { description: t("errors.REQUIRED") });
      return;
    }
    startTransition(async () => {
      const res = await createPrescription({
        patientId,
        dentistId,
        locale: docLocale,
        notes: notes || undefined,
        items: validItems.map((it) => ({
          drug: it.drug.trim(),
          dosage: it.dosage.trim() || undefined,
          frequency: it.frequency.trim() || undefined,
          duration: it.duration.trim() || undefined,
          instructions: it.instructions.trim() || undefined,
        })),
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.created"));
      reset();
      setOpen(false);
      router.refresh();
      router.push(`/prescriptions/${res.data.id}` as never);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="gap-1.5">
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
        {t("add")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("form.titleCreate")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.dentist")} *
                </label>
                <select
                  value={dentistId}
                  onChange={(e) => setDentistId(e.target.value)}
                  required
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                >
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.locale")}
                </label>
                <select
                  value={docLocale}
                  onChange={(e) => setDocLocale(e.target.value as "fr" | "en" | "ar")}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-foreground block text-xs font-medium">
                  {t("form.items")} *
                </label>
                <button
                  type="button"
                  onClick={addRow}
                  disabled={isPending}
                  className="text-primary hover:underline text-xs font-medium"
                >
                  {t("form.addItem")}
                </button>
              </div>
              <ul className="space-y-3">
                {items.map((it, idx) => (
                  <li key={idx} className="border-border/60 bg-muted/20 rounded-lg border p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-12">
                        <input
                          type="text"
                          value={it.drug}
                          onChange={(e) => patch(idx, "drug", e.target.value)}
                          placeholder={t("form.drugPlaceholder")}
                          required={idx === 0}
                          maxLength={200}
                          disabled={isPending}
                          className="border-input bg-background w-full rounded-md border px-3 py-1.5 text-sm font-medium shadow-xs disabled:opacity-50"
                        />
                      </div>
                      <input
                        type="text"
                        value={it.dosage}
                        onChange={(e) => patch(idx, "dosage", e.target.value)}
                        placeholder={t("form.dosagePlaceholder")}
                        maxLength={80}
                        disabled={isPending}
                        className="border-input bg-background sm:col-span-3 w-full rounded-md border px-2 py-1 text-xs shadow-xs disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={it.frequency}
                        onChange={(e) => patch(idx, "frequency", e.target.value)}
                        placeholder={t("form.frequencyPlaceholder")}
                        maxLength={80}
                        disabled={isPending}
                        className="border-input bg-background sm:col-span-3 w-full rounded-md border px-2 py-1 text-xs shadow-xs disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={it.duration}
                        onChange={(e) => patch(idx, "duration", e.target.value)}
                        placeholder={t("form.durationPlaceholder")}
                        maxLength={80}
                        disabled={isPending}
                        className="border-input bg-background sm:col-span-2 w-full rounded-md border px-2 py-1 text-xs shadow-xs disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={it.instructions}
                        onChange={(e) => patch(idx, "instructions", e.target.value)}
                        placeholder={t("form.instructionsPlaceholder")}
                        maxLength={300}
                        disabled={isPending}
                        className="border-input bg-background sm:col-span-3 w-full rounded-md border px-2 py-1 text-xs shadow-xs disabled:opacity-50"
                      />
                      <div className="sm:col-span-1 flex items-center justify-end">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={isPending}
                            className="text-muted-foreground hover:text-destructive text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder={t("form.notesPlaceholder")}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending || validItems.length === 0}>
                {isPending ? t("form.submitting") : t("form.submitCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
