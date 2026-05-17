"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { deletePrescription } from "@/server/actions/prescriptions";

export function DeletePrescriptionButton({
  id,
  patientId,
}: {
  id: string;
  patientId: string;
}) {
  const t = useTranslations("Prescriptions");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePrescription({ id, patientId });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.deleted"));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
    >
      {t("delete")}
    </Button>
  );
}
