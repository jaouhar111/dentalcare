"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";

/**
 * Nav row with active-state detection. Client Component because Server
 * Components can't read the URL.
 *
 * Longest-match wins: on `/settings/treatments` both `/settings` and
 * `/settings/treatments` prefix-match, but only the more specific item
 * should light up. The parent passes `allHrefs` so each row can verify
 * it owns the best match before claiming active.
 */
export function SidebarNavItem({
  href,
  icon,
  label,
  allHrefs,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  allHrefs: readonly string[];
  /// Optional unread count rendered as a pill on the right. Falsy
  /// values render nothing — we never show a zero badge.
  badge?: number;
}) {
  const rawPath = usePathname();
  // next-intl emits locale-prefixed paths (/fr/patients) — strip for matching.
  const path = rawPath.replace(/^\/(fr|en|ar)(?=\/|$)/, "") || "/";

  function matches(h: string): boolean {
    if (h === "/") return path === "/";
    return path === h || path.startsWith(`${h}/`);
  }

  // Pick the longest matching href across the whole nav — only that row wins.
  let bestHref = "";
  for (const h of allHrefs) {
    if (matches(h) && h.length > bestHref.length) bestHref = h;
  }
  const isActive = bestHref === href;

  return (
    <Link
      href={href as never}
      className={
        isActive
          ? "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_var(--accent-glow)] transition-colors duration-150"
          : "text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150"
      }
      style={
        isActive
          ? { background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }
          : undefined
      }
    >
      <svg
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="truncate">{label}</span>
      {badge && badge > 0 ? (
        <span
          className={
            isActive
              ? "ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white"
              : "ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white shadow-[0_2px_8px_var(--accent-glow)]"
          }
          style={
            isActive
              ? undefined
              : { background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }
          }
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
