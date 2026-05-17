"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WaitlistForm, type WaitlistFormValues } from "../../waitlist-form";

export function NewWaitlistModal({
  initial,
  dentists,
}: {
  initial: WaitlistFormValues;
  dentists: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("Waitlist.form");
  const router = useRouter();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-border/60 bg-card sticky top-0 z-10 border-b px-6 py-4">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <WaitlistForm
            initial={initial}
            dentists={dentists}
            onSuccess={() => {
              router.back();
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
