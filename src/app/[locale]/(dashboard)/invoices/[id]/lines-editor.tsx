"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  addInvoiceLine,
  removeInvoiceLine,
} from "@/server/actions/invoices";
import type { InvoiceLineLite } from "@/server/actions/invoices-types";
import { formatCurrency } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

interface DraftLine {
  description: string;
  toothNumber: string;
  quantity: string;
  unitPrice: string;
  discountMode: "none" | "pct" | "fixed";
  discountValue: string;
}

const EMPTY: DraftLine = {
  description: "",
  toothNumber: "",
  quantity: "1",
  unitPrice: "",
  discountMode: "none",
  discountValue: "",
};

/**
 * Renders the invoice lines table. In `editable` mode (DRAFT), each row has a
 * delete button and an "Add line" form footer; otherwise the table is read-only.
 *
 * Edits go through `addInvoiceLine` / `removeInvoiceLine` so the server-side
 * total recompute (and overpayment guard later) stays the single source of truth.
 */
export function InvoiceLinesEditor({
  invoiceId,
  lines,
  editable,
  locale,
}: {
  invoiceId: string;
  lines: InvoiceLineLite[];
  editable: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [draft, setDraft] = useState<DraftLine>({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onRemove(lineId: string) {
    startTransition(async () => {
      const res = await removeInvoiceLine({ invoiceId, lineId });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.lineRemoved"));
      router.refresh();
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.description.trim() || !draft.unitPrice) return;
    startTransition(async () => {
      const res = await addInvoiceLine({
        invoiceId,
        line: {
          description: draft.description.trim(),
          toothNumber: draft.toothNumber ? Number(draft.toothNumber) : undefined,
          quantity: Number(draft.quantity || 1),
          unitPrice: Number(draft.unitPrice),
          discountPct:
            draft.discountMode === "pct" && draft.discountValue
              ? Number(draft.discountValue)
              : undefined,
          discountAmount:
            draft.discountMode === "fixed" && draft.discountValue
              ? Number(draft.discountValue)
              : undefined,
        },
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      setDraft({ ...EMPTY });
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
          <tr>
            <th className="px-5 py-3 text-start font-semibold">{t("doc.lineDescription")}</th>
            <th className="px-5 py-3 text-end font-semibold">{t("doc.qty")}</th>
            <th className="px-5 py-3 text-end font-semibold">{t("doc.unitPrice")}</th>
            <th className="px-5 py-3 text-end font-semibold">{t("doc.lineTotal")}</th>
            {editable && <th className="w-10 px-2 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-border/60 divide-y">
          {lines.length === 0 ? (
            <tr>
              <td
                colSpan={editable ? 5 : 4}
                className="text-muted-foreground px-5 py-8 text-center italic"
              >
                {t("form.noTreatments")}
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3">
                  <div className="text-foreground font-medium">{l.description}</div>
                  {l.toothNumber !== null && (
                    <div className="text-muted-foreground num text-xs">
                      {t("form.tooth")} {l.toothNumber}
                    </div>
                  )}
                </td>
                <td className="num px-5 py-3 text-end">{l.quantity}</td>
                <td className="num px-5 py-3 text-end">
                  {formatCurrency(l.unitPrice, locale)}
                  {(l.discountPct !== null || l.discountAmount !== null) && (
                    <div className="text-muted-foreground text-xs">
                      − {l.discountPct !== null ? `${l.discountPct}%` : formatCurrency(l.discountAmount ?? 0, locale)}
                    </div>
                  )}
                </td>
                <td className="num px-5 py-3 text-end font-medium">
                  {formatCurrency(l.lineTotal, locale)}
                </td>
                {editable && (
                  <td className="px-2 py-3 text-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onRemove(l.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                    >
                      ×
                    </Button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editable && (
        <div className="border-border/60 border-t px-5 py-3">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-primary hover:underline inline-flex items-center gap-1 text-sm font-medium"
            >
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t("form.addExtraLine")}
            </button>
          ) : (
            <form onSubmit={onAdd} className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder={t("form.description")}
                  required
                  maxLength={200}
                  disabled={isPending}
                  className="border-input bg-background sm:col-span-6 w-full rounded-md border px-2 py-1.5 text-sm shadow-xs disabled:opacity-50"
                />
                <input
                  type="number"
                  value={draft.toothNumber}
                  onChange={(e) => setDraft({ ...draft, toothNumber: e.target.value })}
                  min="11"
                  max="48"
                  placeholder={t("form.tooth")}
                  disabled={isPending}
                  className="border-input bg-background num sm:col-span-2 w-full rounded-md border px-2 py-1.5 text-sm shadow-xs disabled:opacity-50"
                />
                <input
                  type="number"
                  value={draft.quantity}
                  onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                  min="1"
                  placeholder={t("form.quantity")}
                  disabled={isPending}
                  className="border-input bg-background num sm:col-span-1 w-full rounded-md border px-2 py-1.5 text-sm shadow-xs disabled:opacity-50"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })}
                  required
                  placeholder={t("form.unitPrice")}
                  disabled={isPending}
                  className="border-input bg-background num sm:col-span-3 w-full rounded-md border px-2 py-1.5 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t("form.discountType")}:</span>
                {(["none", "pct", "fixed"] as const).map((m) => (
                  <label
                    key={m}
                    className="border-input has-checked:bg-primary/10 has-checked:border-primary/40 has-checked:text-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <input
                      type="radio"
                      name="dmode"
                      value={m}
                      checked={draft.discountMode === m}
                      onChange={() => setDraft({ ...draft, discountMode: m })}
                      className="sr-only"
                      disabled={isPending}
                    />
                    {m === "none" ? t("form.discountNone") : m === "pct" ? t("form.discountPct") : t("form.discountFixed")}
                  </label>
                ))}
                {draft.discountMode !== "none" && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.discountValue}
                    onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })}
                    className="border-input bg-background num w-24 rounded-md border px-2 py-1"
                    disabled={isPending}
                  />
                )}
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setDraft({ ...EMPTY });
                  }}
                  disabled={isPending}
                >
                  {t("form.cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t("form.submitting") : t("form.addExtraLine")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
