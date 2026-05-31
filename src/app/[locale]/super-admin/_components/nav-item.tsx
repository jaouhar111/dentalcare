"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";

/**
 * Sidebar nav row for the super-admin area. Gold gradient on active
 * (vs blue/cyan in the cabinet sidebar), longest-match active so
 * /super-admin/clinics doesn't accidentally also light up /super-admin.
 */
export function SaNavItem({
  href,
  icon,
  label,
  allHrefs,
}: {
  href: string;
  icon: string;
  label: string;
  allHrefs: readonly string[];
}) {
  const rawPath = usePathname();
  const path = rawPath.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";

  function matches(h: string): boolean {
    if (h === "/") return path === "/";
    return path === h || path.startsWith(`${h}/`);
  }
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
          ? "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_var(--accent-glow)] transition-colors"
          : "text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors"
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
    </Link>
  );
}
