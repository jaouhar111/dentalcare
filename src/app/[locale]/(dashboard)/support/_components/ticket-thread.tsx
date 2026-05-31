"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SupportTicketStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { replyToTicket, resolveTicket } from "@/server/actions/support";
import type { SupportTicketDetail } from "@/server/actions/support-types";
import { CATEGORY_LABEL, PRIORITY_STYLE, STATUS_STYLE } from "./labels";

/**
 * Two-panel thread view: meta column on the left (subject, status,
 * category, opened-by) + conversation column on the right (original
 * body as the first bubble, then each reply).
 *
 * `isSuperAdminView` toggles the avatar / bubble side and the role
 * label. Cabinet view: super-admin bubbles align left (support side),
 * cabinet bubbles align right. Super-admin view: mirror.
 */
export function TicketThread({
  ticket,
  locale,
  isSuperAdminView,
}: {
  ticket: SupportTicketDetail;
  locale: string;
  isSuperAdminView: boolean;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [isPending, startTransition] = useTransition();

  const statusStyle = STATUS_STYLE[ticket.status];
  const priorityStyle = PRIORITY_STYLE[ticket.priority];
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  function onReply(e: React.FormEvent) {
    e.preventDefault();
    if (reply.trim().length === 0) return;
    startTransition(async () => {
      const res = await replyToTicket({ ticketId: ticket.id, body: reply });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setReply("");
      toast.success("Réponse envoyée.");
      router.refresh();
    });
  }

  function onResolve() {
    startTransition(async () => {
      const res = await resolveTicket(ticket.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Ticket marqué comme résolu.");
      router.refresh();
    });
  }

  const isClosed = ticket.status === SupportTicketStatus.RESOLVED;

  // First message + replies, unified for the rendering loop. The
  // original ticket body is always treated as a "cabinet" message
  // (the ticket creator opened it).
  const messages: Array<{
    id: string;
    body: string;
    author: string;
    at: Date;
    fromSuperAdmin: boolean;
    isOriginal?: boolean;
  }> = [
    {
      id: ticket.id,
      body: ticket.body,
      author: ticket.createdBy.fullName,
      at: ticket.createdAt,
      fromSuperAdmin: false,
      isOriginal: true,
    },
    ...ticket.replies.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.authorName,
      at: r.createdAt,
      fromSuperAdmin: r.isFromSuperAdmin,
    })),
  ];

  return (
    <div className="space-y-5">
      {/* Header card — subject + meta */}
      <div className="bg-card rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-foreground text-[22px] leading-[1.2] font-semibold tracking-tight">
              {ticket.subject}
            </h1>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
              {isSuperAdminView ? (
                <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-medium">
                  🏥 {ticket.clinicName}
                </span>
              ) : null}
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-medium">
                {CATEGORY_LABEL[ticket.category]}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: priorityStyle.dot }}
                  aria-hidden
                />
                {priorityStyle.label}
              </span>
              <span>·</span>
              <span>
                Ouvert par {ticket.createdBy.fullName} ·{" "}
                {dateFmt.format(ticket.createdAt)}
              </span>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle.cls}`}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: statusStyle.dot }}
              aria-hidden
            />
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Thread */}
      <div className="bg-card rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
        <ul className="space-y-5">
          {messages.map((m) => {
            // Which side of the thread does this bubble belong to?
            // Cabinet view: cabinet on the right, support on the left.
            // Super-admin view: super-admin on the right, cabinet on the left.
            const mineSide = isSuperAdminView
              ? m.fromSuperAdmin
              : !m.fromSuperAdmin;
            return (
              <li
                key={m.id}
                className={`flex gap-3 ${mineSide ? "flex-row-reverse" : ""}`}
              >
                <Avatar isSupport={m.fromSuperAdmin} name={m.author} />
                <div
                  className={`max-w-[80%] min-w-0 flex-1 ${mineSide ? "text-end" : ""}`}
                >
                  <div className="text-muted-foreground mb-1 text-[11px]">
                    <span className="text-foreground font-semibold">
                      {m.fromSuperAdmin ? "Support DentalCare" : m.author}
                    </span>{" "}
                    · {fmt.format(m.at)}
                    {m.isOriginal ? " · message original" : null}
                  </div>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 text-[14px] leading-[1.55] whitespace-pre-wrap ${
                      m.fromSuperAdmin
                        ? "bg-primary/8 text-foreground ring-primary/20 ring-1"
                        : "bg-black/[0.04] text-foreground"
                    } ${mineSide ? "rounded-tr-md" : "rounded-tl-md"}`}
                  >
                    {m.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Reply composer or "closed" notice */}
        {isClosed ? (
          <div className="mt-6 rounded-xl bg-emerald-500/[0.06] p-4 text-emerald-800 ring-1 ring-emerald-500/15 dark:text-emerald-200">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Ticket résolu
            </div>
            <p className="mt-1 text-[12px] opacity-90">
              Ajoutez une réponse ci-dessous pour rouvrir le ticket si nécessaire.
            </p>
            <form onSubmit={onReply} className="mt-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                disabled={isPending}
                placeholder="Rouvrir avec une nouvelle réponse…"
                className="bg-background placeholder:text-muted-foreground/60 w-full resize-y rounded-xl px-3.5 py-2.5 text-[13px] ring-1 ring-black/[0.06] disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={isPending || reply.trim().length === 0}
                className="mt-2 h-9 rounded-full px-4 text-[13px]"
              >
                Rouvrir le ticket
              </Button>
            </form>
          </div>
        ) : (
          <form onSubmit={onReply} className="mt-6 border-t border-black/[0.05] pt-5">
            <label htmlFor="reply-body" className="text-foreground mb-2 block text-[13px] font-semibold">
              Votre réponse
            </label>
            <textarea
              id="reply-body"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={5000}
              disabled={isPending}
              placeholder="Écrivez votre réponse…"
              className="bg-background placeholder:text-muted-foreground/60 focus-visible:ring-primary/40 w-full resize-y rounded-xl px-3.5 py-2.5 text-[14px] leading-[1.5] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={onResolve}
                className="text-muted-foreground hover:text-emerald-700 h-9 rounded-full px-4 text-[13px]"
              >
                Marquer résolu
              </Button>
              <Button
                type="submit"
                disabled={isPending || reply.trim().length === 0}
                className="h-9 rounded-full px-5 text-[13px] font-semibold"
              >
                {isPending ? "Envoi…" : "Envoyer la réponse"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Avatar({ isSupport, name }: { isSupport: boolean; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (isSupport) {
    return (
      <div
        className="grid size-9 shrink-0 place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_var(--accent-glow)]"
        style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
        aria-hidden
      >
        <svg width="16" height="16" viewBox="0 0 64 64" fill="currentColor">
          <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="text-foreground grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[13px] font-semibold ring-1 ring-black/[0.04]" aria-hidden>
      {initial}
    </div>
  );
}
