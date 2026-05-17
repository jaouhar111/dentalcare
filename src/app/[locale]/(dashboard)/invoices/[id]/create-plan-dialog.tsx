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
import { createPaymentPlan } from "@/server/actions/payment-plans";

function todayYmd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1); // default first installment = same day next month
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function CreatePlanDialog({
  invoiceId,
  remaining,
}: {
  invoiceId: string;
  remaining: number;
}) {
  const t = useTranslations("Invoices.plan");
  const tInvoices = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [installments, setInstallments] = useState("3");
  const [startDate, setStartDate] = useState(todayYmd());
  const [downPayment, setDownPayment] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setInstallments("3");
    setStartDate(todayYmd());
    setDownPayment("");
    setNotes("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPaymentPlan({
        invoiceId,
        installmentsCount: Number(installments),
        startDate,
        downPayment: downPayment ? Number(downPayment) : undefined,
        notes: notes || undefined,
      });
      if (!res.ok) {
        const known = ["INVOICE_NOT_PAYABLE", "PLAN_EXISTS", "NOTHING_TO_PLAN"] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "PLAN_EXISTS"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.created"));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {t("createCTA")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.installments")} *
                </label>
                <input
                  type="number"
                  min="2"
                  max="36"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  required
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.startDate")} *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.downPayment")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={remaining}
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                placeholder="0"
                disabled={isPending}
                className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {tInvoices("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("form.submitting") : t("form.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
