"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PaymentMethod } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { deletePayment, recordPayment } from "@/server/actions/invoices";
import type { PaymentLite } from "@/server/actions/invoices-types";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

const METHODS = Object.values(PaymentMethod);

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Right-column card listing the recorded payments + offering a "Delete"
 * affordance per row when the parent says it's allowed. Pairs with the
 * `PaymentPanel.RecordButton` exposed below.
 */
export function PaymentPanel({
  payments,
  canDelete,
  locale,
}: {
  invoiceId: string;
  payments: PaymentLite[];
  canDelete: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function onDelete(paymentId: string) {
    const ok = await confirm({
      title: t("paymentSection.title"),
      description: t("actions.voidConfirm"),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePayment({ paymentId });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.paymentDeleted"));
      router.refresh();
    });
  }

  return (
    <div className="bg-card border-border/60 rounded-xl border p-5">
      <div className="text-muted-foreground mb-3 text-xs tracking-wider uppercase">
        {t("paymentSection.title")}
      </div>
      {payments.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm italic">
          {t("paymentSection.empty")}
        </p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {payments.map((p) => (
            <li key={p.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-foreground num font-semibold">
                    {formatCurrency(p.amount, locale)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("paymentSection.via", { method: t(`method.${p.method}`) })}
                    {p.reference && ` · ${t("paymentSection.ref", { ref: p.reference })}`}
                  </div>
                  <div className="text-muted-foreground num text-xs">
                    {formatDate(p.receivedAt, locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {t("paymentSection.by", { name: p.recordedByName })}
                  </div>
                </div>
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onDelete(p.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                  >
                    ×
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Exported separately (not as `PaymentPanel.RecordButton`) because Server
 * Components can't dereference static properties on a client-component module
 * boundary — Next.js passes a module-reference proxy, not the real function.
 */
export function RecordPaymentButton({
  invoiceId,
  remaining,
  label,
}: {
  invoiceId: string;
  remaining: number;
  label: string;
}) {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining.toFixed(2)));
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayYmd());
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setAmount(String(remaining.toFixed(2)));
    setMethod(PaymentMethod.CASH);
    setReference("");
    setReceivedAt(todayYmd());
    setNotes("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPayment({
        invoiceId,
        amount: Number(amount),
        method,
        reference: reference || undefined,
        receivedAt,
        notes: notes || undefined,
      });
      if (!res.ok) {
        const known = ["OVERPAYMENT", "INVOICE_NOT_PAYABLE"] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "OVERPAYMENT"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.paymentRecorded"));
      reset();
      setOpen(false);
      router.refresh();
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
          />
        </svg>
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentForm.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("paymentForm.amount")} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("paymentForm.method")}
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`method.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("paymentForm.receivedAt")}
                </label>
                <input
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  max={todayYmd()}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("paymentForm.reference")}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={80}
                  placeholder={t("paymentForm.referencePlaceholder")}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("paymentForm.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={300}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("paymentForm.submitting") : t("paymentForm.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
