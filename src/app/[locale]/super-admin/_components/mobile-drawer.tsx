"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SA_NAV } from "./nav-data";

/**
 * Mobile drawer for the platform-owner shell. Same `nav:open` event
 * convention as the cabinet drawer so the topbar's hamburger button
 * works without prop drilling.
 */
export function SuperAdminMobileDrawer({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const rawPath = usePathname();
  const path = rawPath.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("nav:open", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("nav:open", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  function matches(h: string) {
    if (h === "/") return path === "/";
    return path === h || path.startsWith(`${h}/`);
  }
  let bestHref = "";
  for (const n of SA_NAV) {
    if (matches(n.href) && n.href.length > bestHref.length) bestHref = n.href;
  }

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={
          open
            ? "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden"
            : "pointer-events-none fixed inset-0 z-50 bg-black/0 opacity-0 transition-opacity duration-200 md:hidden"
        }
        aria-hidden={!open}
      />
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
            href={"/super-admin" as never}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
          >
            <span
              className="grid size-9 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
              style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="text-foreground block text-[14px] font-bold">Plateforme</span>
              <span className="text-muted-foreground text-[11px]">Espace propriétaire</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="hover:bg-foreground/5 text-foreground/70 rounded-lg p-2"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto text-sm">
          {SA_NAV.map((n) => {
            const isActive = bestHref === n.href;
            return (
              <Link
                key={n.href}
                href={n.href as never}
                onClick={() => setOpen(false)}
                className={
                  isActive
                    ? "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_var(--accent-glow)] transition-colors"
                    : "text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors"
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
                  <path strokeLinecap="round" strokeLinejoin="round" d={n.icon} />
                </svg>
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-border/40 mt-3 border-t pt-3">
          <div className="text-foreground truncate text-[13px] font-semibold">
            {fullName ?? "—"}
          </div>
          <div className="text-muted-foreground truncate text-[11px]">{email}</div>
        </div>
      </aside>
    </>
  );
}
