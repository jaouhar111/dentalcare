"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { regenerateRecall } from "@/server/actions/recalls";

/**
 * Re-arms a recall by pushing its due date 6 months out from today. Simple
 * one-click action — for finer control the admin can disable + create a new
 * one from the patient page (next iteration).
 */
export function RegenerateRecallButton({ id }: { id: string }) {
  const t = useTranslations("Recalls");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    const newDue = new Date();
    newDue.setMonth(newDue.getMonth() + 6);
    const yyyy = newDue.getFullYear();
    const mm = String(newDue.getMonth() + 1).padStart(2, "0");
    const dd = String(newDue.getDate()).padStart(2, "0");
    startTransition(async () => {
      const res = await regenerateRecall({ id, dueDate: `${yyyy}-${mm}-${dd}` });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.regenerated"));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-primary h-7 px-2 text-xs"
    >
      {t("actions.regenerate")}
    </Button>
  );
}
