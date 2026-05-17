"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { cancelPaymentPlan } from "@/server/actions/payment-plans";

export function CancelPlanButton({ id }: { id: string }) {
  const t = useTranslations("Invoices.plan");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    const ok = await confirm({
      title: t("cancelPlan"),
      description: t("cancelConfirm"),
      confirmLabel: t("cancelPlan"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await cancelPaymentPlan({ id });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.cancelled"));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={isPending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {t("cancelPlan")}
    </Button>
  );
}
