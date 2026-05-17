"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function FiltersBar({ cities }: { cities: string[] }) {
  const t = useTranslations("Patients");
  const tFilters = useTranslations("Patients.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const urlStatus = (searchParams.get("status") ?? "all") as "all" | "active" | "inactive";
  const urlCity = searchParams.get("city") ?? "";

  const [q, setQ] = useState(urlQ);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function pushParams(next: { q?: string; status?: string; city?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const apply = (key: string, val: string | undefined) => {
      if (val && val.trim() !== "" && val !== "all") params.set(key, val);
      else params.delete(key);
    };
    if ("q" in next) apply("q", next.q);
    if ("status" in next) apply("status", next.status);
    if ("city" in next) apply("city", next.city);
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}` as never);
    });
  }

  function onQueryChange(next: string) {
    setQ(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushParams({ q: next }), 300);
  }

  const activeFilterCount = [urlQ ? 1 : 0, urlStatus !== "all" ? 1 : 0, urlCity ? 1 : 0].reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="border-border/60 flex flex-wrap items-center gap-3 border-b p-4">
      <div className="relative max-w-md min-w-[260px] flex-1">
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
          value={q}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border py-2 ps-9 pe-3 text-sm outline-none focus-visible:ring-3"
        />
      </div>

      <select
        value={urlStatus}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label={tFilters("status")}
        className="border-input bg-background text-foreground rounded-lg border px-3 py-2 text-sm"
      >
        <option value="all">{tFilters("allStatuses")}</option>
        <option value="active">{tFilters("active")}</option>
        <option value="inactive">{tFilters("inactive")}</option>
      </select>

      <select
        value={urlCity}
        onChange={(e) => pushParams({ city: e.target.value })}
        aria-label={tFilters("city")}
        className="border-input bg-background text-foreground rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{tFilters("allCities")}</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {activeFilterCount > 0 && (
        <div className="text-muted-foreground inline-flex items-center gap-1 text-xs">
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
              d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47"
            />
          </svg>
          {tFilters("activeCount", { count: activeFilterCount })}
        </div>
      )}
    </div>
  );
}
