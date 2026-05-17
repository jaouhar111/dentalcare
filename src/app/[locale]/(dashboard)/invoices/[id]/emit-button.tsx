"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { emitInvoice } from "@/server/actions/invoices";

export function EmitButton({ id, hasLines }: { id: string; hasLines: boolean }) {
  const t = useTranslations("Invoices");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    const ok = await confirm({
      title: t("actions.emit"),
      description: t("actions.emitConfirm"),
      confirmLabel: t("actions.emit"),
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await emitInvoice({ id });
      if (!res.ok) {
        const known = [
          "EMPTY_INVOICE",
          "ALREADY_EMITTED",
          "NOT_FOUND",
        ] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "EMPTY_INVOICE"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.emitted", { number: res.data.number }));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={isPending || !hasLines}
      title={!hasLines ? t("errors.EMPTY_INVOICE") : undefined}
      className="gap-1.5"
    >
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
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
      {isPending ? t("actions.emitting") : t("actions.emit")}
    </Button>
  );
}
