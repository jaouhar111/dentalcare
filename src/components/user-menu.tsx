"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/server/actions/auth";

/**
 * Profile menu — Apple-flat redesign.
 *
 * Tap-anywhere-to-open dropdown that mirrors the macOS / iOS profile
 * menu vocabulary :
 *   - Header card : large avatar + name + email + role chip
 *   - Quick links : role-aware (Settings, AI Receptionist, Support,
 *     SUPER_ADMIN gets a "vue propriétaire" shortcut)
 *   - Destructive footer : Sign out
 *
 * Open state is fully controlled so it works on touch (the previous
 * `group-hover` version was unreachable on phones). Closing happens on
 * outside-click, Escape, or clicking any link inside.
 */

function initials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function UserMenu({
  fullName,
  email,
  role,
  roleLabel,
}: {
  fullName?: string | null;
  email: string;
  role: UserRole;
  roleLabel: string;
}) {
  const t = useTranslations("Logout");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape closes the menu. Touch-friendly: uses
  // pointerdown so mobile users see the same behavior as desktop.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isSuperAdmin = role === UserRole.SUPER_ADMIN;
  const isAdmin = role === UserRole.ADMIN;

  // Role chip colour — keeps super-admin visually distinct.
  const roleChipClass = isSuperAdmin
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : isAdmin
      ? "bg-[#0071e3]/12 text-[#0066cc] dark:text-[#2997ff]"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";

  function close() {
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Avatar trigger — keeps the same 36px target as before */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={fullName ?? email}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full bg-[#0071e3] text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_-2px_rgba(0,113,227,0.4)] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:outline-none"
      >
        {initials(fullName, email)}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-in fade-in slide-in-from-top-2 absolute end-0 top-11 z-50 w-72 origin-top-right overflow-hidden rounded-2xl bg-white p-0 ring-1 ring-black/[0.06] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)] duration-150 dark:bg-[#1c1c1e] dark:ring-white/[0.08]"
        >
          {/* ── Identity card ──────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-black/[0.05] bg-black/[0.015] px-4 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0071e3] text-[14px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              aria-hidden
            >
              {initials(fullName, email)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-[#1d1d1f] dark:text-white">
                {fullName ?? email}
              </div>
              <div className="text-muted-foreground truncate text-[12px]">
                {email}
              </div>
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] ${roleChipClass}`}
              >
                <span
                  className="size-1 rounded-full bg-current"
                  aria-hidden
                />
                {roleLabel}
              </span>
            </div>
          </div>

          {/* ── Quick links — role-aware ───────────────────── */}
          <nav className="p-1.5">
            {isSuperAdmin ? (
              <MenuLink
                href="/super-admin"
                icon="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                label="Vue propriétaire"
                onClick={close}
              />
            ) : (
              <MenuLink
                href="/dashboard"
                icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                label="Tableau de bord"
                onClick={close}
              />
            )}

            {isAdmin ? (
              <>
                <MenuLink
                  href="/settings"
                  icon="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.449-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.107-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  label="Paramètres du cabinet"
                  onClick={close}
                />
                <MenuLink
                  href="/settings/ai-receptionist"
                  icon="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                  label="AI Receptionist"
                  onClick={close}
                />
                <MenuLink
                  href="/insights"
                  icon="M3 13h2l3-8 4 16 3-8h6"
                  label="Insights"
                  onClick={close}
                />
              </>
            ) : null}

            {!isSuperAdmin ? (
              <MenuLink
                href="/support"
                icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.85L3 21l1.97-3.94A8.97 8.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                label="Support"
                onClick={close}
              />
            ) : null}
          </nav>

          {/* ── Destructive footer ─────────────────────────── */}
          <div className="border-t border-black/[0.05] dark:border-white/[0.06]">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 px-3 py-3 text-start text-[14px] font-medium text-red-700 transition-colors hover:bg-red-500/[0.06] dark:text-red-300"
              >
                <span className="bg-red-500/12 text-red-700 grid size-7 shrink-0 place-items-center rounded-full dark:text-red-300">
                  <svg
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                </span>
                {t("label")}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One link row inside the menu. Same visual rhythm everywhere —
 * 28px icon tile + label + chevron, hover lifts background.
 */
function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href as never}
      role="menuitem"
      onClick={onClick}
      className="text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-3 rounded-xl px-2 py-2 text-[14px] font-medium transition-colors"
    >
      <span
        className="bg-black/[0.05] dark:bg-white/[0.08] text-foreground grid size-7 shrink-0 place-items-center rounded-lg"
        aria-hidden
      >
        <svg
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <span className="flex-1 truncate">{label}</span>
      <svg
        className="text-muted-foreground/60 size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
