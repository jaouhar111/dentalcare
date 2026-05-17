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
import { voidInvoice } from "@/server/actions/invoices";

export function VoidButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason.trim()) return;
    startTransition(async () => {
      const res = await voidInvoice({ id, reason });
      if (!res.ok) {
        const known = ["ALREADY_VOID", "PAID_NOT_VOIDABLE"] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "ALREADY_VOID"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.voided"));
      setReason("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {t("actions.void")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("voidDialog.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("voidDialog.reason")} *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                maxLength={300}
                placeholder={t("voidDialog.reasonPlaceholder")}
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
                {t("voidDialog.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending || !reason.trim()}>
                {t("voidDialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
