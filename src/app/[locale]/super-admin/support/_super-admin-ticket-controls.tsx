"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import {
  setTicketPriority,
  setTicketStatus,
} from "@/server/actions/super-admin-support";
import {
  PRIORITY_STYLE,
  STATUS_STYLE,
} from "@/app/[locale]/(dashboard)/support/_components/labels";

const PRIORITIES: SupportTicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUSES: SupportTicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
];

/**
 * Side panel on the super-admin ticket detail. Two stacked pickers —
 * one for priority, one for status — both calling their server action
 * on click. No "Save" button; every click is an immediate write.
 */
export function SuperAdminTicketControls({
  ticketId,
  currentStatus,
  currentPriority,
}: {
  ticketId: string;
  currentStatus: SupportTicketStatus;
  currentPriority: SupportTicketPriority;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changePriority(p: SupportTicketPriority) {
    if (p === currentPriority) return;
    startTransition(async () => {
      const res = await setTicketPriority(ticketId, p);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Priorité mise à jour.");
      router.refresh();
    });
  }

  function changeStatus(s: SupportTicketStatus) {
    if (s === currentStatus) return;
    startTransition(async () => {
      const res = await setTicketStatus(ticketId, s);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Statut mis à jour.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="bg-card rounded-2xl p-5 ring-1 ring-black/[0.04]">
        <div className="text-muted-foreground mb-3 text-[11px] font-medium tracking-[0.08em] uppercase">
          Priorité
        </div>
        <div className="space-y-1.5">
          {PRIORITIES.map((p) => {
            const active = p === currentPriority;
            const sty = PRIORITY_STYLE[p];
            return (
              <button
                key={p}
                type="button"
                disabled={isPending || active}
                onClick={() => changePriority(p)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-[13px] font-medium transition ${
                  active
                    ? "bg-primary/[0.08] text-foreground ring-primary/30 ring-1 cursor-default"
                    : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: sty.dot }}
                  aria-hidden
                />
                {sty.label}
                {active ? (
                  <svg className="ml-auto size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 ring-1 ring-black/[0.04]">
        <div className="text-muted-foreground mb-3 text-[11px] font-medium tracking-[0.08em] uppercase">
          Statut
        </div>
        <div className="space-y-1.5">
          {STATUSES.map((s) => {
            const active = s === currentStatus;
            const sty = STATUS_STYLE[s];
            return (
              <button
                key={s}
                type="button"
                disabled={isPending || active}
                onClick={() => changeStatus(s)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-[13px] font-medium transition ${
                  active
                    ? "bg-primary/[0.08] text-foreground ring-primary/30 ring-1 cursor-default"
                    : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: sty.dot }}
                  aria-hidden
                />
                {sty.label}
                {active ? (
                  <svg className="ml-auto size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
