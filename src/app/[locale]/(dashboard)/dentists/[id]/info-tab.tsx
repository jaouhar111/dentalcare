"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { DentistForm, type DentistFormValues } from "../dentist-form";

export function InfoTab({ initial }: { initial: DentistFormValues }) {
  const tToast = useTranslations("Toast");
  const router = useRouter();

  return (
    <div className="bg-card border-border/60 rounded-xl border p-6">
      <DentistForm
        initial={initial}
        onSuccess={(_id, _action, displayName) => {
          toast.success(tToast("dentistUpdated"), {
            description: tToast("dentistUpdatedDesc", { name: displayName }),
          });
          router.refresh();
        }}
      />
    </div>
  );
}
