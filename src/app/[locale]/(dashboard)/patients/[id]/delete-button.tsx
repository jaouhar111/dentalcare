"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { softDeletePatient } from "@/server/actions/patients";

export function DeletePatientButton({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const t = useTranslations("Patients");
  const tCommon = useTranslations("Common");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await softDeletePatient(patientId);
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("patientDeleted"), {
        description: tToast("patientDeletedDesc", { name: patientName }),
      });
      setOpen(false);
      router.replace("/patients" as never);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)} className="gap-1.5">
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
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
        {t("delete")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
            <DialogDescription>{t("confirmDeleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
              {isPending ? "…" : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
