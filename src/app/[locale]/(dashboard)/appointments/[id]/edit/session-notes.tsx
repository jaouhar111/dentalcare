"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import {
  createMedicalNote,
  deleteMedicalNote,
} from "@/server/actions/medical";
import type { MedicalNoteListItem } from "@/server/actions/medical-types";
import type { Locale } from "@/i18n/routing";

/**
 * Inline clinical-notes panel inside the appointment edit page.
 *
 * Server-rendered list of existing notes for this séance + a quick add form.
 * Only ADMIN / DENTIST can post; the page passes `canManage = false` for
 * receptionists so they see the notes (helpful at the desk) but cannot edit.
 */
export function SessionNotes({
  appointmentId,
  patientId,
  notes,
  canManage,
  locale,
}: {
  appointmentId: string;
  patientId: string;
  notes: MedicalNoteListItem[];
  canManage: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Records");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createMedicalNote({
        patientId,
        appointmentId,
        title: title || undefined,
        body,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.noteAdded"));
      setTitle("");
      setBody("");
      router.refresh();
    });
  }

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteMedicalNote({ id, patientId });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.noteDeleted"));
      router.refresh();
    });
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      {/* ─── Existing notes ─── */}
      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="bg-muted/30 border-border/60 rounded-lg border p-3 text-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {n.title && (
                    <div className="text-foreground font-semibold">{n.title}</div>
                  )}
                  <div className="text-muted-foreground num text-xs">
                    {t("noteAuthor", { name: n.authorName })} · {dateFmt.format(n.createdAt)}
                  </div>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onDelete(n.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive h-6 px-2 text-xs"
                  >
                    {t("delete")}
                  </Button>
                )}
              </div>
              <p className="text-foreground/90 whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ─── Add form (clinicians only) ─── */}
      {canManage && (
        <form
          onSubmit={onSubmit}
          className="bg-card border-border/60 space-y-3 rounded-lg border p-3"
        >
          <input
            type="text"
            placeholder={t("form.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={isPending}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={t("form.bodyPlaceholder")}
            disabled={isPending}
            className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !body.trim()}>
              {isPending ? t("form.submitting") : t("form.submitNote")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
