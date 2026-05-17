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
import { PatientPicker } from "../appointments/patient-picker";
import {
  createInvoice,
  listUnbilledTreatmentsForPatient,
} from "@/server/actions/invoices";

interface UnbilledTreatment {
  id: string;
  catalogCode: string;
  catalogName: string;
  toothNumber: number | null;
  unitPrice: number;
  lineTotal: number;
  performedAt: Date | null;
}

/**
 * Header CTA on `/invoices`. Opens a 2-step picker:
 *   1. choose patient (via shared autocomplete component)
 *   2. tick the completed treatments to bill (or none → empty draft)
 *
 * Submits via `createInvoice` and redirects to the new invoice's detail page.
 */
export function NewInvoiceButton() {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [treatments, setTreatments] = useState<UnbilledTreatment[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  async function onPatientChange(id: string) {
    setPatientId(id);
    setSelected(new Set());
    setTreatments(null);
    if (!id) return;
    const list = await listUnbilledTreatmentsForPatient(id);
    setTreatments(
      list.map((t) => ({
        ...t,
        performedAt: t.performedAt ? new Date(t.performedAt) : null,
      })),
    );
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function reset() {
    setPatientId("");
    setTreatments(null);
    setSelected(new Set());
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) return;
    startTransition(async () => {
      const res = await createInvoice({
        patientId,
        fromApplicationIds: Array.from(selected),
        extraLines: [],
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.created"));
      reset();
      setOpen(false);
      router.push(`/invoices/${res.data.id}` as never);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="gap-1.5">
        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {t("new")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.patient")} *
              </label>
              <PatientPicker
                initialPatient={null}
                onSelect={(id) => {
                  void onPatientChange(id);
                }}
              />
            </div>

            {patientId && treatments && (
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.fromTreatments")}
                </label>
                {treatments.length === 0 ? (
                  <p className="text-muted-foreground bg-muted/30 rounded-md p-3 text-sm italic">
                    {t("form.noTreatments")}
                  </p>
                ) : (
                  <ul className="border-border/60 max-h-72 divide-y overflow-y-auto rounded-md border">
                    {treatments.map((tr) => {
                      const checked = selected.has(tr.id);
                      return (
                        <li
                          key={tr.id}
                          className="hover:bg-muted/40 flex items-center gap-3 p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(tr.id)}
                            disabled={isPending}
                            className="size-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground font-medium">
                              {tr.catalogName}
                              {tr.toothNumber && (
                                <span className="text-muted-foreground num ms-1 font-normal">
                                  — {tr.toothNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground num text-xs">
                              {tr.catalogCode}
                              {tr.performedAt &&
                                ` · ${new Intl.DateTimeFormat("fr", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }).format(tr.performedAt)}`}
                            </div>
                          </div>
                          <div className="num text-foreground text-end text-sm font-medium">
                            {tr.lineTotal.toFixed(2)} DH
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending || !patientId}>
                {isPending ? t("form.submitting") : t("form.submitCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
