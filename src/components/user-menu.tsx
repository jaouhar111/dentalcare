"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/server/actions/auth";

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
  roleLabel,
}: {
  fullName?: string | null;
  email: string;
  roleLabel: string;
}) {
  const t = useTranslations("Logout");

  return (
    <div className="group relative">
      <button
        type="button"
        className="bg-primary/10 text-primary hover:bg-primary/20 grid size-8 place-items-center rounded-full text-xs font-semibold transition"
        aria-label={fullName ?? email}
      >
        {initials(fullName, email)}
      </button>
      <div className="bg-popover text-popover-foreground border-border invisible absolute inset-e-0 top-10 z-50 w-56 rounded-lg border p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-medium">{fullName ?? email}</div>
          <div className="text-muted-foreground truncate text-xs">{roleLabel}</div>
        </div>
        <div className="bg-border my-1 h-px" />
        {/*
          A form-action is the only reliable way to call Auth.js v5's `signOut`:
          it throws a NEXT_REDIRECT that the runtime handles natively for form
          submissions, but gets swallowed by useTransition (so the button click
          silently did nothing). The form posts to the action and the redirect
          chain proxy → login page works as expected.
         */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-foreground hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            {t("label")}
          </button>
        </form>
      </div>
    </div>
  );
}
