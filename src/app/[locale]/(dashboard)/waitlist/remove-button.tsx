"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { removeFromWaitlist } from "@/server/actions/waitlist";

export function RemoveWaitlistButton({ id }: { id: string }) {
  const t = useTranslations("Waitlist");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await removeFromWaitlist(id);
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("appointmentCancelled"));
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={isPending}>
      {t("remove")}
    </Button>
  );
}
