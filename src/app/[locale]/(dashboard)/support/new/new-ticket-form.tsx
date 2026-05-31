"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  SupportTicketCategory,
  SupportTicketPriority,
} from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createSupportTicket } from "@/server/actions/support";
import { CATEGORY_LABEL, PRIORITY_STYLE } from "../_components/labels";

const CATEGORIES: SupportTicketCategory[] = [
  "TECHNICAL_BUG",
  "HOW_TO",
  "WHATSAPP",
  "BILLING",
  "ACCOUNT",
  "FEATURE_REQUEST",
  "OTHER",
];
const PRIORITIES: SupportTicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("TECHNICAL_BUG");
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupportTicket({ subject, body, category, priority });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Ticket envoyé — on revient vers vous rapidement.");
      router.push(`/support/${res.data.id}` as never);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Category */}
      <div>
        <label className="text-foreground mb-2 block text-[13px] font-semibold">
          Catégorie
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                disabled={isPending}
                className={`rounded-xl px-3 py-2.5 text-start text-[13px] font-medium transition-all ${
                  active
                    ? "bg-primary/[0.08] ring-primary/40 text-foreground ring-1"
                    : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground ring-1 ring-black/[0.06]"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-foreground mb-2 block text-[13px] font-semibold">
          Priorité
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map((p) => {
            const active = p === priority;
            const sty = PRIORITY_STYLE[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                disabled={isPending}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-medium transition-all ${
                  active
                    ? "bg-primary/[0.08] ring-primary/40 text-foreground ring-1"
                    : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground ring-1 ring-black/[0.06]"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: sty.dot }}
                  aria-hidden
                />
                {sty.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="ticket-subject"
          className="text-foreground mb-2 block text-[13px] font-semibold"
        >
          Sujet
        </label>
        <input
          id="ticket-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          required
          disabled={isPending}
          placeholder="Ex. « Je n'arrive pas à enregistrer un nouveau patient »"
          className="bg-background placeholder:text-muted-foreground/60 focus-visible:ring-primary/40 w-full rounded-xl px-3.5 py-2.5 text-[14px] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        />
      </div>

      {/* Body */}
      <div>
        <label
          htmlFor="ticket-body"
          className="text-foreground mb-2 block text-[13px] font-semibold"
        >
          Détails
        </label>
        <textarea
          id="ticket-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          minLength={10}
          maxLength={5000}
          required
          disabled={isPending}
          placeholder="Décrivez ce que vous avez fait, ce que vous attendiez, et ce qui s'est passé à la place. Ajoutez le nom du patient ou l'écran concerné si pertinent."
          className="bg-background placeholder:text-muted-foreground/60 focus-visible:ring-primary/40 w-full resize-y rounded-xl px-3.5 py-2.5 text-[14px] leading-[1.5] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        />
        <div className="text-muted-foreground mt-1 text-[11px]">
          {body.length} / 5000 caractères
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => router.push("/support" as never)}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isPending || subject.length < 3 || body.length < 10}
          className="rounded-full px-6"
        >
          {isPending ? "Envoi…" : "Envoyer le ticket"}
        </Button>
      </div>
    </form>
  );
}
