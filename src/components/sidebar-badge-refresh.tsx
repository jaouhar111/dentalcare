"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers a soft `router.refresh()` on an interval — the App Sidebar is
 * a Server Component reading `getUnreadConversationsCount()`, so the
 * refresh re-runs it and bumps the badge if a new patient message landed.
 *
 * Tab-visibility aware (same pattern as ConversationsAutoRefresh) so we
 * don't poll backgrounded tabs.
 */
export function SidebarBadgeRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const start = () => {
      stop();
      timerRef.current = setInterval(() => router.refresh(), intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else stop();
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
