"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { UserRole } from "@prisma/client";
import { NAV_SECTIONS } from "./nav-data";

/**
 * Mobile-only navigation drawer. Hidden on `md+` (the static sidebar
 * takes over there). Triggered by clicking the hamburger button —
 * the topbar dispatches a custom `nav:open` window event to avoid
 * threading state through 4 component layers.
 *
 * Closing happens on: backdrop click, link tap, ESC. We deliberately
 * close on link tap so the user lands on the new page with the drawer
 * gone (no animation gymnastics required).
 */
export function MobileSidebarDrawer({
  role,
  clinicName,
  logoUrl,
  navLabels,
}: {
  role: UserRole;
  clinicName: string;
  logoUrl: string | null;
  /// Pre-translated labels (the drawer is a client component so it
  /// can't call next-intl server hooks). Keys mirror the Nav namespace.
  navLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const rawPath = usePathname();
  const path = rawPath.replace(/^\/(fr|en|ar)(?=\/|$)/, "") || "/";

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("nav:open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("nav:open", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Lock body scroll while the drawer is open — otherwise the
  // background page bleeds touch events through the backdrop.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  function matches(h: string): boolean {
    if (h === "/") return path === "/";
    return path === h || path.startsWith(`${h}/`);
  }

  // Compute the longest-match active item across the whole drawer so
  // /settings/treatments doesn't also light up /settings.
  const visible = NAV_SECTIONS.flatMap((s) =>
    s.items.filter((it) => !it.roles || it.roles.includes(role)),
  );
  let bestHref = "";
  for (const it of visible) {
    if (matches(it.href) && it.href.length > bestHref.length) bestHref = it.href;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={
          open
            ? "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden"
            : "pointer-events-none fixed inset-0 z-50 bg-black/0 opacity-0 transition-opacity duration-200 md:hidden"
        }
        aria-hidden={!open}
      />
      {/* Drawer panel */}
      <aside
        className={
          "glass-thick fixed inset-y-0 left-0 z-50 flex w-[78vw] max-w-[300px] flex-col gap-1 overflow-y-auto p-4 shadow-2xl transition-transform duration-300 ease-out md:hidden " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-1 pb-3">
          <Link
            href={"/dashboard" as never}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
          >
            {logoUrl ? (
              <span className="border-border/40 bg-white grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={clinicName} className="h-full w-full object-contain" />
              </span>
            ) : (
              <span
                className="grid size-9 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
                style={{
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                }}
                aria-hidden
              >
                <svg viewBox="0 0 64 64" className="size-5" fill="currentColor">
                  <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
                </svg>
              </span>
            )}
            <span className="leading-tight">
              <span className="text-foreground block truncate text-[14px] font-bold tracking-tight">
                {clinicName}
              </span>
              <span className="text-muted-foreground text-[11px]">Cabinet dentaire</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="hover:bg-foreground/5 text-foreground/70 rounded-lg p-2"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto text-sm">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (it) => !it.roles || it.roles.includes(role),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="mb-1">
                <div className="text-muted-foreground/80 px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.06em] uppercase">
                  {navLabels[section.title] ?? section.title}
                </div>
                {visibleItems.map((it) => {
                  const isActive = bestHref === it.href;
                  return (
                    <Link
                      key={it.href}
                      href={it.href as never}
                      onClick={() => setOpen(false)}
                      className={
                        isActive
                          ? "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_var(--accent-glow)] transition-colors"
                          : "text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors"
                      }
                      style={
                        isActive
                          ? {
                              background:
                                "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                            }
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
                        <path strokeLinecap="round" strokeLinejoin="round" d={it.icon} />
                      </svg>
                      <span className="truncate">{navLabels[it.label] ?? it.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
