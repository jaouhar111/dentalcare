"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PatientForm, type PatientFormValues } from "../../patient-form";

export function NewPatientModal({ initial }: { initial: PatientFormValues }) {
  const t = useTranslations("PatientForm");
  const tToast = useTranslations("Toast");
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-border/60 bg-card sticky top-0 z-10 border-b px-6 py-4">
          <DialogTitle>{t("titleCreate")}</DialogTitle>
          <DialogDescription className="sr-only">{t("titleCreate")}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <PatientForm
            initial={initial}
            onSuccess={(_id, _action, displayName) => {
              toast.success(tToast("patientCreated"), {
                description: tToast("patientCreatedDesc", { name: displayName }),
              });
              // Close the modal and refresh the list under it.
              router.back();
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
