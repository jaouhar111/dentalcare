"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  clearAnnouncement,
  publishAnnouncement,
} from "@/server/actions/super-admin-announcement";

type Level = "INFO" | "WARNING";

/**
 * Super-admin composer for the platform announcement banner. Publishing
 * replaces the current one; "Retirer" deactivates it everywhere.
 */
export function AnnouncementManager({
  current,
}: {
  current: { message: string; level: Level } | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [message, setMessage] = useState(current?.message ?? "");
  const [level, setLevel] = useState<Level>(current?.level ?? "INFO");
  const [isPending, startTransition] = useTransition();

  function publish() {
    startTransition(async () => {
      const res = await publishAnnouncement({ message, level });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Annonce publiée — visible par tous les cabinets.");
      router.refresh();
    });
  }

  function retract() {
    startTransition(async () => {
      const okc = await confirm({
        title: "Retirer l'annonce ?",
        description: "La bannière disparaîtra immédiatement pour tous les cabinets.",
        confirmLabel: "Retirer",
        variant: "destructive",
      });
      if (!okc) return;
      const res = await clearAnnouncement();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setMessage("");
      setLevel("INFO");
      toast.success("Annonce retirée.");
      router.refresh();
    });
  }

  return (
    <section className="apple-card space-y-5">
      <div className="flex items-center gap-2 text-[12px]">
        {current ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            Annonce active
          </span>
        ) : (
          <span className="text-muted-foreground">Aucune annonce active.</span>
        )}
      </div>

      {/* Level */}
      <div>
        <label className="text-muted-foreground mb-2 block text-[11px] font-medium tracking-[0.08em] uppercase">
          Type
        </label>
        <div className="inline-flex rounded-full bg-black/[0.04] p-0.5 ring-1 ring-black/[0.04] dark:bg-white/[0.06]">
          {(["INFO", "WARNING"] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              disabled={isPending}
              className={`rounded-full px-3.5 py-1 text-[12px] font-medium transition ${
                level === l
                  ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "INFO" ? "📣 Info" : "⚠️ Avertissement"}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="text-muted-foreground mb-2 block text-[11px] font-medium tracking-[0.08em] uppercase">
          Message ({message.trim().length}/500)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          disabled={isPending}
          placeholder="Ex. Maintenance planifiée dimanche 22h–23h, le service WhatsApp sera momentanément indisponible."
          className="bg-background focus-visible:ring-primary/40 w-full resize-y rounded-xl px-3 py-2.5 text-[13px] leading-[1.5] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        />
      </div>

      {/* Preview */}
      {message.trim() ? (
        <div>
          <div className="text-muted-foreground mb-2 text-[11px] font-medium tracking-[0.08em] uppercase">
            Aperçu de la bannière
          </div>
          <div
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-[13px] font-medium ${
              level === "WARNING"
                ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                : "bg-sky-500/12 text-sky-900 dark:text-sky-200"
            }`}
          >
            <span aria-hidden>{level === "WARNING" ? "⚠️" : "📣"}</span>
            <span>{message.trim()}</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-4">
        <Button type="button" onClick={publish} disabled={isPending || !message.trim()}>
          {current ? "Mettre à jour l'annonce" : "Publier l'annonce"}
        </Button>
        {current ? (
          <Button
            type="button"
            variant="outline"
            onClick={retract}
            disabled={isPending}
            className="text-rose-700 dark:text-rose-300"
          >
            Retirer
          </Button>
        ) : null}
      </div>
    </section>
  );
}
