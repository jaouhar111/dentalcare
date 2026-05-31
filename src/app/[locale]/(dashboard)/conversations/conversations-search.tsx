"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search input that syncs `q=` into the URL with a 300ms debounce. We
 * use the native Next router (not the i18n one) so we can read the
 * full `pathname + searchParams` and patch only `q` without losing the
 * locale prefix that's already in the path.
 *
 * Going through the URL (not local state) means the result list is a
 * Server Component reading `searchParams` — so search works without a
 * client-side fetch.
 */
export function ConversationsSearch({
  defaultValue,
  placeholder,
}: {
  defaultValue: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when defaultValue changes due to router-back / external nav.
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  function commit(next: string) {
    const sp = new URLSearchParams(params.toString());
    const trimmed = next.trim();
    if (trimmed.length > 0) sp.set("q", trimmed);
    else sp.delete("q");
    // When the search changes we drop `id` so we don't keep a stale
    // selection that may now be filtered out.
    sp.delete("id");
    const href = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    startTransition(() => router.replace(href, { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(next), 300);
  }

  return (
    <div className="relative">
      <svg
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-card/60 border-border focus:border-primary focus:ring-primary/30 h-8 w-56 rounded-md border pr-2 pl-8 text-xs focus:outline-none focus:ring-2"
      />
    </div>
  );
}
