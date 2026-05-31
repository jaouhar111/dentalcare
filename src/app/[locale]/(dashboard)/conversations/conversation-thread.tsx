"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AIConversationStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  handoverAIConversationAction,
  reactivateAIConversationAction,
  sendAdminReplyAction,
} from "@/server/actions/ai-conversations";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";
import type { AIConversationDetail } from "@/server/actions/ai-conversations-types";
import type { ChatMessage } from "@/lib/ai/types";

interface Labels {
  handover: string;
  reactivate: string;
  handoverConfirm: string;
  handedOffBy: string;
  tool: string;
  createdAt: string;
  tokens: string;
  statusActive: string;
  statusHandedOff: string;
  statusClosed: string;
  adminInputPlaceholder: string;
  adminSend: string;
  adminHint: string;
  adminMarker: string;
}

export function ConversationThread({
  conversation,
  labels,
}: {
  conversation: AIConversationDetail;
  labels: Labels;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on selection / refresh so the admin sees the
  // latest exchange without scrolling. Use scrollHeight rather than
  // a scrollIntoView on the last message — the latter pulls the whole
  // page when the chat container itself isn't yet at the viewport edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.history.length]);

  async function onHandover() {
    const ok = await confirm({
      title: labels.handoverConfirm,
      confirmLabel: labels.handover,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await handoverAIConversationAction(conversation.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(labels.handover);
      router.refresh();
    });
  }

  async function onReactivate() {
    startTransition(async () => {
      const res = await reactivateAIConversationAction(conversation.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(labels.reactivate);
      router.refresh();
    });
  }

  const isHandedOff = conversation.status === AIConversationStatus.HANDED_OFF;
  const isClosed = conversation.status === AIConversationStatus.CLOSED;

  const [replyBody, setReplyBody] = useState("");
  const [isSending, setSending] = useState(false);
  async function onSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSending(true);
    const res = await sendAdminReplyAction({ id: conversation.id, body: replyBody });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setReplyBody("");
    router.refresh();
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground truncate text-[14px] font-semibold">
              {conversation.patientName ?? formatMoroccanPhoneShort(conversation.patientPhone)}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {formatMoroccanPhoneShort(conversation.patientPhone)}
            </span>
            <span className="chat-channel-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
              </svg>
              WhatsApp
            </span>
          </div>
          <div className="text-muted-foreground mt-1 text-[11px]">
            {labels.tokens}: {conversation.totalTokens.toLocaleString()}
            {isHandedOff && conversation.handedOffByName ? (
              <>
                {" · "}
                <span className="text-amber-600 dark:text-amber-300">
                  {labels.handedOffBy} {conversation.handedOffByName}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {isClosed ? null : isHandedOff ? (
          <Button size="sm" onClick={onReactivate} disabled={isPending}>
            {labels.reactivate}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onHandover} disabled={isPending}>
            {labels.handover}
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="chat-messages">
        {conversation.history.length === 0 ? (
          <div className="text-muted-foreground my-auto text-center text-sm">—</div>
        ) : (
          conversation.history.map((m, i) => renderMessage(m, i, labels))
        )}
      </div>

      {isHandedOff ? (
        <form onSubmit={onSendReply} className="chat-input-bar flex gap-2 border-t border-[var(--border)] bg-white/50 p-3 dark:bg-slate-900/40">
          <input
            type="text"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={labels.adminInputPlaceholder}
            disabled={isSending}
            className="bg-card/80 border-border focus:border-primary focus:ring-primary/30 h-9 flex-1 rounded-md border px-3 text-sm focus:outline-none focus:ring-2"
          />
          <Button type="submit" size="sm" disabled={isSending || !replyBody.trim()}>
            {labels.adminSend}
          </Button>
        </form>
      ) : !isClosed ? (
        <div className="border-border/60 text-muted-foreground border-t bg-white/30 p-3 text-center text-[11px] italic dark:bg-slate-900/30">
          {labels.adminHint}
        </div>
      ) : null}
    </div>
  );
}

function renderMessage(m: ChatMessage, idx: number, labels: Labels) {
  // Tool round-trips: surface them as compact monospace bubbles so the
  // admin can audit what the bot did, without dominating the visual stack.
  if (m.role === "tool") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m.content ?? "null");
    } catch {
      parsed = m.content;
    }
    return (
      <div key={idx} className="chat-msg tool">
        <strong>{labels.tool}: {m.name ?? "?"}</strong>
        <div className="mt-1 break-all opacity-80">
          {typeof parsed === "string" ? parsed : JSON.stringify(parsed)}
        </div>
      </div>
    );
  }

  // Assistant turn that emitted tool calls — show the (often empty) text
  // plus a compact list of the calls so the audit story is complete.
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return (
      <div key={idx} className="flex w-full flex-col items-start gap-1">
        {m.content ? <div className="chat-msg bot">{m.content}</div> : null}
        {m.toolCalls.map((c) => (
          <div key={c.id} className="chat-msg tool">
            <strong>→ {c.name}</strong>
            <div className="mt-1 break-all opacity-80">{JSON.stringify(c.args)}</div>
          </div>
        ))}
      </div>
    );
  }

  if (m.role === "user") {
    return (
      <div key={idx} className="chat-msg user">
        {m.content}
      </div>
    );
  }
  if (m.role === "assistant") {
    // Admin manual replies carry `name: "admin:<id>"` — render them on
    // the right side (like the user did) but with a distinct gradient
    // + a tiny "admin" marker so the audit story is unambiguous.
    const isAdmin = typeof m.name === "string" && m.name.startsWith("admin:");
    if (isAdmin) {
      return (
        <div key={idx} className="flex w-full flex-col items-end gap-0.5">
          <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
            {labels.adminMarker}
          </span>
          <div
            className="chat-msg user"
            style={{
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            {m.content}
          </div>
        </div>
      );
    }
    return (
      <div key={idx} className="chat-msg bot">
        {m.content}
      </div>
    );
  }
  // system messages aren't stored anyway, but guard for completeness
  return null;
}
