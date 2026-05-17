"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

export function PatientsSearchInput() {
  const t = useTranslations("Patients");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get("q") ?? "";
  // Local controlled value seeded from URL; user typing updates immediately,
  // URL is updated after a debounce. We never sync back from URL → state
  // (the controlled input owns the typing UX; back/forward navigations are
  // rare enough that we accept the input keeping its current draft).
  const [value, setValue] = useState(urlValue);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim().length > 0) {
      params.set("q", next.trim());
    } else {
      params.delete("q");
    }
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as never);
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 300);
  }

  return (
    <div className="relative max-w-md flex-1">
      <svg
        className="text-muted-foreground pointer-events-none absolute inset-s-3 top-2.5 size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border py-2 ps-9 pe-3 text-sm outline-none focus-visible:ring-3"
      />
      {isPending && (
        <span className="text-muted-foreground absolute inset-e-3 top-2.5 size-4 animate-spin">
          ⟳
        </span>
      )}
    </div>
  );
}
