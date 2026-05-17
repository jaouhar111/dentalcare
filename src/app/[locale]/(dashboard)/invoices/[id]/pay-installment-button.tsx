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
import { recordPayment } from "@/server/actions/invoices";

const METHODS = Object.values(PaymentMethod);

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Per-installment "Encaisser" button that opens a tiny payment dialog
 * pre-filled with the installment amount. Records a Payment linked to the
 * installment so its status flips to PAID automatically.
 */
export function PayInstallmentButton({
  invoiceId,
  installmentId,
  amount,
}: {
  invoiceId: string;
  installmentId: string;
  amount: number;
}) {
  const t = useTranslations("Invoices");
  const tPlan = useTranslations("Invoices.plan");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayYmd());
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPayment({
        invoiceId,
        amount,
        method,
        reference: reference || undefined,
        receivedAt,
        installmentId,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.paymentRecorded"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
        {tPlan("cashIn")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentForm.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="bg-muted/30 rounded-md px-3 py-2 text-sm">
              <div className="num text-foreground font-semibold">
                {amount.toFixed(2)} DH
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {isPending ? t("paymentForm.submitting") : t("paymentForm.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
