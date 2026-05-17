"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { deactivateCatalogItem } from "@/server/actions/treatments";

export function DeactivateButton({ id }: { id: string }) {
  const t = useTranslations("Treatments");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    const ok = await confirm({
      title: t("deactivate"),
      description: t("deactivateConfirm"),
      confirmLabel: t("deactivate"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deactivateCatalogItem(id);
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.deactivated"));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
    >
      {t("deactivate")}
    </Button>
  );
}
