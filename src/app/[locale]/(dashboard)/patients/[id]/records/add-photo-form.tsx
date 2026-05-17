"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TreatmentPhotoStage } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTreatmentPhoto } from "@/server/actions/medical";

const STAGES = Object.values(TreatmentPhotoStage);

export function AddPhotoForm({
  patientId,
  photoConsent,
}: {
  patientId: string;
  photoConsent: boolean;
}) {
  const t = useTranslations("Records");
  const tCommon = useTranslations("Common");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photoConsent) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("patientId", patientId);
    startTransition(async () => {
      const res = await createTreatmentPhoto(data);
      if (!res.ok) {
        const errKey = res.error.code;
        const known = [
          "FILE_REQUIRED",
          "FILE_TOO_LARGE",
          "FILE_TYPE_NOT_ALLOWED",
          "PHOTO_CONSENT_REQUIRED",
        ] as const;
        const msg = (known as readonly string[]).includes(errKey)
          ? t(`errors.${errKey as "FILE_REQUIRED"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.photoAdded"));
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!photoConsent}
        title={photoConsent ? undefined : t("consentRequired")}
        className="gap-1.5"
      >
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
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
        {t("addPhoto")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addPhoto")}</DialogTitle>
          </DialogHeader>
          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.stage")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STAGES.map((s, i) => (
                  <label
                    key={s}
                    className="border-input has-checked:bg-primary/10 has-checked:border-primary/40 has-checked:text-primary flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition"
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={s}
                      defaultChecked={i === 0}
                      className="sr-only"
                      disabled={isPending}
                    />
                    {t(`stage.${s}`)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.file")} *
              </label>
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                required
                disabled={isPending}
                className="file:bg-muted file:text-foreground file:border-input hover:file:bg-muted/80 w-full cursor-pointer text-sm file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium disabled:opacity-50"
              />
              <p className="text-muted-foreground mt-1 text-xs">{t("form.fileHint")}</p>
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.caption")}
              </label>
              <input
                type="text"
                name="caption"
                maxLength={200}
                placeholder={t("form.captionPlaceholder")}
                disabled={isPending}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("form.submitting") : t("form.submitPhoto")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
