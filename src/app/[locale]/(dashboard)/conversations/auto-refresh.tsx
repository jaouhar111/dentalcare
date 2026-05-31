"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Tab-visibility-aware polling. Calls `router.refresh()` every
 * `intervalMs` while the document is visible — pauses when the tab is
 * backgrounded so we don't burn a Server-Component re-render every 5s
 * on inactive tabs.
 *
 * Re-runs the page's Server Components, which re-reads the conversation
 * list + selected thread from Postgres — fresh enough for a chat UI
 * without bringing in WebSockets/SSE for a V1.
 */
export function ConversationsAutoRefresh({ intervalMs = 5_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = () => {
      stop();
      timerRef.current = setInterval(() => {
        router.refresh();
      }, intervalMs);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Visible again — refresh once immediately, then resume polling.
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
