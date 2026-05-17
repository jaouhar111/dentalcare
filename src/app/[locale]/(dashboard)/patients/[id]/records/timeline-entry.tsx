"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import {
  deleteMedicalNote,
  deleteRadiograph,
  deleteTreatmentPhoto,
} from "@/server/actions/medical";
import type { TimelineEntry } from "@/server/actions/medical-types";

export function TimelineEntryCard({
  entry,
  patientId,
  patientName,
  canManage,
}: {
  entry: TimelineEntry;
  patientId: string;
  patientName: string;
  canManage: boolean;
}) {
  const t = useTranslations("Records");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onDelete() {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res =
        entry.kind === "NOTE"
          ? await deleteMedicalNote({ id: entry.data.id, patientId })
          : entry.kind === "RADIOGRAPH"
            ? await deleteRadiograph({ id: entry.data.id, patientId })
            : await deleteTreatmentPhoto({ id: entry.data.id, patientId });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      const toastKey =
        entry.kind === "NOTE"
          ? "noteDeleted"
          : entry.kind === "RADIOGRAPH"
            ? "radioDeleted"
            : "photoDeleted";
      toast.success(t(`toast.${toastKey}`));
      router.refresh();
    });
  }

  // ─── Note ─────────────────────────────────────────────────────────────────
  if (entry.kind === "NOTE") {
    const note = entry.data;
    return (
      <article className="bg-card border-border/60 rounded-lg border p-4 shadow-sm">
        <header className="mb-2 flex items-start justify-between gap-3">
          <div>
            {note.title && (
              <h3 className="text-foreground text-sm font-semibold">{note.title}</h3>
            )}
            <p className="text-muted-foreground text-xs">
              {t("noteAuthor", { name: note.authorName })}
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
            >
              {t("delete")}
            </Button>
          )}
        </header>
        <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
          {note.body}
        </p>
      </article>
    );
  }

  // ─── Radiograph / Photo (image) ───────────────────────────────────────────
  const isRadio = entry.kind === "RADIOGRAPH";
  const data = entry.data;
  const url = data.url;
  const thumb = data.thumbnailUrl;
  const tagLabel = isRadio
    ? t(`kind.${entry.kind === "RADIOGRAPH" ? entry.data.kind : "OTHER"}`)
    : t(`stage.${entry.kind === "PHOTO" ? entry.data.stage : "BEFORE"}`);
  const captionOrNote =
    entry.kind === "RADIOGRAPH" ? entry.data.note : entry.data.caption;

  return (
    <>
      <article className="bg-card border-border/60 overflow-hidden rounded-lg border shadow-sm">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group bg-muted/40 relative block w-full overflow-hidden text-start"
          aria-label={t("viewLarger")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={tagLabel}
            className="aspect-video w-full object-cover transition group-hover:scale-[1.01]"
            loading="lazy"
          />
          <span className="bg-card/90 text-foreground absolute top-2 inset-s-2 rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
            {isRadio ? "🦷 " : "📸 "}
            {tagLabel}
          </span>
        </button>
        <div className="space-y-1 p-3">
          {captionOrNote && (
            <p className="text-foreground/90 text-sm">{captionOrNote}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {t("uploaderBy", { name: data.uploaderName })}
            </p>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
              >
                {t("delete")}
              </Button>
            )}
          </div>
        </div>
      </article>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="!max-w-5xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{patientName}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={patientName}
            className="max-h-[90vh] w-full rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
