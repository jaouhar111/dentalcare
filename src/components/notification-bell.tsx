"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { NotificationItem } from "@/server/actions/dashboard";

/**
 * Topbar notification bell + dropdown.
 *
 * `items` is fetched server-side at render time and serialised in. The badge
 * dot is shown only when there's at least one item. Clicking the bell opens
 * a card listing each item; click a row to jump to the relevant page (which
 * naturally dismisses by virtue of navigation).
 *
 * Outside-click closes the dropdown. We don't auto-refresh — the dashboard
 * action is cached for 30s and the topbar re-renders on next navigation.
 */
export function NotificationBell({
  items,
  ariaLabel,
}: {
  items: NotificationItem[];
  ariaLabel: string;
}) {
  const t = useTranslations("Notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const total = items.reduce((s, n) => s + n.count, 0);
  const hasItems = items.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted text-muted-foreground hover:text-foreground relative rounded p-1.5 transition"
      >
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {hasItems && (
          <span
            className="bg-destructive absolute -top-0.5 inset-e-0.5 grid size-4 place-items-center rounded-full text-[10px] font-bold text-white"
            aria-hidden
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="bg-popover text-popover-foreground border-border absolute inset-e-0 top-10 z-50 w-80 overflow-hidden rounded-lg border shadow-xl"
        >
          <div className="border-border/60 flex items-center justify-between border-b px-3 py-2">
            <div className="text-foreground text-sm font-semibold">{t("title")}</div>
            {hasItems && (
              <Link
                href={"/" as never}
                onClick={() => setOpen(false)}
                className="text-primary text-xs hover:underline"
              >
                {t("viewAll")}
              </Link>
            )}
          </div>
          {!hasItems ? (
            <div className="p-6 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 mx-auto grid size-10 place-items-center rounded-full text-emerald-700 dark:text-emerald-300">
                ✓
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{t("empty")}</p>
            </div>
          ) : (
            <ul className="divide-border/60 divide-y">
              {items.map((n) => {
                const tone =
                  n.kind === "overdue-plans" || n.kind === "open-invoices"
                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                    : n.kind === "low-stock"
                      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                      : n.kind === "recalls"
                        ? "bg-primary/10 text-primary"
                        : "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300";
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href as never}
                      onClick={() => setOpen(false)}
                      className="hover:bg-muted/40 flex items-center gap-3 px-3 py-3 text-sm transition"
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}
                      >
                        {n.count}
                      </span>
                      <span className="text-foreground flex-1 min-w-0">
                        {t(`items.${n.titleKey as "overduePlans"}`, { count: n.count })}
                      </span>
                      <svg
                        className="text-muted-foreground size-4 rtl:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
