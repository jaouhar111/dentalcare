"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMedicalNote } from "@/server/actions/medical";

export function AddNoteForm({ patientId }: { patientId: string }) {
  const t = useTranslations("Records");
  const tCommon = useTranslations("Common");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setBody("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createMedicalNote({
        patientId,
        title: title || undefined,
        body,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.noteAdded"));
      reset();
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
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
          />
        </svg>
        {t("addNote")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addNote")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.title")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                disabled={isPending}
                className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-lg border px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.body")} *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={6}
                maxLength={5000}
                placeholder={t("form.bodyPlaceholder")}
                disabled={isPending}
                className="border-input bg-background focus-visible:ring-ring/40 w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
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
              <Button type="submit" disabled={isPending || !body.trim()}>
                {isPending ? t("form.submitting") : t("form.submitNote")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
