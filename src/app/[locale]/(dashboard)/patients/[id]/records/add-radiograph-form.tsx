"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RadiographKind } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRadiograph } from "@/server/actions/medical";

const KINDS = Object.values(RadiographKind);

export function AddRadiographForm({ patientId }: { patientId: string }) {
  const t = useTranslations("Records");
  const tCommon = useTranslations("Common");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const today = todayYmd();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("patientId", patientId);
    startTransition(async () => {
      const res = await createRadiograph(data);
      if (!res.ok) {
        // Map server error codes to translated messages when possible.
        const errKey = res.error.code;
        const msg = (
          ["FILE_REQUIRED", "FILE_TOO_LARGE", "FILE_TYPE_NOT_ALLOWED"] as const
        ).includes(errKey as never)
          ? t(`errors.${errKey as "FILE_REQUIRED"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.radioAdded"));
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
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
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
        {t("addRadiograph")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addRadiograph")}</DialogTitle>
          </DialogHeader>
          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.kind")}
                </label>
                <select
                  name="kind"
                  defaultValue={RadiographKind.PANORAMIC}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kind.${k}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.takenAt")}
                </label>
                <input
                  type="date"
                  name="takenAt"
                  defaultValue={today}
                  max={today}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
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
                {t("form.note")}
              </label>
              <textarea
                name="note"
                rows={3}
                maxLength={500}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
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
                {isPending ? t("form.submitting") : t("form.submitRadio")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
