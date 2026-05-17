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
import { AppointmentForm, type AppointmentFormValues } from "../../../appointment-form";

export function EditAppointmentModal({
  initial,
  dentists,
  patientName,
  lockedDentistId,
}: {
  initial: AppointmentFormValues;
  dentists: Array<{ id: string; name: string; color: string }>;
  patientName: string;
  lockedDentistId?: string | null;
}) {
  const t = useTranslations("AppointmentForm");
  const tToast = useTranslations("Toast");
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 bg-card sticky top-0 z-10 border-b px-6 py-4">
          <DialogTitle>{t("titleEdit")}</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <AppointmentForm
            initial={initial}
            dentists={dentists}
            lockedDentistId={lockedDentistId}
            onSuccess={() => {
              toast.success(tToast("appointmentUpdated"));
              router.back();
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
